// Membuat template dan contoh sheet PSG yang bergaya seperti sheet PSG workbook ASP:
//   public/templates/template-psg.xlsx   template kosong untuk diisi petugas
//   samples/contoh-psg-valid.xlsx        contoh yang diimpor tanpa error
//   samples/contoh-psg-bermasalah.xlsx   contoh dengan berbagai kesalahan isian
//
// Memakai exceljs (devDependency) karena SheetJS edisi gratis tidak bisa menulis warna, border,
// sel gabungan, atau validasi isian. Hasilnya berkas statis; aplikasi di browser tidak memuat
// exceljs. Posisi kolom harus sama dengan src/features/excel-import/adapters/psg/layout.ts.
//
// Semua nama dan angka di contoh fiktif. Jalankan: npm run samples:generate

import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import ExcelJS from "exceljs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const TEMPLATE_DIR = join(ROOT, "public", "templates")
const SAMPLES_DIR = join(ROOT, "samples")

const FIRST_DATA_ROW = 9

// Kolom yang diisi petugas (huruf kolom -> kunci data baris).
const INPUT_COLUMNS = {
  C: "name",
  D: "sex",
  E: "mDay",
  F: "mMonth",
  G: "mYear",
  H: "bDay",
  I: "bMonth",
  J: "bYear",
  L: "weight",
  M: "height",
  AG: "posyandu",
}
const TEMPLATE_ROWS = 100
const FONT = "Arial"

const COLORS = {
  banner: "FFC5D9F1",
  header: "FF00FF00",
  umur: "FFFFFF00",
  zscore: "FFDDD9C4",
  statusTb: "FFF2DCDB",
  statusBb: "FFFDE9D9",
  statusBbtb: "FFDAEEF3",
  imt: "FFCCFFCC",
  input: "FFFFFFFF",
  posyandu: "FFFFF2CC",
}

const thin = { style: "thin", color: { argb: "FFA6A6A6" } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }

function style(
  cell,
  { fill, bold = false, size = 10, align = "center", wrap = false } = {}
) {
  cell.font = { name: FONT, size, bold }
  cell.alignment = { horizontal: align, vertical: "middle", wrapText: wrap }
  if (fill)
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } }
  cell.border = BORDER
}

/**
 * Satu sheet PSG. `rows`: anak yang diisi (nilai boleh sengaja salah untuk contoh bermasalah).
 * `title`: baris kedua judul. Selalu menyediakan baris kosong berborder sampai TEMPLATE_ROWS.
 */
