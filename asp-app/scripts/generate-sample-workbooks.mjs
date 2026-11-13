// Membuat file Excel contoh SINTETIS di folder samples/ untuk mencoba fitur Import.
// Semua nama, NIK, dan angka dibuat-buat. Jangan menyalin data asli ke skrip ini.
//
// Jalankan: node scripts/generate-sample-workbooks.mjs

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import * as XLSX from "xlsx"

const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "samples"
)

const CHILD_HEADERS = [
  "No",
  "anak_ke",
  "tgl_lahir",
  "jenis_kelamin",
  "nomor_KK",
  "NIK",
  "nama_anak",
  "usia_hamil",
  "berat_lahir",
  "panjang_lahir",
  "lingkar_kepala_lahir",
  "kia",
  "kia_bayi_kecil",
  "imd",
  "nama_ortu",
  "nik_ortu",
  "hp_ortu",
  "alamat",
  "rt",
  "rw",
  "hapus",
  "pindah",
]

const MONTH_HEADERS = [
  "No",
  "NIK",
  "nama_anak",
  "TANGGALUKUR",
  "BERAT",
  "TINGGI",
  "LILA",
  "lingkar_kepala",
  "Pitting_edema",
  "CARAUKUR",
  "vita",
  "asi_bulan_0",
  "asi_bulan_1",
  "asi_bulan_2",
  "asi_bulan_3",
  "asi_bulan_4",
  "asi_bulan_5",
  "asi_bulan_6",
  "kelas_ibu_balita",
  "mbg",
  "KETERANGAN",
]

// Sheet Juni–September memiliki TANGGAL LAHIR di antara nama_anak dan TANGGALUKUR.
const MONTH_HEADERS_WITH_BIRTH_DATE = [
  ...MONTH_HEADERS.slice(0, 3),
  "TANGGAL LAHIR",
  ...MONTH_HEADERS.slice(3),
]

// --- Data anak sintetis -----------------------------------------------------

const nik = (n) => `3200${String(n).padStart(12, "0")}`

const CHILDREN = [
  { n: 1, birth: "2021-02-10", sex: "L" },
  { n: 2, birth: "2021-08-25", sex: "P" },
  { n: 3, birth: "2022-05-03", sex: "Laki-laki" },
  { n: 4, birth: "2022-11-19", sex: "Perempuan" },
  { n: 5, birth: "2023-04-07", sex: "L" },
  { n: 6, birth: "2023-12-01", sex: "P" },
  { n: 7, birth: "2024-06-14", sex: "L" },
  { n: 8, birth: "2024-10-30", sex: "P" },
  { n: 9, birth: "2025-07-22", sex: "L" },
  { n: 10, birth: "2026-03-05", sex: "P" },
].map((child) => ({
  ...child,
  nik: nik(child.n),
  name: `Anak Contoh ${String(child.n).padStart(2, "0")}`,
}))

// --- Util -------------------------------------------------------------------

function excelSerial(iso) {
  const [year, month, day] = iso.split("-").map(Number)
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000
}

/** Sel tanggal asli Excel (angka serial dengan format tanggal). */
function dateCell(iso) {
  return { t: "n", v: excelSerial(iso), z: "dd/mm/yyyy" }
}

/** Format DD/MM/YYYY sebagai teks. */
function dayFirstText(iso) {
  const [year, month, day] = iso.split("-")
  return `${day}/${month}/${year}`
}

function ageInMonths(birthIso, measuredIso) {
  const [by, bm, bd] = birthIso.split("-").map(Number)
  const [my, mm, md] = measuredIso.split("-").map(Number)
  return (my - by) * 12 + (mm - bm) - (md < bd ? 1 : 0)
}

const round1 = (value) => Math.round(value * 10) / 10

// Perkiraan kasar HANYA untuk membuat angka contoh tampak masuk akal.
// Bukan tabel pertumbuhan dan tidak boleh dipakai sebagai acuan perhitungan.
function plausibleHeightCm(months) {
  if (months <= 12) return 50 + months * 1.6
  if (months <= 24) return 69.2 + (months - 12) * 0.8
  return 78.8 + (months - 24) * 0.55
}

function plausibleWeightKg(months) {
  if (months <= 12) return 3.3 + months * 0.5
  return 9.3 + (months - 12) * 0.17
}

