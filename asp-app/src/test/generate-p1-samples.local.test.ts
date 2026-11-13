import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import ExcelJS from "exceljs"
import { describe, it } from "vitest"

import { buildP1Template } from "@/infrastructure/excel/p1-workbook"

/**
 * Pembangkit contoh P1 (samples/contoh-p1-valid.xlsx dan samples/contoh-p1-bermasalah.xlsx).
 * Dilewati kecuali GENERATE_SAMPLES=1; dijalankan lewat `npm run samples:generate`.
 *
 * Contoh = template P1 yang diisi seperti petugas mengisinya, jadi tampilan dan posisi
 * kolomnya pasti sama dengan template. Kolom Umur dan STATUS PERTUMBUHAN dibiarkan kosong
 * (diisi OpenASP). Semua nama dan angka fiktif.
 */

type Cells = Record<string, string | number | null>

/** Satu baris anak. Tahun data 2026 (R=26), hari timbang 14; kolom bulan lewat `months`. */
function child(
  posyandu: string | null,
  name: string,
  sex: number,
  birth: string,
  months: Cells,
  extra: Cells = {}
): Cells {
  const [year, month, day] = birth.split("-").map(Number)
  return {
    L: posyandu,
    N: name,
    O: sex,
    P: 14,
    R: 26,
    S: day,
    T: month,
    U: year - 2000,
    D: 1,
    E: 3.1,
    F: 49,
    ...months,
    ...extra,
  }
}

// Kolom BB/TB per bulan: Jan AE/AF, Feb AH/AI, Mar AO, Apr AR, Mei AU, Jun AX, Jul BA, Agu BD/BE.
// Vitamin A: Feb AJ biru, AK merah; Agu BF biru, BG merah. ASI-E: Feb AL ya, AM tdk.
const VALID: Cells[] = [
  child(
    "JERUK",
    "Anak Contoh A",
    2,
    "2025-01-05",
    {
      V: 9.2,
      W: 71,
      X: 9.5,
      Y: 72,
      AE: 9.8,
      AF: 74,
      AH: 10.1,
      AI: 75,
      AO: 10.2,
      AR: 10.5,
      AX: 10.9,
      BD: 11.3,
      BE: 78,
    },
    { AK: 1, BG: 1 }
  ),
  child(
    "JERUK",
    "Anak Contoh B",
    1,
    "2025-06-20",
    {
      AE: 8.0,
      AF: 68,
      AH: 8.2,
      AI: 69,
      AO: 8.4,
      AR: 8.7,
      AU: 8.9,
      AX: 9.1,
      BA: 9.4,
      BD: 9.7,
      BE: 72,
    },
    { AJ: 1, BG: 1 }
  ),
  child("JERUK", "Anak Contoh C", 1, "2023-02-14", {
    AE: 13.0,
    AF: 92,
    AH: 13.2,
    AI: 92.5,
    AO: 13.5,
    BD: 14.2,
    BE: 95,
  }),
  child("JERUK", "Anak Contoh D", 2, "2024-09-01", {
    AH: 11.0,
    AI: 82,
    AU: 11.6,
    BD: 12.1,
    BE: 86,
  }),
  child(
    "PEPAYA",
    "Anak Contoh E",
    1,
    "2025-10-10",
    { AE: 6.0, AF: 61, AH: 6.9, AI: 63, AO: 7.5, AR: 7.9 },
    { AL: 1 }
  ),
  child("PEPAYA", "Anak Contoh F", 2, "2022-12-01", {
    AE: 14.0,
    AF: 96,
    AH: 14.1,
    AI: 96.5,
    BD: 15.0,
    BE: 99,
  }),
  // Pendek (TB/U antara -3 dan -2 SD) pada Januari 2026, umur 23 bulan.
  child("PEPAYA", "Anak Contoh G", 1, "2024-02-10", {
    AE: 10,
    AF: 79,
    AH: 10.2,
    AI: 79.8,
    AO: 10.4,
  }),
  // Sangat pendek (TB/U di bawah -3 SD).
  child("PEPAYA", "Anak Contoh H", 1, "2024-08-10", {
    AE: 8.5,
    AF: 70,
    AH: 8.6,
    AI: 70.5,
    AO: 8.8,
  }),
]