function buildPsgSheet(workbook, { title, rows, banner }) {
  const sheet = workbook.addWorksheet("PSG", {
    views: [{ state: "frozen", ySplit: 7, xSplit: 3 }],
  })

  // Lebar kolom. Kolom V–AF (hitungan lanjutan workbook) disembunyikan; AG (Posyandu) tampil.
  const widths = {
    A: 2,
    B: 5,
    C: 32,
    D: 9,
    E: 5,
    F: 5,
    G: 6,
    H: 5,
    I: 5,
    J: 6,
    K: 8,
    L: 8,
    M: 8,
    N: 10,
    O: 10,
    P: 10,
    Q: 16,
    R: 22,
    S: 16,
    T: 8,
    U: 8,
    AG: 16,
  }
  for (const [letters, width] of Object.entries(widths)) {
    sheet.getColumn(letters).width = width
  }
  for (let c = 22; c <= 32; c++) sheet.getColumn(c).hidden = true // V..AF

  // Judul (baris 1–3), seperti pita biru pada sheet PSG.
  const lines = ["PENENTUAN STATUS GIZI", title, banner]
  lines.forEach((text, index) => {
    const row = index + 1
    sheet.mergeCells(`B${row}:U${row}`)
    const cell = sheet.getCell(`B${row}`)
    cell.value = text
    cell.font = { name: FONT, size: index === 0 ? 16 : 11, bold: index > 0 }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.banner },
    }
  })
  sheet.getRow(1).height = 24
  sheet.mergeCells("B4:U4")
  const hint = sheet.getCell("B4")
  hint.value =
    "Isi kolom putih (nama, Sex, tanggal timbang, tanggal lahir, BB, TB, Posyandu). Kolom berwarna diisi otomatis oleh OpenASP."
  hint.font = { name: FONT, size: 9, italic: true }
  hint.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  sheet.getRow(4).height = 22

  // Judul kolom (baris 6) dan sub-judul (baris 7). C6, E6, dan H6 dipakai adapter untuk mengenali sheet.
  const head = (address, value, fill = COLORS.header, merge = null) => {
    if (merge) sheet.mergeCells(merge)
    const cell = sheet.getCell(address)
    cell.value = value
    style(cell, { fill, bold: true, size: 10 })
  }
  head("B6", "NO")
  head("C6", "NAMA")
  head("D6", "Sex")
  head("E6", "Tg.Timbang", COLORS.header, "E6:G6")
  head("H6", "Tgl.Lahir", COLORS.header, "H6:J6")
  head("K6", "Umur")
  head("L6", "BB")
  head("M6", "TB")
  head("N6", "NILAI Z_SCORE", COLORS.header, "N6:P6")
  head("Q6", "STATUS GIZI", COLORS.header, "Q6:S6")
  head("T6", "IMT", COLORS.header, "T6:U6")
  head("AG6", "POSY")

  const sub = (address, value, fill = COLORS.header) => {
    const cell = sheet.getCell(address)
    cell.value = value
    style(cell, { fill, bold: true, size: 9 })
  }
  sub("B7", "")
  sub("C7", "")
  sub("D7", "L=1,P=2")
  sub("E7", "Tg")
  sub("F7", "Bln")
  sub("G7", "Thn")
  sub("H7", "Tg")
  sub("I7", "Bln")
  sub("J7", "Thn")
  sub("K7", "( Bln )")
  sub("L7", "( Kg )")
  sub("M7", "( Cm )")
  sub("N7", "TB / U")
  sub("O7", "BB / U")
  sub("P7", "BB / TB")
  sub("Q7", "TB / U")
  sub("R7", "BB / U")
  sub("S7", "BB / TB")
  sub("T7", "")
  sub("U7", "")
  sub("AG7", "Nama Posyandu")
  sheet.getRow(6).height = 20
  sheet.getRow(7).height = 18
  sheet.getRow(8).height = 4

  // Baris isian: kolom berwarna diisi sistem, kolom putih diisi petugas.
  const fills = {
    B: COLORS.input,
    C: COLORS.input,
    D: COLORS.input,
    E: COLORS.input,
    F: COLORS.input,
    G: COLORS.input,
    H: COLORS.input,
    I: COLORS.input,
    J: COLORS.input,
    K: COLORS.umur,
    L: COLORS.input,
    M: COLORS.input,
    N: COLORS.zscore,
    O: COLORS.zscore,
    P: COLORS.zscore,
    Q: COLORS.statusTb,
    R: COLORS.statusBb,
    S: COLORS.statusBbtb,
    T: COLORS.imt,
    U: COLORS.imt,
    AG: COLORS.posyandu,
  }
  const inputColumns = INPUT_COLUMNS
  const total = Math.max(TEMPLATE_ROWS, rows.length)
  for (let index = 0; index < total; index++) {
    const rowNumber = FIRST_DATA_ROW + index
    const data = rows[index]
    for (const [letters, fill] of Object.entries(fills)) {
      const cell = sheet.getCell(`${letters}${rowNumber}`)
      if (letters === "B") cell.value = index + 1
      const key = inputColumns[letters]
      if (data && key && data[key] !== undefined && data[key] !== null) {
        cell.value = data[key]
      }
      style(cell, {
        fill,
        align: letters === "C" ? "left" : "center",
        size: 10,
      })
    }
  }

  // Validasi isian: mencegah salah ketik sejak di Excel (mis. TB 814 cm atau bulan 13).
  const lastRow = FIRST_DATA_ROW + total - 1
  const validate = (letters, rule) => {
    for (let r = FIRST_DATA_ROW; r <= lastRow; r++) {
      sheet.getCell(`${letters}${r}`).dataValidation = {
        allowBlank: true,
        showErrorMessage: true,
        errorStyle: "stop",
        ...rule,
      }
    }
  }
  const whole = (min, max, message) => ({
    type: "whole",
    operator: "between",
    formulae: [min, max],
    errorTitle: "Isian tidak valid",
    error: message,
  })
  validate("D", whole(1, 2, "Isi 1 untuk laki-laki atau 2 untuk perempuan."))
  validate("E", whole(1, 31, "Tanggal timbang harus 1 sampai 31."))
  validate("F", whole(1, 12, "Bulan timbang harus 1 sampai 12."))
  validate("G", whole(0, 99, "Tahun ditulis dua digit, mis. 26 untuk 2026."))
  validate("H", whole(1, 31, "Tanggal lahir harus 1 sampai 31."))
  validate("I", whole(1, 12, "Bulan lahir harus 1 sampai 12."))
  validate("J", whole(0, 99, "Tahun ditulis dua digit, mis. 24 untuk 2024."))
  validate("L", {
    type: "decimal",
    operator: "between",
    formulae: [1, 30],
    errorStyle: "stop",
    errorTitle: "BB di luar rentang wajar",
    error:
      "BB balita biasanya 1 sampai 30 kg. Periksa titik desimal; kosongkan bila tidak ditimbang.",
  })
  validate("M", {
    type: "decimal",
    operator: "between",
    formulae: [35, 130],
    errorStyle: "stop",
    errorTitle: "TB di luar rentang wajar",
    error:
      "TB balita biasanya 35 sampai 130 cm. Periksa titik desimal (mis. 81,4 bukan 814); kosongkan bila tidak diukur.",
  })
  return sheet
}

