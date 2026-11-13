import * as XLSX from "xlsx"

import {
  CATEGORY_LABELS,
  type NutritionCategory,
} from "@/domain/anthropometry/classification"
import {
  NORMAL_CATEGORIES,
  statusFlagsOf,
  type ListedChild,
  type StatusFlags,
  type StatusLists,
} from "@/domain/reporting/lists"
import type { RecheckEntry } from "@/domain/reporting/recheck"
import { columnIndex } from "@/features/excel-import/adapters/karangtawar/layout"
import {
  PSG_COLUMNS,
  PSG_FIRST_DATA_ROW,
  PSG_HEADER_ROW,
  PSG_SHEET_NAME,
} from "@/features/excel-import/adapters/psg/layout"
import { formatMonth } from "@/lib/format/format"

export type PsgWorkbookMeta = {
  generatedOn: string
  /** Nama Posyandu bila disaring; kosong = semua. */
  scope?: string
  validated: boolean
}

/**
 * Kolom hasil hitungan di luar kolom masukan (C–M, AG) yang sudah didefinisikan adapter PSG.
 * Posisinya sama dengan sheet PSG workbook ASP, jadi berkas ini juga dikenali adapter PSG.
 */
const OUT = {
  no: "B",
  umur: "K",
  zHaz: "N",
  zWaz: "O",
  zWhz: "P",
  statusHaz: "Q",
  statusWaz: "R",
  statusWhz: "S",
  imt: "T",
  recheck: "U",
  note: "AI",
} as const

/** Kolom penanda (1/0) sheet PSG: PDK, S.PDK, BGM, KRS, S.KRS, GMK, MSL, CALON, BBK. */
export const PSG_FLAG_COLUMNS: readonly {
  header: string
  column: string
  flag: keyof StatusFlags
}[] = [
  { header: "PDK", column: "W", flag: "PENDEK" },
  { header: "S.PDK", column: "X", flag: "SANGAT_PENDEK" },
  { header: "BGM", column: "Y", flag: "BGM" },
  { header: "KRS", column: "Z", flag: "KURUS" },
  { header: "S.KRS", column: "AA", flag: "SANGAT_KURUS" },
  { header: "GMK", column: "AB", flag: "GEMUK" },
  { header: "MSL", column: "AC", flag: "BERMASALAH" },
  { header: "CALON", column: "AD", flag: "CALON_KURUS" },
  { header: "BBK", column: "AH", flag: "BBK" },
]

const label = (key: NutritionCategory | null) =>
  key === null ? "" : CATEGORY_LABELS[key]

const round = (value: number | null, digits: number) =>
  value === null ? null : Number(value.toFixed(digits))

function bmi(entry: ListedChild): number | null {
  if (entry.weightKg === null || entry.heightCm === null) return null
  if (entry.heightCm <= 0) return null
  return round(entry.weightKg / (entry.heightCm / 100) ** 2, 1)
}

/** Penjelasan status yang tidak normal untuk satu anak, mis. "TB/U: Pendek (z -2,30)". */
function abnormalStatuses(entry: ListedChild): string[] {
  const parts: [string, NutritionCategory | null, number | null][] = [
    ["TB/U", entry.hazCategory, entry.haz],
    ["BB/U", entry.wazCategory, entry.waz],
    ["BB/TB", entry.whzCategory, entry.whz],
  ]
  return parts
    .filter(
      ([, category]) => category !== null && !NORMAL_CATEGORIES.has(category)
    )
    .map(([name, category, z]) => {
      const zText = z === null ? "" : ` (z ${z.toFixed(2).replace(".", ",")})`
      return `${name}: ${label(category)}${zText}`
    })
}

type Cell = XLSX.CellObject
const text = (value: string): Cell => ({ t: "s", v: value })
const num = (value: number): Cell => ({ t: "n", v: value })

function put(
  sheet: XLSX.WorkSheet,
  letters: string,
  row: number,
  cell: Cell | null
): void {
  if (cell === null) return
  sheet[XLSX.utils.encode_cell({ r: row - 1, c: columnIndex(letters) })] = cell
}

const numOrNull = (value: number | null): Cell | null =>
  value === null ? null : num(value)

