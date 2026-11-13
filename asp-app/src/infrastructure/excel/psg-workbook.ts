import type { Buffer as ExcelBuffer, Cell, Worksheet } from "exceljs"

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
 * Kolom hasil hitungan di luar kolom masukan (C–M, AG) yang didefinisikan adapter PSG. Posisinya
 * sama dengan template PSG, jadi berkas hasil ini juga dikenali adapter PSG. Kolom V–AF
 * disembunyikan oleh template; kolom tambahan diletakkan di kanan POSY (AG).
 */
const OUT = {
  umur: "K",
  zHaz: "N",
  zWaz: "O",
  zWhz: "P",
  statusHaz: "Q",
  statusWaz: "R",
  statusWhz: "S",
  imt: "U",
  recheck: "AH",
  note: "AI",
} as const

/** Kolom penanda (1/0) PDK, S.PDK, BGM, KRS, S.KRS, GMK, MSL, CALON, BBK, di kanan KETERANGAN. */
export const PSG_FLAG_COLUMNS: readonly {
  header: string
  column: string
  flag: keyof StatusFlags
}[] = [
  { header: "PDK", column: "AJ", flag: "PENDEK" },
  { header: "S.PDK", column: "AK", flag: "SANGAT_PENDEK" },
  { header: "BGM", column: "AL", flag: "BGM" },
  { header: "KRS", column: "AM", flag: "KURUS" },
  { header: "S.KRS", column: "AN", flag: "SANGAT_KURUS" },
  { header: "GMK", column: "AO", flag: "GEMUK" },
  { header: "MSL", column: "AP", flag: "BERMASALAH" },
  { header: "CALON", column: "AQ", flag: "CALON_KURUS" },
  { header: "BBK", column: "AR", flag: "BBK" },
]

/** Warna penanda: baris yang perlu perhatian dan teks status yang tidak normal. */
const ATTENTION_FILL = "FFFFC7CE"
const ABNORMAL_TEXT = "FFC00000"

/** Jumlah baris isian yang sudah disediakan (berborder dan berwarna) oleh template. */
const TEMPLATE_ROWS = 100

const label = (key: NutritionCategory | null) =>
  key === null ? "" : CATEGORY_LABELS[key]

const round = (value: number | null, digits: number) =>
  value === null ? null : Number(value.toFixed(digits))

function bmi(entry: ListedChild): number | null {
  if (entry.weightKg === null || entry.heightCm === null) return null
  if (entry.heightCm <= 0) return null
  return round(entry.weightKg / (entry.heightCm / 100) ** 2, 1)
}

const isNormal = (category: NutritionCategory | null) =>
  category === null || NORMAL_CATEGORIES.has(category)

/** Penjelasan status yang tidak normal untuk satu anak, mis. "TB/U: Pendek (z -2,30)". */
function abnormalStatuses(entry: ListedChild): string[] {
  const parts: [string, NutritionCategory | null, number | null][] = [
    ["TB/U", entry.hazCategory, entry.haz],
    ["BB/U", entry.wazCategory, entry.waz],
    ["BB/TB", entry.whzCategory, entry.whz],
  ]
  return parts
    .filter(([, category]) => !isNormal(category))
    .map(([name, category, z]) => {
      const zText = z === null ? "" : ` (z ${z.toFixed(2).replace(".", ",")})`
      return `${name}: ${label(category)}${zText}`
    })
}

async function loadExcelJs() {
  const loaded = await import("exceljs")
  return (loaded as { default?: typeof import("exceljs") }).default ?? loaded
}

/** Menyalin gaya satu sel ke sel lain. */
function copyStyle(from: Cell, to: Cell): void {
  to.style = { ...from.style }
}

/**
 * Gaya sel yang dimuat dari berkas dipakai BERSAMA oleh semua sel yang gayanya sama, sehingga
 * mengubah warna satu sel akan ikut mengubah sel lain. Beri sel ini salinan gaya sendiri sebelum
 * mengubahnya.
 */
function own(cell: Cell): Cell {
  cell.style = { ...cell.style }
  return cell
}

/**
 * Berkas Excel hasil pemeriksaan berformat sheet PSG, dibuat dengan MENGISI berkas template PSG
 * (`template`), sehingga tampilannya (pita judul, header hijau, kolom berwarna) sama dengan
 * template. Kolom masukan (nama, jenis kelamin, tanggal timbang dan lahir, BB, TB, Posyandu)
 * diisi dari data, lalu OpenASP mengisi umur, tiga z-score, tiga status, dan IMT.
 *
 * Di kanan POSY ada kolom PERLU DICEK dan KETERANGAN untuk anak yang statusnya tidak normal atau
 * datanya dicurigai salah (mis. TB 814 cm), lalu penanda 1/0 PDK/BGM/dst. dengan ringkasan JML
 * dan persen. Baris anak yang perlu perhatian dan status yang tidak normal diberi warna merah.
 *
 * Status gizi dihitung mesin WHO 2006 + Permenkes 2/2020, BUKAN tabel PSG workbook; angka di
 * dekat batas bisa berbeda tipis. Berkas memuat NAMA dan TANGGAL LAHIR anak (data pribadi).
 */