function addNotes(workbook, name, lines, width = 130) {
  const sheet = workbook.addWorksheet(name)
  sheet.getColumn(1).width = width
  lines.forEach((line, index) => {
    const cell = sheet.getCell(`A${index + 1}`)
    cell.value = line
    cell.font = { name: FONT, size: index === 0 ? 13 : 10, bold: index === 0 }
    cell.alignment = { wrapText: true, vertical: "top" }
  })
  return sheet
}

function newWorkbook() {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "OpenASP"
  return workbook
}

// --- Template kosong ---------------------------------------------------------------------------

async function writeTemplate() {
  const workbook = newWorkbook()
  buildPsgSheet(workbook, {
    title: "TEMPLATE PSG BULANAN (OpenASP)",
    banner: "Satu sheet = satu bulan penimbangan",
    rows: [],
  })
  addNotes(workbook, "Petunjuk", [
    "Petunjuk template PSG bulanan",
    "",
    "1. Isi satu baris per anak mulai baris 9 pada sheet PSG. Jangan mengubah judul kolom atau urutan kolom.",
    "2. Sex: 1 untuk laki-laki, 2 untuk perempuan.",
    "3. Tanggal timbang dan tanggal lahir diisi tiga kolom: tanggal, bulan, tahun dua digit (2026 ditulis 26).",
    "4. BB dalam kg dan TB dalam cm, hasil ukur nyata. Kosongkan bila anak tidak ditimbang atau diukur. Jangan mengisi angka perkiraan.",
    "5. Posyandu (kolom paling kanan) diisi nama Posyandu, huruf besar atau kecil sama saja. Ejaan harus konsisten agar anak yang sama tidak terdaftar dua kali.",
    "6. Yang diisi petugas hanya: nama, Sex, tanggal timbang, tanggal lahir, BB, TB, dan Posyandu. Kolom Umur, z-score, status gizi, dan IMT (berwarna) diisi otomatis oleh OpenASP setelah berkas diimpor; hasilnya bisa diunduh dari halaman Daftar Pantauan.",
    "7. Kolom isian punya pemeriksaan: tanggal, bulan, Sex, BB (1–30 kg), dan TB (35–130 cm) di luar rentang akan ditolak Excel. Ini untuk mencegah salah ketik seperti TB 814.",
    "8. Anak dikenali dari Posyandu + nama + tanggal lahir. Nama atau tanggal lahir yang beda sedikit dianggap anak lain.",
    "9. Satu sheet memuat satu bulan penimbangan. Untuk bulan lain, salin sheet atau gunakan berkas terpisah.",
    "",
    "Berkas ini nantinya memuat nama anak. Simpan dan bagikan hanya kepada petugas yang berkepentingan.",
  ])
  mkdirSync(TEMPLATE_DIR, { recursive: true })
  const path = join(TEMPLATE_DIR, "template-psg.xlsx")
  await workbook.xlsx.writeFile(path)
  console.log(`dibuat: public/templates/template-psg.xlsx`)
}

// --- Contoh ------------------------------------------------------------------------------------

// Tanggal timbang tetap 14 Februari 2026 (kolom E–G = 14, 2, 26).
const measured = { mDay: 14, mMonth: 2, mYear: 26 }
const child = (name, sex, birth, weight, height, posyandu, extra = {}) => {
  const [year, month, day] = birth.split("-").map(Number)
  return {
    name,
    sex: sex === "M" ? 1 : 2,
    ...measured,
    bDay: day,
    bMonth: month,
    bYear: year - 2000,
    weight,
    height,
    posyandu,
    ...extra,
  }
}

const VALID_ROWS = [
  // Tinggi normal.
  child("Anak PSG A", "F", "2024-02-12", 12, 86, "JERUK"),
  // Pendek (TB/U antara -3 dan -2 SD).
  child("Anak PSG B", "M", "2024-02-10", 10, 79, "JERUK"),
  // Sangat pendek (TB/U di bawah -3 SD).
  child("Anak PSG C", "M", "2024-08-10", 8.5, 70, "PEPAYA"),
  // Tinggi normal.
  child("Anak PSG D", "F", "2025-02-20", 8.4, 72, "PEPAYA"),
]