/**
 * Berkas Excel berformat sheet PSG workbook ASP ("Penentuan status gizi"): kolom masukan
 * (nama, jenis kelamin, tanggal timbang dan lahir, BB, TB) diisi dari data, lalu sistem mengisi
 * umur, tiga z-score, tiga status, IMT, dan penanda PDK/BGM/dst. Kolom "PERLU DICEK" dan
 * "KETERANGAN" memberi tahu anak yang statusnya tidak normal atau datanya dicurigai salah
 * (mis. TB 814 cm), supaya bisa diukur ulang lalu diperbarui lewat daftar ukur ulang.
 *
 * Status gizi dihitung mesin WHO 2006 + Permenkes 2/2020, BUKAN tabel PSG workbook; angka di
 * dekat batas bisa berbeda tipis. Berkas memuat NAMA dan TANGGAL LAHIR anak (data pribadi).
 * Nama ditulis sebagai sel teks bertipe string, bukan rumus.
 */
export function buildPsgWorkbook(
  month: string,
  status: StatusLists,
  meta: PsgWorkbookMeta,
  recheck: readonly RecheckEntry[] = []
): Uint8Array {
  const entries = status.all
  const flagsOf = entries.map((entry) => statusFlagsOf(entry))
  const total = entries.length
  const count = (flag: keyof StatusFlags) =>
    flagsOf.filter((flags) => flags[flag]).length
  const reasonsByChild = new Map(
    recheck.map((entry) => [
      entry.childId,
      entry.reasons.map((reason) => reason.message),
    ])
  )

  const sheet: XLSX.WorkSheet = {}
  const lines = [
    "PENENTUAN STATUS GIZI (format sheet PSG, dihitung OpenASP)",
    `Periode: ${formatMonth(month)} · Posyandu: ${meta.scope ?? "Semua Posyandu"} · Dibuat: ${meta.generatedOn}`,
    "PERHATIAN: berkas ini memuat nama dan tanggal lahir anak. Simpan dan bagikan hanya kepada petugas yang berkepentingan.",
    meta.validated
      ? "Mesin antropometri telah ditinjau tenaga kesehatan."
      : "PERHATIAN: status gizi belum divalidasi tenaga kesehatan dan tidak boleh dipakai untuk keputusan layanan gizi. Memakai WHO 2006 dan Permenkes 2/2020, bukan tabel bawaan workbook ASP.",
  ]
  lines.forEach((line, index) => put(sheet, "B", index + 1, text(line)))

  // Ringkasan jumlah dan persen di atas kolom penanda.
  put(sheet, "V", 4, text("JML"))
  put(sheet, "V", 5, text("%"))
  for (const column of PSG_FLAG_COLUMNS) {
    put(sheet, column.column, 4, num(count(column.flag)))
    put(
      sheet,
      column.column,
      5,
      num(total === 0 ? 0 : round((count(column.flag) * 100) / total, 1)!)
    )
  }

  // Judul kolom (baris 6 dan 7), sama dengan sheet PSG workbook.
  const head = PSG_HEADER_ROW
  const sub = head + 1
  const headers: [string, number, string][] = [
    [OUT.no, head, "NO"],
    [PSG_COLUMNS.name, head, "NAMA"],
    [PSG_COLUMNS.sex, head, "Sex"],
    [PSG_COLUMNS.sex, sub, "L=1,P=2"],
    [PSG_COLUMNS.measureDay, head, "Tg.Timbang"],
    [PSG_COLUMNS.measureDay, sub, "Tg"],
    [PSG_COLUMNS.measureMonth, sub, "Bln"],
    [PSG_COLUMNS.measureYear, sub, "Thn"],
    [PSG_COLUMNS.birthDay, head, "Tgl.Lahir"],
    [PSG_COLUMNS.birthDay, sub, "Tg"],
    [PSG_COLUMNS.birthMonth, sub, "Bln"],
    [PSG_COLUMNS.birthYear, sub, "Thn"],
    [OUT.umur, head, "Umur"],
    [OUT.umur, sub, "( Bln )"],
    [PSG_COLUMNS.weightKg, head, "BB"],
    [PSG_COLUMNS.weightKg, sub, "( Kg )"],
    [PSG_COLUMNS.heightCm, head, "TB"],
    [PSG_COLUMNS.heightCm, sub, "( Cm )"],
    [OUT.zHaz, head, "NILAI Z_SCORE"],
    [OUT.zHaz, sub, "TB / U"],
    [OUT.zWaz, sub, "BB / U"],
    [OUT.zWhz, sub, "BB / TB"],
    [OUT.statusHaz, head, "STATUS GIZI"],
    [OUT.statusHaz, sub, "TB / U"],
    [OUT.statusWaz, sub, "BB / U"],
    [OUT.statusWhz, sub, "BB / TB"],
    [OUT.imt, head, "IMT"],
    [OUT.recheck, head, "PERLU DICEK"],
    [PSG_COLUMNS.posyandu, head, "POSY"],
    [OUT.note, head, "KETERANGAN"],
    ...PSG_FLAG_COLUMNS.map((c): [string, number, string] => [
      c.column,
      sub,
      c.header,
    ]),
  ]
  for (const [column, row, value] of headers) {
    put(sheet, column, row, text(value))
  }

  entries.forEach((entry, index) => {
    const row = PSG_FIRST_DATA_ROW + index
    const measured = entry.measuredAt.split("-").map(Number)
    const born = entry.birthDate.split("-").map(Number)
    put(sheet, OUT.no, row, num(index + 1))
    put(sheet, PSG_COLUMNS.name, row, text(entry.name))
    put(sheet, PSG_COLUMNS.sex, row, num(entry.sex === "M" ? 1 : 2))
    put(sheet, PSG_COLUMNS.measureDay, row, num(measured[2]))
    put(sheet, PSG_COLUMNS.measureMonth, row, num(measured[1]))
    put(sheet, PSG_COLUMNS.measureYear, row, num(measured[0] % 100))
    put(sheet, PSG_COLUMNS.birthDay, row, num(born[2]))
    put(sheet, PSG_COLUMNS.birthMonth, row, num(born[1]))
    put(sheet, PSG_COLUMNS.birthYear, row, num(born[0] % 100))
    put(sheet, OUT.umur, row, numOrNull(entry.ageMonths))
    put(sheet, PSG_COLUMNS.weightKg, row, numOrNull(entry.weightKg))
    put(sheet, PSG_COLUMNS.heightCm, row, numOrNull(entry.heightCm))
    put(sheet, OUT.zHaz, row, numOrNull(round(entry.haz, 2)))
    put(sheet, OUT.zWaz, row, numOrNull(round(entry.waz, 2)))
    put(sheet, OUT.zWhz, row, numOrNull(round(entry.whz, 2)))
    put(sheet, OUT.statusHaz, row, text(label(entry.hazCategory)))
    put(sheet, OUT.statusWaz, row, text(label(entry.wazCategory)))
    put(sheet, OUT.statusWhz, row, text(label(entry.whzCategory)))
    put(sheet, OUT.imt, row, numOrNull(bmi(entry)))
    put(sheet, PSG_COLUMNS.posyandu, row, text(entry.posyandu ?? ""))
    PSG_FLAG_COLUMNS.forEach((column) => {
      put(sheet, column.column, row, num(flagsOf[index][column.flag] ? 1 : 0))
    })

    const notes = [
      ...abnormalStatuses(entry),
      ...(reasonsByChild.get(entry.childId) ?? []),
    ]
    if (notes.length > 0) {
      put(sheet, OUT.recheck, row, text("YA"))
      put(sheet, OUT.note, row, text(notes.join(" ")))
    }
  })

  sheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: {
      r: Math.max(PSG_FIRST_DATA_ROW, PSG_FIRST_DATA_ROW + total - 1) - 1,
      c: columnIndex(OUT.note),
    },
  })
  sheet["!cols"] = Array.from(
    { length: columnIndex(OUT.note) + 1 },
    (_, i) => ({
      wch:
        i === columnIndex(PSG_COLUMNS.name)
          ? 28
          : i === columnIndex(OUT.note)
            ? 90
            : i >= columnIndex(OUT.statusHaz) && i <= columnIndex(OUT.statusWhz)
              ? 20
              : 9,
    })
  )

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, PSG_SHEET_NAME)
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }))
}