export async function buildPsgWorkbook(
  month: string,
  status: StatusLists,
  meta: PsgWorkbookMeta,
  recheck: readonly RecheckEntry[],
  template: Uint8Array
): Promise<Uint8Array> {
  const ExcelJS = await loadExcelJs()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(template as unknown as ExcelBuffer)
  const sheet = workbook.getWorksheet(PSG_SHEET_NAME)
  if (!sheet) throw new Error("Template PSG tidak memuat sheet PSG.")
  const instructions = workbook.getWorksheet("Petunjuk")
  if (instructions) workbook.removeWorksheet(instructions.id)

  const entries = status.all
  const total = entries.length
  const flagsOf = entries.map((entry) => statusFlagsOf(entry))
  const reasonsByChild = new Map(
    recheck.map((entry) => [
      entry.childId,
      entry.reasons.map((reason) => reason.message),
    ])
  )

  // Judul: tiga baris pita biru dan satu baris keterangan, sama seperti template.
  sheet.getCell("B2").value =
    `HASIL PEMERIKSAAN STATUS GIZI · ${formatMonth(month)}`
  sheet.getCell("B3").value =
    `${meta.scope ?? "Semua Posyandu"} · dibuat ${meta.generatedOn} · WHO 2006 dan Permenkes 2/2020 (OpenASP)`
  const hint = sheet.getCell("B4")
  hint.value = [
    "PERHATIAN: berkas ini memuat nama dan tanggal lahir anak. Simpan dan bagikan hanya kepada petugas yang berkepentingan.",
    meta.validated
      ? "Mesin antropometri telah ditinjau tenaga kesehatan."
      : "Status gizi belum divalidasi tenaga kesehatan dan tidak boleh dipakai untuk keputusan layanan gizi. Baris merah perlu diukur ulang atau dicek.",
  ].join("\n")
  own(hint).alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  }
  sheet.getRow(4).height = 40

  // Baris data: template menyediakan 100 baris; kelebihannya meniru gaya baris pertama,
  // dan baris yang tidak terpakai dibuang agar tidak ada nomor urut tanpa anak.
  const lastStyledColumn = columnIndex("AG") + 1
  for (let index = TEMPLATE_ROWS; index < total; index++) {
    const row = PSG_FIRST_DATA_ROW + index
    for (let c = 1; c <= lastStyledColumn; c++) {
      copyStyle(sheet.getCell(PSG_FIRST_DATA_ROW, c), sheet.getCell(row, c))
    }
    sheet.getCell(`B${row}`).value = index + 1
  }
  // Baris bawaan template yang tidak terpakai dikosongkan (nilai dan gaya), bukan dibuang dengan
  // spliceRows yang tidak andal untuk jumlah baris besar. Tanpa anak, satu baris kosong tetap ada.
  for (
    let row = PSG_FIRST_DATA_ROW + Math.max(total, 1);
    row < PSG_FIRST_DATA_ROW + TEMPLATE_ROWS;
    row++
  ) {
    for (let c = 1; c <= lastStyledColumn; c++) {
      const cell = sheet.getCell(row, c)
      cell.value = null
      cell.style = {}
    }
  }

  addExtraColumns(sheet, total, flagsOf)

  entries.forEach((entry, index) => {
    const row = PSG_FIRST_DATA_ROW + index
    const set = (letters: string, value: string | number | null) => {
      if (value !== null) sheet.getCell(`${letters}${row}`).value = value
    }
    const measured = entry.measuredAt.split("-").map(Number)
    const born = entry.birthDate.split("-").map(Number)

    set(PSG_COLUMNS.name, entry.name)
    set(PSG_COLUMNS.sex, entry.sex === "M" ? 1 : 2)
    set(PSG_COLUMNS.measureDay, measured[2])
    set(PSG_COLUMNS.measureMonth, measured[1])
    set(PSG_COLUMNS.measureYear, measured[0] % 100)
    set(PSG_COLUMNS.birthDay, born[2])
    set(PSG_COLUMNS.birthMonth, born[1])
    set(PSG_COLUMNS.birthYear, born[0] % 100)
    set(OUT.umur, entry.ageMonths)
    set(PSG_COLUMNS.weightKg, entry.weightKg)
    set(PSG_COLUMNS.heightCm, entry.heightCm)
    set(OUT.zHaz, round(entry.haz, 2))
    set(OUT.zWaz, round(entry.waz, 2))
    set(OUT.zWhz, round(entry.whz, 2))
    set(OUT.statusHaz, label(entry.hazCategory) || null)
    set(OUT.statusWaz, label(entry.wazCategory) || null)
    set(OUT.statusWhz, label(entry.whzCategory) || null)
    set(OUT.imt, bmi(entry))
    set(PSG_COLUMNS.posyandu, entry.posyandu ?? "")

    for (const letters of [OUT.zHaz, OUT.zWaz, OUT.zWhz]) {
      own(sheet.getCell(`${letters}${row}`)).numFmt = "0.00"
    }
    own(sheet.getCell(`${OUT.imt}${row}`)).numFmt = "0.0"

    // Status yang tidak normal berwarna merah tebal.
    const abnormal: [string, NutritionCategory | null][] = [
      [OUT.statusHaz, entry.hazCategory],
      [OUT.statusWaz, entry.wazCategory],
      [OUT.statusWhz, entry.whzCategory],
    ]
    for (const [letters, category] of abnormal) {
      if (isNormal(category)) continue
      const cell = own(sheet.getCell(`${letters}${row}`))
      cell.font = {
        ...cell.font,
        bold: true,
        color: { argb: ABNORMAL_TEXT },
      }
    }

    PSG_FLAG_COLUMNS.forEach((column) => {
      sheet.getCell(`${column.column}${row}`).value = flagsOf[index][
        column.flag
      ]
        ? 1
        : 0
    })

    const notes = [
      ...abnormalStatuses(entry),
      ...(reasonsByChild.get(entry.childId) ?? []),
    ]
    if (notes.length > 0) {
      sheet.getCell(`${OUT.recheck}${row}`).value = "YA"
      sheet.getCell(`${OUT.note}${row}`).value = notes.join(" ")
      for (const letters of [PSG_COLUMNS.name, OUT.recheck]) {
        own(sheet.getCell(`${letters}${row}`)).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: ATTENTION_FILL },
        }
      }
    }
  })

  return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer)
}