/** Menulis angka dengan koma desimal sebagai teks (seperti yang sering terjadi di lapangan). */
const commaDecimal = (value) => String(value).replace(".", ",")

function toRow(headers, values) {
  return headers.map((header) => values[header] ?? null)
}

function makeSheet(rows) {
  return XLSX.utils.aoa_to_sheet(rows)
}

// --- Sheet ------------------------------------------------------------------

function childrenSheet(children = CHILDREN, overrides = {}) {
  const rows = children.map((child, index) => {
    const row = {
      No: index + 1,
      anak_ke: (child.n % 3) + 1,
      tgl_lahir: child.n % 2 === 0 ? child.birth : dateCell(child.birth),
      jenis_kelamin: child.sex,
      nomor_KK: `3200${String(900 + child.n).padStart(12, "0")}`,
      NIK: child.nik,
      nama_anak: child.name,
      berat_lahir: commaDecimal(round1(2.9 + (child.n % 5) * 0.1)),
      panjang_lahir: 48 + (child.n % 3),
      lingkar_kepala_lahir: 33 + (child.n % 3),
      nama_ortu: `Orang Tua Contoh ${child.n}`,
      nik_ortu: `3200${String(800 + child.n).padStart(12, "0")}`,
      hp_ortu: "0800000000",
      alamat: "Jalan Contoh (alamat sintetis)",
      rt: "01",
      rw: "01",
      ...(overrides[child.n] ?? {}),
    }
    return toRow(CHILD_HEADERS, row)
  })
  return makeSheet([["DATA BALITA BARU"], CHILD_HEADERS, ...rows])
}

/**
 * @param {string} measuredIso tanggal ukur
 * @param {"serial" | "dayfirst" | "iso"} dateStyle format sel tanggal ukur
 */
function monthSheet({
  measuredIso,
  dateStyle,
  withBirthDate,
  extra = [],
  vita,
}) {
  const headers = withBirthDate ? MONTH_HEADERS_WITH_BIRTH_DATE : MONTH_HEADERS
  const rows = []

  CHILDREN.filter((child) => child.birth <= measuredIso).forEach(
    (child, index) => {
      const months = ageInMonths(child.birth, measuredIso)
      if (months > 59) return

      const standing = months >= 24
      const dateValue =
        dateStyle === "serial"
          ? dateCell(measuredIso)
          : dateStyle === "dayfirst"
            ? dayFirstText(measuredIso)
            : measuredIso

      const values = {
        No: index + 1,
        NIK: child.nik,
        nama_anak: child.name,
        "TANGGAL LAHIR": child.birth,
        TANGGALUKUR: dateValue,
        BERAT:
          index % 2 === 0
            ? round1(plausibleWeightKg(months))
            : commaDecimal(round1(plausibleWeightKg(months))),
        TINGGI:
          index % 2 === 0
            ? commaDecimal(round1(plausibleHeightCm(months)))
            : round1(plausibleHeightCm(months)),
        LILA:
          months >= 6 ? commaDecimal(round1(13.5 + (index % 4) * 0.3)) : null,
        lingkar_kepala: months < 36 ? round1(44 + months * 0.15) : null,
        CARAUKUR: standing ? "Berdiri" : "Terlentang",
        vita: vita && months >= 6 ? (index % 3 === 0 ? "TIDAK" : "YA") : null,
        kelas_ibu_balita: index % 2 === 0 ? "ya" : "tidak",
      }
      // ASI hanya relevan untuk bayi sampai 6 bulan.
      for (let m = 0; m <= Math.min(months, 6); m++)
        values[`asi_bulan_${m}`] = "ya"

      rows.push(toRow(headers, values))
    }
  )

  rows.push(...extra.map((values) => toRow(headers, values)))
  return makeSheet([headers, ...rows])
}

/** Daftar anak yang belum diukur bulan ini (hanya NIK dan nama). */
function rosterOnlySheet(measuredIso) {
  const rows = CHILDREN.filter((child) => child.birth <= measuredIso).map(
    (child, index) =>
      toRow(MONTH_HEADERS, {
        No: index + 1,
        NIK: child.nik,
        nama_anak: child.name,
      })
  )
  return makeSheet([MONTH_HEADERS, ...rows])
}

