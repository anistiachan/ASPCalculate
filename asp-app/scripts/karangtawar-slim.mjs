/*
 * Membuat berkas .xlsx ringkas dari workbook ASP Karangtawar asli (puluhan MB) agar bisa
 * diimpor di browser. Hanya sheet P1…P10 dan hanya kolom yang dipakai adapter yang disalin
 * (nilai, bukan rumus). NIK, nama orang tua, alamat, RT/RW, dan sheet lain tidak ikut.
 *
 * Pemakaian:
 *   npm run karangtawar:slim -- "../docs/ASP KARANGTAWAR 2025.xls" "../docs/karangtawar-ringkas.xlsx"
 *
 * Berkas hasil tetap memuat nama dan tanggal lahir anak. Simpan di luar repository atau di
 * `docs/` (sudah diabaikan git); jangan pernah di-commit.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import XLSX from "xlsx"

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  console.error(
    "Pemakaian: npm run karangtawar:slim -- <berkas.xls> <hasil.xlsx>"
  )
  process.exit(1)
}

// Harus sama dengan src/features/excel-import/adapters/karangtawar/layout.ts.
const KEEP = [
  "D",
  "E",
  "F",
  "L",
  "N",
  "O",
  "P",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "AE",
  "AF",
  "AH",
  "AI",
  "AJ",
  "AK",
  "AO",
  "AR",
  "AU",
  "AX",
  "BA",
  "BD",
  "BE",
  "BF",
  "BG",
  "BK",
  "BN",
  "BQ",
  "BT",
]
const LAST_ROW = 308

const colIndex = (letters) => {
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}
const keepIndexes = new Set(KEEP.map(colIndex))

console.log(
  "Membaca workbook (bisa memakan waktu setengah menit dan beberapa GB memori)…"
)
const source = XLSX.read(readFileSync(resolve(input)), { type: "buffer" })
const target = XLSX.utils.book_new()

for (const name of source.SheetNames) {
  if (!/^P\d{1,2}$/i.test(name)) continue
  const sheet = source.Sheets[name]
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
    range: { s: { r: 0, c: 0 }, e: { r: LAST_ROW - 1, c: colIndex("BU") } },
  })
  const slim = rows.map((row, rowIndex) =>
    row.map((value, c) => {
      // Baris header (1–8) disalin utuh agar adapter mengenali sheet; data hanya kolom terpakai.
      if (rowIndex < 8) return value
      return keepIndexes.has(c) ? value : null
    })
  )
  XLSX.utils.book_append_sheet(target, XLSX.utils.aoa_to_sheet(slim), name)
  console.log(`  ${name}: ${slim.length} baris`)
}

// Di ESM SheetJS tidak punya akses fs bawaan, jadi tulis lewat node:fs.
writeFileSync(
  resolve(output),
  XLSX.write(target, { type: "buffer", bookType: "xlsx" })
)
console.log(`Selesai: ${resolve(output)}`)