/**
 * Kolom di kanan POSY yang tidak ada pada template: PERLU DICEK, KETERANGAN, penanda 1/0, serta
 * ringkasan JML dan persen di atas penanda. Gayanya diambil dari sel template yang sudah ada.
 */
function addExtraColumns(
  sheet: Worksheet,
  total: number,
  flagsOf: ReturnType<typeof statusFlagsOf>[]
): void {
  const headerTop = sheet.getCell("AG6")
  const headerSub = sheet.getCell("AG7")
  const body = sheet.getCell("L9") // sel putih berborder

  const header = (letters: string, top: string, sub: string) => {
    const topCell = sheet.getCell(`${letters}6`)
    const subCell = sheet.getCell(`${letters}7`)
    topCell.value = top
    subCell.value = sub
    copyStyle(headerTop, topCell)
    copyStyle(headerSub, subCell)
  }

  header(OUT.recheck, "PERLU", "DICEK")
  header(OUT.note, "KETERANGAN", "Alasan perlu dicek atau status tidak normal")
  for (const column of PSG_FLAG_COLUMNS)
    header(column.column, column.header, "")

  sheet.getColumn(columnIndex(OUT.recheck) + 1).width = 9
  sheet.getColumn(columnIndex(OUT.note) + 1).width = 80
  for (const column of PSG_FLAG_COLUMNS) {
    sheet.getColumn(columnIndex(column.column) + 1).width = 7
  }

  const lastRow = PSG_FIRST_DATA_ROW + Math.max(total, 1) - 1
  for (let row = PSG_FIRST_DATA_ROW; row <= lastRow; row++) {
    for (const letters of [
      OUT.recheck,
      OUT.note,
      ...PSG_FLAG_COLUMNS.map((c) => c.column),
    ]) {
      const cell = sheet.getCell(`${letters}${row}`)
      copyStyle(body, cell)
      if (letters === OUT.note) {
        cell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        }
      }
    }
  }

  // Ringkasan jumlah dan persen anak per penanda, di atas kolom penanda.
  const labelCell = (letters: string, row: number, value: string) => {
    const cell = own(sheet.getCell(`${letters}${row}`))
    cell.value = value
    cell.font = { name: "Arial", size: 9, bold: true }
    cell.alignment = { horizontal: "right", vertical: "middle" }
  }
  labelCell(OUT.note, 4, "JML")
  labelCell(OUT.note, 5, "%")
  for (const column of PSG_FLAG_COLUMNS) {
    const count = flagsOf.filter((flags) => flags[column.flag]).length
    const jml = sheet.getCell(`${column.column}4`)
    jml.value = count
    jml.font = { name: "Arial", size: 9, bold: true }
    jml.alignment = { horizontal: "center", vertical: "middle" }
    const pct = sheet.getCell(`${column.column}5`)
    pct.value = total === 0 ? 0 : round((count * 100) / total, 1)
    pct.font = { name: "Arial", size: 9 }
    pct.alignment = { horizontal: "center", vertical: "middle" }
  }
}