const emptyMonthSheet = () => makeSheet([MONTH_HEADERS])

/** Sheet contoh pengisian: harus dilewati oleh importer. */
function sampleSheet() {
  return makeSheet([
    MONTH_HEADERS,
    toRow(MONTH_HEADERS, {
      No: 1,
      NIK: nik(9999),
      nama_anak: "Contoh Pengisian",
      TANGGALUKUR: "2026-01-01",
      BERAT: 10,
      TINGGI: 80,
      CARAUKUR: "berdiri",
      vita: "ya",
      KETERANGAN: "contoh: isi sesuai keadaan",
    }),
  ])
}

// --- Workbook ---------------------------------------------------------------

function buildValidWorkbook() {
  const book = XLSX.utils.book_new()
  const add = (name, sheet) => XLSX.utils.book_append_sheet(book, sheet, name)

  add("CONTOH", sampleSheet())
  add("Tambah Balita", childrenSheet())
  add(
    "JANUARI",
    monthSheet({
      measuredIso: "2026-01-15",
      dateStyle: "serial",
      withBirthDate: false,
      vita: false,
    })
  )
  add("FEBRUARI", rosterOnlySheet("2026-02-15"))
  add("MARET", emptyMonthSheet())
  add("APRIL", emptyMonthSheet())
  add("MEI", emptyMonthSheet())
  add(
    "JUNI",
    monthSheet({
      measuredIso: "2026-06-12",
      dateStyle: "dayfirst",
      withBirthDate: true,
      vita: false,
    })
  )
  add("JULI", emptyMonthSheet())
  add("AGUSTUS", emptyMonthSheet())
  add(
    "SEPTEMBER",
    monthSheet({
      measuredIso: "2026-09-10",
      dateStyle: "iso",
      withBirthDate: true,
      vita: true,
    })
  )
  add("OKTOBER", emptyMonthSheet())
  add("NOVEMBER", emptyMonthSheet())
  add("DESEMBER", emptyMonthSheet())
  return book
}

/** Workbook yang sengaja berisi berbagai masalah untuk memperlihatkan pratinjau error/peringatan. */
function buildProblematicWorkbook() {
  const book = XLSX.utils.book_new()
  const add = (name, sheet) => XLSX.utils.book_append_sheet(book, sheet, name)

  // Data induk: kode jenis kelamin numerik, tanpa NIK, dan NIK ganda.
  const children = [
    ...CHILDREN.slice(0, 6),
    { ...CHILDREN[6], sex: 1 }, // ditolak: kode numerik belum terkonfirmasi
    { ...CHILDREN[7], nik: "" }, // ditolak: NIK kosong
    CHILDREN[8],
    { ...CHILDREN[8], name: "Anak Contoh 09 (ganda)" }, // NIK ganda: kedua baris ditolak
  ]
  const childrenWithFlag = childrenSheet(children, { 2: { pindah: "ya" } })
  add("Tambah Balita", childrenWithFlag)

  const juni = XLSX.utils.sheet_to_json(
    monthSheet({
      measuredIso: "2026-06-12",
      dateStyle: "dayfirst",
      withBirthDate: true,
      vita: false,
    }),
    { header: 1, defval: null, blankrows: true }
  )
  const column = (header) => MONTH_HEADERS_WITH_BIRTH_DATE.indexOf(header)
  const set = (rowIndex, header, value) => {
    juni[rowIndex][column(header)] = value
  }
  // Baris data dimulai di indeks 1.
  set(1, "BERAT", "abc") // error: berat bukan angka
  set(2, "NIK", nik(7777)) // error: NIK tidak ada di data induk
  set(3, "TANGGALUKUR", "01/01/2020") // error: sebelum tanggal lahir
  set(4, "BERAT", 0) // error: berat nol
  set(5, "nama_anak", "Nama Yang Berbeda") // peringatan: nama beda
  set(5, "TANGGAL LAHIR", "2023-12-02") // peringatan: tanggal lahir beda
  set(5, "CARAUKUR", "duduk") // peringatan: cara ukur tidak dikenal
  set(5, "Pitting_edema", 0) // peringatan: perlu pemetaan

  const juniWithUnknownColumn = juni.map((row, index) => [
    ...row,
    index === 0 ? "CATATAN_LAIN" : null, // peringatan: kolom tidak dikenal
  ])
  // Duplikat: salin baris anak yang valid (anak ke-6) sehingga ada dua pengukuran
  // pada tanggal yang sama.
  juniWithUnknownColumn.push([...juniWithUnknownColumn[5]])

  add(
    "JANUARI",
    monthSheet({
      measuredIso: "2026-01-15",
      dateStyle: "serial",
      withBirthDate: false,
      vita: false,
    })
  )
  add("JUNI", makeSheet(juniWithUnknownColumn))
  return book
}