const PROBLEMS: Cells[] = [
  child("JERUK", "Anak Valid A", 2, "2025-01-05", {
    AE: 9.8,
    AF: 74,
    AH: 10.1,
    AI: 75,
  }),
  child("PEPAYA", "Anak Valid B", 1, "2024-08-10", {
    AE: 8.5,
    AF: 70,
    AH: 8.6,
    AI: 70.5,
  }),
  // L/P bukan 1 atau 2.
  child("JERUK", "Anak Salah Sex", 3, "2024-03-10", { AE: 11, AF: 82 }),
  // Tanggal lahir tidak ada di kalender (31 Februari).
  child(
    "JERUK",
    "Anak Lahir Salah",
    2,
    "2024-02-10",
    { AE: 11, AF: 82 },
    { S: 31 }
  ),
  // Nama Posyandu kosong.
  child(null, "Anak Tanpa Posyandu", 2, "2024-05-05", { AE: 10.5, AF: 80 }),
  // Tahun data (R) kosong, jadi pengukuran tidak bisa diberi tanggal.
  child(
    "PEPAYA",
    "Anak Tanpa Tahun",
    1,
    "2024-06-06",
    { AE: 11, AF: 83 },
    { R: null }
  ),
  // Berat negatif.
  child("JERUK", "Anak Berat Negatif", 2, "2024-07-07", { AE: -9, AF: 80 }),
  // Salah ketik: BB 105 (seharusnya 10,5) dan TB 814 (seharusnya 81,4).
  child("PEPAYA", "Anak Salah Ketik", 1, "2024-04-10", {
    AE: 105,
    AF: 814,
  }),
  // Ditimbang sebelum lahir (lahir Maret 2026, ada berat Januari 2026).
  child("JERUK", "Anak Timbang Sebelum Lahir", 2, "2026-03-05", {
    AE: 4,
    AF: 52,
  }),
  // Data ganda: Posyandu + nama + tanggal lahir sama.
  child("JERUK", "Anak Data Ganda", 2, "2024-09-09", { AE: 10, AF: 80 }),
  child("JERUK", "Anak Data Ganda", 2, "2024-09-09", { AE: 10.1, AF: 80.2 }),
]

async function writeSample(
  fileName: string,
  title: string,
  rows: Cells[],
  notes: string[]
) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(
    (await buildP1Template()) as unknown as ExcelJS.Buffer
  )
  const sheet = workbook.getWorksheet("P1")!
  sheet.getCell("L3").value = title
  rows.forEach((cells, index) => {
    for (const [letter, value] of Object.entries(cells)) {
      if (value === null) continue
      sheet.getCell(`${letter}${9 + index}`).value = value
    }
  })

  workbook.removeWorksheet(workbook.getWorksheet("Petunjuk")!.id)
  const info = workbook.addWorksheet("Catatan")
  info.getColumn(1).width = 110
  notes.forEach((line, index) => {
    const cell = info.getCell(`A${index + 1}`)
    cell.value = line
    cell.font = {
      name: "Arial",
      size: index === 0 ? 13 : 10,
      bold: index === 0,
    }
    cell.alignment = { wrapText: true, vertical: "top" }
  })

  const directory = join(process.cwd(), "samples")
  mkdirSync(directory, { recursive: true })
  writeFileSync(
    join(directory, fileName),
    new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer)
  )
}

describe.skipIf(!process.env.GENERATE_SAMPLES)("pembangkit contoh P1", () => {
  it("menulis contoh valid dan bermasalah dari template P1", async () => {
    await writeSample(
      "contoh-p1-valid.xlsx",
      "CONTOH P1 VALID (OpenASP) · data fiktif",
      VALID,
      [
        "Contoh sheet Posyandu (P1) yang valid",
        "",
        "Template P1 yang diisi petugas: 8 anak fiktif di Posyandu JERUK dan PEPAYA, penimbangan Januari sampai Agustus 2026 (tidak semua bulan terisi), Vitamin A dan ASI-E Februari/Agustus, serta Nov dan Des 2025 untuk satu anak.",
        "Seharusnya diimpor tanpa error. Anak Contoh G pendek dan Anak Contoh H sangat pendek (TB/U) pada Januari 2026, sehingga masuk daftar 'Perlu diukur ulang'.",
        "Kolom Umur dan STATUS PERTUMBUHAN sengaja kosong: diisi OpenASP setelah diimpor.",
      ]
    )
    await writeSample(
      "contoh-p1-bermasalah.xlsx",
      "CONTOH P1 BERMASALAH (OpenASP) · data fiktif",
      PROBLEMS,
      [
        "Contoh sheet Posyandu (P1) dengan kesalahan isian",
        "",
        "Semua nama dan angka fiktif. Sengaja berisi baris bermasalah agar terlihat bagaimana pratinjau import menampilkannya:",
        "- Anak Salah Sex: L/P bukan 1 atau 2.",
        "- Anak Lahir Salah: tanggal lahir 31 Februari tidak ada.",
        "- Anak Tanpa Posyandu: nama Posyandu kosong.",
        "- Anak Tanpa Tahun: tahun data kosong, pengukuran tidak diimpor.",
        "- Anak Berat Negatif: berat harus lebih dari nol.",
        "- Anak Salah Ketik: BB 105 kg dan TB 814 cm (seharusnya 10,5 dan 81,4); diimpor dengan peringatan lalu ditandai di 'Perlu diukur ulang'.",
        "- Anak Timbang Sebelum Lahir: berat tercatat sebelum tanggal lahir.",
        "- Anak Data Ganda: dua baris dengan Posyandu, nama, dan tanggal lahir sama.",
        "- Anak Valid A dan B: baris yang benar, ikut diimpor.",
        "Catatan: validasi isian di template Excel akan menolak sebagian kesalahan ini bila diketik langsung; contoh ini ditulis lewat program sehingga validasi itu terlewati.",
      ]
    )
  })
})
