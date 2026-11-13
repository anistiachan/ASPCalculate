import * as XLSX from "xlsx"

import { CATEGORY_LABELS } from "@/domain/anthropometry/classification"
import type { MonthlyRecap, SexCounts } from "@/domain/reporting/monthly-recap"
import {
  INDICATOR_CATEGORIES,
  INDICATOR_NAMES,
  STATUS_INDICATORS,
} from "@/domain/reporting/status-groups"
import {
  SKDN_CODES,
  SKDN_LABELS,
  type SkdnMonthly,
} from "@/domain/reporting/skdn"
import { formatMonth } from "@/lib/format/format"

export type RecapWorkbookMeta = {
  /** Tanggal pembuatan berkas (YYYY-MM-DD). */
  generatedOn: string
  algorithmVersion: string
  referenceVersion: string
  /** Apakah mesin antropometri sudah divalidasi tenaga kesehatan. */
  validated: boolean
  /** Cakupan laporan, mis. nama Posyandu. Kosong = semua data di perangkat. */
  scope?: string
}

type Cell = string | number | { t: "n"; v: number; z: string }
type Row = Cell[]

/** Persen sebagai angka sejati (bisa dihitung ulang di Excel); kosong bila penyebut nol. */
function percent(numerator: number, denominator: number): Cell {
  return denominator === 0
    ? "–"
    : { t: "n", v: numerator / denominator, z: "0.0%" }
}

const countRow = (label: string, counts: SexCounts): Row => [
  label,
  counts.M,
  counts.F,
  counts.ALL,
]

function sheet(rows: Row[], widths: number[]): XLSX.WorkSheet {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  worksheet["!cols"] = widths.map((wch) => ({ wch }))
  return worksheet
}

/**
 * Berkas Excel rekap bulanan: HANYA angka agregat dan teks keterangan tetap. Tidak ada
 * nama, NIK, tanggal lahir, atau data pribadi lain, dan tidak ada teks isian pengguna,
 * sehingga tidak ada risiko injeksi rumus (sel teks tidak pernah diawali = + - @).
 */