const PROBLEM_ROWS = [
  child("Anak Valid A", "F", "2024-02-12", 12, 86, "JERUK"),
  child("Anak Valid B", "M", "2024-08-10", 8.5, 70, "PEPAYA"),
  // Sex bukan 1 atau 2.
  child("Anak Salah Sex", "M", "2024-03-10", 11, 82, "JERUK", { sex: 3 }),
  // Tanggal lahir tidak ada di kalender (31 Februari).
  child("Anak Lahir Salah", "F", "2024-02-10", 11, 82, "JERUK", { bDay: 31 }),
  // Posyandu kosong.
  child("Anak Tanpa Posyandu", "F", "2024-05-05", 10.5, 80, null),
  // Bulan timbang 13.
  child("Anak Timbang Salah", "M", "2024-06-06", 11, 83, "PEPAYA", {
    mMonth: 13,
  }),
  // Ditimbang sebelum lahir.
  child("Anak Timbang Sebelum Lahir", "F", "2026-03-05", 4, 52, "JERUK"),
  // Salah ketik TB: 814 seharusnya 81,4.
  child("Anak Salah Ketik TB", "M", "2024-04-10", 10.2, 814, "PEPAYA"),
  // Data ganda: Posyandu + nama + tanggal lahir sama.
  child("Anak Data Ganda", "F", "2024-07-07", 10, 80, "JERUK"),
  child("Anak Data Ganda", "F", "2024-07-07", 10.1, 80.2, "JERUK"),
]

/**
 * Contoh = berkas template PSG yang diisi seperti petugas mengisinya, jadi tampilan, lebar kolom,
 * warna, dan validasi isiannya pasti sama dengan template. Kolom Umur, z-score, status, dan IMT
 * dibiarkan kosong (diisi OpenASP setelah diimpor).
 */
async function writeSample(fileName, title, banner, rows, notes) {
  const workbook = newWorkbook()
  await workbook.xlsx.readFile(join(TEMPLATE_DIR, "template-psg.xlsx"))
  const sheet = workbook.getWorksheet("PSG")
  sheet.getCell("B2").value = title
  sheet.getCell("B3").value = banner
  rows.forEach((data, index) => {
    for (const [letters, key] of Object.entries(INPUT_COLUMNS)) {
      if (data[key] === undefined || data[key] === null) continue
      sheet.getCell(`${letters}${FIRST_DATA_ROW + index}`).value = data[key]
    }
  })
  workbook.removeWorksheet(workbook.getWorksheet("Petunjuk").id)
  addNotes(workbook, "Catatan", notes, 110)
  const path = join(SAMPLES_DIR, fileName)
  await workbook.xlsx.writeFile(path)
  console.log(`dibuat: samples/${fileName}`)
}

async function main() {
  mkdirSync(SAMPLES_DIR, { recursive: true })
  await writeTemplate()
  await writeSample(
    "contoh-psg-valid.xlsx",
    "CONTOH PSG VALID (OpenASP)",
    "Februari 2026 · data fiktif",
    VALID_ROWS,
    [
      "Contoh PSG yang valid",
      "",
      "Semua nama dan angka fiktif, hanya untuk mencoba impor. Seharusnya diimpor tanpa error.",
      "Anak PSG B berstatus pendek dan Anak PSG C sangat pendek (TB/U), sehingga masuk daftar 'Perlu diukur ulang'.",
    ]
  )
  await writeSample(
    "contoh-psg-bermasalah.xlsx",
    "CONTOH PSG BERMASALAH (OpenASP)",
    "Februari 2026 · data fiktif",
    PROBLEM_ROWS,
    [
      "Contoh PSG dengan kesalahan isian",
      "",
      "Semua nama dan angka fiktif. Sengaja berisi baris bermasalah agar terlihat bagaimana pratinjau import menampilkannya:",
      "- Anak Salah Sex: Sex bukan 1 atau 2.",
      "- Anak Lahir Salah: tanggal lahir 31 Februari tidak ada.",
      "- Anak Tanpa Posyandu: nama Posyandu kosong.",
      "- Anak Timbang Salah: bulan timbang 13.",
      "- Anak Timbang Sebelum Lahir: tanggal timbang lebih awal dari tanggal lahir.",
      "- Anak Salah Ketik TB: TB 814 cm (seharusnya 81,4); diimpor lalu ditandai di 'Perlu diukur ulang'.",
      "- Anak Data Ganda: dua baris dengan Posyandu, nama, dan tanggal lahir sama.",
      "- Anak Valid A dan B: baris yang benar, ikut diimpor.",
    ]
  )
}

await main()