// --- Format ASP Karangtawar (sheet Posyandu P1…P10) ------------------------------------
// Hanya kolom yang dibaca adapter (src/features/excel-import/adapters/karangtawar/layout.ts).

function columnIndex(letters) {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function posyanduSheet(rows) {
  const grid = Array.from({ length: 308 }, () =>
    Array.from({ length: 73 }, () => null)
  )
  grid[6][columnIndex("L")] = "NAMA POSYANDU"
  grid[6][columnIndex("N")] = "NAMA ANAK"
  rows.forEach((cells, i) => {
    for (const [letters, value] of Object.entries(cells)) {
      grid[8 + i][columnIndex(letters)] = value
    }
  })
  return XLSX.utils.aoa_to_sheet(grid)
}

// Tahun data 2026 (kolom R = 26), hari timbang 14. Kolom BB: AE=Jan, AH=Feb, AO=Mar.
// `extra`: sel tambahan per kolom, mis. Vitamin A biru (AJ), merah (AK), ASI-E ya (AL) pada Februari.
function karangtawarChild(posyandu, name, sex, birth, weights, extra = {}) {
  const [year, month, day] = birth.split("-").map(Number)
  return {
    L: posyandu,
    N: name,
    O: sex === "M" ? 1 : 2,
    D: 1,
    E: 3,
    F: 49,
    P: 14,
    R: 26,
    S: day,
    T: month,
    U: year - 2000,
    AE: weights[0] ?? null,
    AH: weights[1] ?? null,
    AO: weights[2] ?? null,
    ...extra,
  }
}

function buildKarangtawarWorkbook() {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    book,
    posyanduSheet([
      karangtawarChild(
        "JERUK",
        "Anak Contoh A",
        "M",
        "2025-01-05",
        [9.8, 10.1, 10.2],
        { AK: 1 }
      ),
      karangtawarChild(
        "JERUK",
        "Anak Contoh B",
        "F",
        "2025-06-20",
        [8.0, 8.2, 8.4],
        { AJ: 1 }
      ),
      karangtawarChild("JERUK", "Anak Contoh C", "M", "2023-02-14", [
        13.0,
        null,
        13.5,
      ]),
      karangtawarChild("JERUK", "Anak Contoh D", "F", "2024-09-01", [
        null,
        11.0,
        null,
      ]),
    ]),
    "P1"
  )
  XLSX.utils.book_append_sheet(
    book,
    posyanduSheet([
      karangtawarChild(
        "PEPAYA",
        "Anak Contoh E",
        "M",
        "2025-10-10",
        [6.0, 6.9, 7.5],
        { AL: 1 }
      ),
      karangtawarChild("PEPAYA", "Anak Contoh F", "F", "2022-12-01", [
        14.0,
        14.1,
        null,
      ]),
    ]),
    "P2"
  )
  XLSX.utils.book_append_sheet(book, posyanduSheet([]), "P3")
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([["SKDN"]]),
    "SKDN"
  )
  return book
}

function writeBook(book, fileName, bookType) {
  const buffer = XLSX.write(book, { type: "buffer", bookType })
  writeFileSync(join(OUTPUT_DIR, fileName), buffer)
  console.log(`dibuat: samples/${fileName} (${buffer.length} byte)`)
}

mkdirSync(OUTPUT_DIR, { recursive: true })
writeBook(buildValidWorkbook(), "contoh-bu-bidan-valid.xlsx", "xlsx")
writeBook(buildValidWorkbook(), "contoh-bu-bidan-valid.xls", "biff8")
writeBook(buildProblematicWorkbook(), "contoh-bu-bidan-bermasalah.xlsx", "xlsx")
writeBook(buildKarangtawarWorkbook(), "contoh-karangtawar.xlsx", "xlsx")
