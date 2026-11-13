// Membuat berkas Excel kecil berisi tabel referensi WHO 2006 (sheet WHO_LHFA, WHO_WFA, WHO_WFL, WHO_WFH)
// dari berkas JSON di repositori. Dipakai scripts/add-zscore-to-bu-bidan.ps1, yang menyalin sheet-nya ke
// workbook Bu Bidan supaya rumus z-score bisa mencari L, M, dan S langsung di Excel.
//
// Pemakaian: node scripts/build-who-reference-workbook.mjs <berkas-keluaran.xlsx>

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import XLSX from "xlsx"

const output = process.argv[2]
if (!output) {
  console.error(
    "Pemakaian: node scripts/build-who-reference-workbook.mjs <berkas-keluaran.xlsx>"
  )
  process.exit(1)
}

const whoDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "domain",
  "anthropometry",
  "references",
  "who-2006"
)

const SHEETS = [
  { name: "WHO_LHFA", file: "lhfa.json", key: "umur_hari" },
  { name: "WHO_WFA", file: "wfa.json", key: "umur_hari" },
  { name: "WHO_WFL", file: "wfl.json", key: "panjang_cm" },
  { name: "WHO_WFH", file: "wfh.json", key: "tinggi_cm" },
]

const book = XLSX.utils.book_new()
for (const { name, file, key } of SHEETS) {
  const table = JSON.parse(readFileSync(join(whoDir, file), "utf8"))
  const rows = [
    [
      key,
      "L_laki",
      "M_laki",
      "S_laki",
      "L_perempuan",
      "M_perempuan",
      "S_perempuan",
    ],
  ]
  for (let i = 0; i < table.count; i++) {
    // Kunci panjang/tinggi dibulatkan agar tidak membawa derau floating point (65,30000000000001).
    const keyValue = Number((table.start + i * table.step).toFixed(1))
    rows.push([
      keyValue,
      table.male.l[i],
      table.male.m[i],
      table.male.s[i],
      table.female.l[i],
      table.female.m[i],
      table.female.s[i],
    ])
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet["I1"] = {
    t: "s",
    v: "Tabel referensi WHO Child Growth Standards 2006. Jangan diubah: dipakai rumus z-score.",
  }
  sheet["!ref"] = `A1:I${rows.length}`
  sheet["!cols"] = [
    { wch: 12 },
    { wch: 9 },
    { wch: 10 },
    { wch: 9 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(book, sheet, name)
  console.log(`${name}: ${table.count} baris`)
}

writeFileSync(
  resolve(output),
  XLSX.write(book, { type: "buffer", bookType: "xlsx" })
)