export function buildRecapWorkbook(
  recap: MonthlyRecap,
  meta: RecapWorkbookMeta,
  skdn?: SkdnMonthly
): Uint8Array {
  const book = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(
    book,
    sheet(
      [
        ["Rekap bulanan OpenASP"],
        ["Periode", formatMonth(recap.month)],
        ["Posyandu", meta.scope ?? "Semua Posyandu"],
        [],
        ["Keterangan", "Laki-laki", "Perempuan", "Jumlah"],
        countRow("Balita terdata", recap.eligible),
        countRow("Ditimbang (ada berat)", recap.weighed),
        countRow("Diukur panjang/tinggi", recap.heightMeasured),
        [
          "Persen ditimbang (ditimbang dibagi terdata)",
          percent(recap.weighed.M, recap.eligible.M),
          percent(recap.weighed.F, recap.eligible.F),
          percent(recap.weighed.ALL, recap.eligible.ALL),
        ],
      ],
      [46, 14, 14, 14]
    ),
    "Ringkasan"
  )

  const statusRows: Row[] = [
    ["Indikator", "Kategori", "Laki-laki", "Perempuan", "Jumlah", "Persen"],
  ]
  for (const indicator of STATUS_INDICATORS) {
    const name = INDICATOR_NAMES[indicator].short
    const breakdown = recap.status[indicator]
    for (const category of INDICATOR_CATEGORIES[indicator]) {
      statusRows.push([
        name,
        CATEGORY_LABELS[category],
        breakdown.M.counts[category] ?? 0,
        breakdown.F.counts[category] ?? 0,
        breakdown.ALL.counts[category] ?? 0,
        percent(breakdown.ALL.counts[category] ?? 0, breakdown.ALL.assessed),
      ])
    }
    statusRows.push([
      name,
      "Dinilai",
      breakdown.M.assessed,
      breakdown.F.assessed,
      breakdown.ALL.assessed,
      "",
    ])
    statusRows.push([
      name,
      "Tidak dapat dihitung",
      breakdown.M.notAssessed,
      breakdown.F.notAssessed,
      breakdown.ALL.notAssessed,
      "",
    ])
  }
  XLSX.utils.book_append_sheet(
    book,
    sheet(statusRows, [12, 28, 12, 12, 12, 10]),
    "Status Gizi"
  )

  XLSX.utils.book_append_sheet(
    book,
    sheet(
      [
        ["Isian", "Laki-laki", "Perempuan", "Jumlah"],
        [
          "Tercatat ya",
          recap.vitaminA.M.yes,
          recap.vitaminA.F.yes,
          recap.vitaminA.ALL.yes,
        ],
        [
          "Tercatat tidak",
          recap.vitaminA.M.no,
          recap.vitaminA.F.no,
          recap.vitaminA.ALL.no,
        ],
        [
          "Tidak diisi",
          recap.vitaminA.M.unknown,
          recap.vitaminA.F.unknown,
          recap.vitaminA.ALL.unknown,
        ],
      ],
      [20, 14, 14, 14]
    ),
    "Vitamin A"
  )

  if (skdn) {
    const skdnRows: Row[] = [
      [
        "DRAF: aturan hitung mengikuti rumus workbook ASP Karangtawar 2025 dan belum disetujui pemilik proses/Bidan. Bukan laporan resmi.",
      ],
      [],
      ["Kode", "Keterangan", "Laki-laki", "Perempuan", "Jumlah"],
      [
        "S",
        "Sasaran: sumbernya belum ditemukan, tidak dihitung",
        "–",
        "–",
        "–",
      ],
    ]
    for (const code of SKDN_CODES) {
      const counts = skdn.counts[code]
      skdnRows.push([
        SKDN_LABELS[code].code,
        SKDN_LABELS[code].label,
        counts.M,
        counts.F,
        counts.ALL,
      ])
    }
    XLSX.utils.book_append_sheet(
      book,
      sheet(skdnRows, [8, 52, 12, 12, 12]),
      "SKDN (Draf)"
    )
  }

  const notes: Row[] = [
    ["Catatan"],
    [
      meta.validated
        ? "Mesin antropometri telah ditinjau tenaga kesehatan."
        : "PERHATIAN: hasil status gizi belum divalidasi oleh tenaga kesehatan dan tidak boleh dipakai untuk keputusan layanan gizi.",
    ],
    [],
    [
      "Balita terdata: anak yang sudah lahir dan belum berumur 60 bulan pada awal bulan.",
    ],
    [
      "Ditimbang: balita terdata yang punya minimal satu pengukuran berat pada bulan itu.",
    ],
    ["Anak yang diukur lebih dari sekali dalam sebulan dihitung sekali."],
    [
      "Status gizi memakai pengukuran terakhir pada bulan itu yang berisi berat atau panjang/tinggi.",
    ],
    [
      "Persen status gizi dihitung dari jumlah anak yang dinilai, bukan dari balita terdata.",
    ],
    [
      "Vitamin A: hitungan isian. Arti kolom Vitamin A di sumber belum dikonfirmasi, sehingga bukan angka cakupan.",
    ],
    [],
    [
      "Belum tersedia: SKDN resmi (S belum ada sumbernya; K, D, N, T, O, B, 2T hanya draf), ASI eksklusif, kelas ibu balita, MBG, dan rekap per Posyandu.",
    ],
    [],
    [
      "Standar",
      "Permenkes No. 2 Tahun 2020 dan WHO Child Growth Standards 2006",
    ],
    ["Versi algoritma", meta.algorithmVersion],
    ["Versi referensi", meta.referenceVersion],
    ["Dibuat pada", meta.generatedOn],
    ["Dibuat oleh", "OpenASP. Data diproses di perangkat pengguna."],
  ]
  XLSX.utils.book_append_sheet(book, sheet(notes, [110, 70]), "Catatan")

  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }))
}

export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
