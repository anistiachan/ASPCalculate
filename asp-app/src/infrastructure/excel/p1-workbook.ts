import type { Cell, Workbook, Worksheet } from "exceljs"

import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { REMEASURED_NOTE_PREFIX } from "@/domain/reporting/corrections"
import {
  ASI_MAX_AGE,
  VITAMIN_A_BLUE_AGE,
  VITAMIN_A_RED_AGE,
} from "@/domain/reporting/lists"
import {
  calendarAgeMonths,
  classifyChild,
  SKDN_MAX_AGE_EXCLUSIVE,
} from "@/domain/reporting/skdn"
import {
  CHILD_COLUMNS,
  columnIndex,
  DEFAULT_MEASURE_DAY,
  FIRST_DATA_ROW,
  HEADER_CELLS,
  LAST_DATA_ROW,
  MONTH_COLUMNS,
  type MonthColumns,
} from "@/features/excel-import/adapters/karangtawar/layout"

/*
 * Sheet Posyandu (P1, P2, …) bergaya workbook ASP Karangtawar: judul "HASIL PENGUKURAN
 * ANTROPOMETRI BALITA", header tiga baris bertingkat, blok per bulan (Umur, BB, TB; Februari dan
 * Agustus ditambah Vitamin A dan ASI-E), serta blok "STATUS PERTUMBUHAN" (N/T/B/O) di kanan.
 * Posisi kolom sama dengan workbook (lihat adapter Karangtawar), jadi hasilnya bisa dibaca
 * kembali oleh adapter yang sama. Dipakai untuk ekspor rekap dan untuk template kosong.
 *
 * exceljs dimuat malas (dynamic import) supaya hanya diunduh browser saat tombol unduh ditekan.
 */

export type P1WorkbookMeta = {
  generatedOn: string
  /** Tahun data (empat digit); Nov/Des tahun sebelumnya ikut sebagai kolom awal. */
  year: number
  validated: boolean
}

const MAX_ROWS_PER_SHEET = LAST_DATA_ROW - FIRST_DATA_ROW + 1
const TEMPLATE_ROWS = 100
const FONT = "Arial"

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MART",
  "APR",
  "MEI",
  "JUNI",
  "JULI",
  "AGUSTUS",
  "SEPT",
  "OKT",
  "NOV",
  "DES",
]

const COLORS = {
  yellowSoft: "FFFFFF99",
  yellow: "FFFFFF00",
  status: "FFFFFF66",
  red: "FFFF0000",
  pink: "FFFF33CC",
  pinkHeader: "FFFF3399",
  blue: "FFB4C7E7",
  black: "FF000000",
  header: "FFF2F2F2",
}

/** Nama kolom Excel dari indeks berbasis nol. */
function letters(index: number): string {
  let n = index + 1
  let result = ""
  while (n > 0) {
    const rest = (n - 1) % 26
    result = String.fromCharCode(65 + rest) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}

const col = (name: string) => columnIndex(name) + 1 // exceljs: berbasis satu

type MonthGeometry = {
  month: number
  columns: MonthColumns
  age: string
  weight: string
  height: string
  /** Kolom pertama dan terakhir blok bulan (untuk sel gabungan judul). */
  first: string
  last: string
}

const MONTHS: MonthGeometry[] = MONTH_COLUMNS.filter(
  (c) => c.yearOffset === 0
).map((columns) => {
  const weightIndex = columnIndex(columns.weight)
  const age = letters(weightIndex - 1)
  const height = letters(weightIndex + 1)
  return {
    month: columns.month,
    columns,
    age,
    weight: columns.weight,
    height,
    first: age,
    last: columns.asiNo ?? height,
  }
})

const STATUS_FIRST = "BV"
const statusLetter = (month: number) =>
  letters(columnIndex(STATUS_FIRST) + month - 1)
const LAST_COLUMN = statusLetter(12)

/** Kolom yang dipakai Februari dan Agustus untuk Vitamin A dan ASI-E (berwarna khusus). */
const isSpecialMonth = (g: MonthGeometry) => g.columns.vitaminABlue !== null

const thin = { style: "thin" as const, color: { argb: "FF808080" } }
const BORDER = { top: thin, left: thin, bottom: thin, right: thin }

function style(
  cell: Cell,
  options: {
    fill?: string
    bold?: boolean
    size?: number
    color?: string
    align?: "left" | "center"
    wrap?: boolean
  } = {}
): void {
  cell.font = {
    name: FONT,
    size: options.size ?? 8,
    bold: options.bold ?? false,
    color: options.color ? { argb: options.color } : undefined,
  }
  cell.alignment = {
    horizontal: options.align ?? "center",
    vertical: "middle",
    wrapText: options.wrap ?? false,
  }
  if (options.fill) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: options.fill },
    }
  }
  cell.border = BORDER
}

type Entry = {
  child: StoredChild
  /** Pengukuran terakhir per bulan pada tahun data (kunci: kolom bulan). */
  cells: Map<MonthColumns, StoredMeasurement>
  all: StoredMeasurement[]
}

/** Kolom bulan untuk satu pengukuran, atau null bila di luar tahun data. */
function monthColumnsFor(
  measuredAt: string,
  dataYear: number
): MonthColumns | null {
  const year = Number(measuredAt.slice(0, 4))
  const month = Number(measuredAt.slice(5, 7))
  if (year === dataYear) {
    return (
      MONTH_COLUMNS.find((c) => c.yearOffset === 0 && c.month === month) ?? null
    )
  }
  if (year === dataYear - 1 && month >= 11) {
    return (
      MONTH_COLUMNS.find((c) => c.yearOffset === -1 && c.month === month) ??
      null
    )
  }
  return null
}

function buildSheet(
  workbook: Workbook,
  name: string,
  posyandu: string | null,
  entries: readonly Entry[],
  year: number,
  options: { template: boolean; title: string }
): Worksheet {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", xSplit: col("N"), ySplit: 8 }],
  })
  sheet.properties.defaultRowHeight = 13

  // Lebar kolom.
  const width = (from: string, to: string, value: number) => {
    for (let c = col(from); c <= col(to); c++) sheet.getColumn(c).width = value
  }
  // Kolom kode wilayah memuat judul "Kab / Kota", "Kecamatan", dan "(Kode BPS)".
  width("A", "C", 11)
  width("D", "E", 6.5)
  sheet.getColumn(col("F")).width = 9 // "Panjang"
  sheet.getColumn(col("G")).width = 12
  sheet.getColumn(col("H")).width = 7
  sheet.getColumn(col("I")).width = 14
  width("J", "K", 4.5)
  sheet.getColumn(col("L")).width = 14
  sheet.getColumn(col("M")).width = 4.5
  sheet.getColumn(col("N")).width = 30
  sheet.getColumn(col("O")).width = 5.5
  width("P", "U", 4.5)
  width("V", "Y", 5.5)
  width("Z", "AC", 6)
  // Judul "Bln Pertma Timbang" dan "UMUR Bln JAN" butuh kolom lebih lebar.
  sheet.getColumn(col("Z")).width = 9
  sheet.getColumn(col("AC")).width = 9
  for (const g of MONTHS) {
    sheet.getColumn(col(g.age)).width = 5
    sheet.getColumn(col(g.weight)).width = 5.5
    sheet.getColumn(col(g.height)).width = 5.5
    for (const extra of [
      g.columns.vitaminABlue,
      g.columns.vitaminARed,
      g.columns.asiYes,
      g.columns.asiNo,
    ]) {
      if (extra) sheet.getColumn(col(extra)).width = 5.5
    }
  }
  width(STATUS_FIRST, LAST_COLUMN, 4)

  // Judul.
  sheet.mergeCells("L3:AC3")
  const title = sheet.getCell("L3")
  title.value = options.title
  title.font = { name: FONT, size: 12, bold: true }
  title.alignment = { horizontal: "left", vertical: "middle" }
  if (posyandu) {
    const label = sheet.getCell("L4")
    label.value = `POSYANDU: ${posyandu}`
    label.font = { name: FONT, size: 9, bold: true }
  }

  // Header (baris 6–8). L7 dan N7 dipakai adapter untuk mengenali sheet.
  const head = (
    address: string,
    value: string,
    opts: Parameters<typeof style>[1] = {}
  ) => {
    const cell = sheet.getCell(address)
    cell.value = value
    style(cell, { bold: true, fill: COLORS.header, wrap: true, ...opts })
  }
  const merge = (
    range: string,
    value: string,
    opts: Parameters<typeof style>[1] = {}
  ) => {
    sheet.mergeCells(range)
    head(range.split(":")[0], value, opts)
    // Beri border pada seluruh sel gabungan.
    const [a, b] = range.split(":")
    const rowNo = Number(a.replace(/\D/g, ""))
    for (
      let c = col(a.replace(/\d/g, ""));
      c <= col(b.replace(/\d/g, ""));
      c++
    ) {
      sheet.getCell(rowNo, c).border = BORDER
    }
  }

  for (const [letter, label, kode] of [
    ["A", "Kode", "PROV"],
    ["B", "Kode", "Kab / Kota"],
    ["C", "Kode", "Kecamatan"],
  ] as const) {
    head(`${letter}6`, label)
    head(`${letter}7`, kode)
    head(`${letter}8`, "(Kode BPS)")
  }
  head("D6", "Anak")
  head("D7", "Ke....")
  head("E6", "BB")
  head("E7", "Lahir")
  head("F6", "Panjang")
  head("F7", "Lahir")
  head("G6", "NIK Anak")
  head("G7", "( 1 atau 2")
  head("G8", "digit )")
  head("H6", "Buku")
  head("H7", "KIA")
  head("I6", "Nama", { fill: COLORS.yellowSoft })
  head("I7", "ORTU", { fill: COLORS.yellowSoft })
  head("J6", "RT", { fill: COLORS.yellowSoft })
  head("K6", "RW", { fill: COLORS.yellowSoft })
  head("J7", "", { fill: COLORS.yellowSoft })
  head("K7", "", { fill: COLORS.yellowSoft })
  head(`${HEADER_CELLS.posyandu}7`, "NAMA POSYANDU")
  head("M7", "No")
  head(`${HEADER_CELLS.name}7`, "NAMA ANAK")
  head("O6", "L / P")
  head("O7", "L = 1")
  head("O8", "P = 2")
  merge("P6:R6", "TGL. UKUR")
  head("P7", "TGL")
  head("Q7", "BLN")
  head("R7", "THN")
  merge("S6:U6", "TGL LAHIR")
  head("S7", "TGL")
  head("T7", "BLN")
  head("U7", "THN")
  merge("V6:Y6", "THN SEBELUMNYA")
  merge("V7:W7", "NOV")
  merge("X7:Y7", "DES")
  head("V8", "BB")
  head("W8", "TB")
  head("X8", "BB")
  head("Y8", "TB")
  head("Z6", "Bln")
  head("Z7", "Pertma")
  head("Z8", "Timbang")
  head("AA7", "IMD")
  head("AB6", "BBLR")
  head("AC6", "UMUR")
  head("AC7", "Bln JAN")

  for (const g of MONTHS) {
    const special = isSpecialMonth(g)
    merge(`${g.first}6:${g.last}6`, MONTH_LABELS[g.month - 1], {
      fill: special ? COLORS.pinkHeader : COLORS.header,
      color: special ? "FFFFFFFF" : undefined,
      size: 9,
    })
    head(`${g.age}7`, "Umur")
    head(`${g.age}8`, "( Bln )")
    head(`${g.weight}7`, "BB")
    head(`${g.weight}8`, "( Kg )")
    head(`${g.height}7`, "TB")
    head(`${g.height}8`, "( Cm )")
    if (special) {
      head(`${g.columns.vitaminABlue}7`, "Vit.A", { fill: COLORS.blue })
      head(`${g.columns.vitaminABlue}8`, "Biru", { fill: COLORS.blue })
      head(`${g.columns.vitaminARed}7`, "Vit.A", { fill: COLORS.pink })
      head(`${g.columns.vitaminARed}8`, "Merah", { fill: COLORS.pink })
      merge(`${g.columns.asiYes}7:${g.columns.asiNo}7`, "ASI-E", {
        fill: COLORS.yellow,
      })
      head(`${g.columns.asiYes}8`, "Ya", { fill: COLORS.yellow })
      head(`${g.columns.asiNo}8`, "Tdk", { fill: COLORS.yellow })
    }
  }
  merge(`${STATUS_FIRST}6:${LAST_COLUMN}6`, "STATUS PERTUMBUHAN", {
    fill: COLORS.yellow,
    size: 9,
  })
  for (let m = 1; m <= 12; m++) {
    head(`${statusLetter(m)}7`, String(m), { fill: COLORS.yellow })
    head(`${statusLetter(m)}8`, "", { fill: COLORS.yellow })
  }
  sheet.getRow(6).height = 18
  sheet.getRow(7).height = 16
  sheet.getRow(8).height = 16

  // Kolom berwarna tetap (seperti sheet asli): sebagian untuk diisi, sebagian hasil hitungan.
  const columnFill = new Map<string, string>()
  for (const letter of ["I", "J", "K"])
    columnFill.set(letter, COLORS.yellowSoft)
  for (const g of MONTHS) {
    if (!isSpecialMonth(g)) continue
    columnFill.set(g.age, COLORS.red)
    columnFill.set(g.columns.vitaminABlue!, COLORS.blue)
    columnFill.set(g.columns.vitaminARed!, COLORS.pink)
    columnFill.set(g.columns.asiYes!, COLORS.yellow)
    columnFill.set(g.columns.asiNo!, COLORS.yellow)
  }
  for (let m = 1; m <= 12; m++) columnFill.set(statusLetter(m), COLORS.status)

  const total = options.template ? TEMPLATE_ROWS : entries.length
  const lastColumnIndex = columnIndex(LAST_COLUMN) + 1
  for (let index = 0; index < total; index++) {
    const rowNumber = FIRST_DATA_ROW + index
    for (let c = 1; c <= lastColumnIndex; c++) {
      const cell = sheet.getCell(rowNumber, c)
      const letter = letters(c - 1)
      style(cell, {
        fill: columnFill.get(letter),
        align:
          letter === "N" || letter === "L" || letter === "I"
            ? "left"
            : "center",
        bold: columnFill.get(letter) === COLORS.status,
        color: columnFill.get(letter) === COLORS.red ? "FFFFFFFF" : undefined,
      })
    }
    sheet.getCell(`M${rowNumber}`).value = index + 1
  }

  const put = (letter: string, row: number, value: string | number) => {
    sheet.getCell(`${letter}${row}`).value = value
  }

  entries.forEach(({ child, cells, all }, index) => {
    const row = FIRST_DATA_ROW + index
    put(CHILD_COLUMNS.name, row, child.name)
    put(CHILD_COLUMNS.posyandu, row, child.posyandu?.trim() || "TANPA POSYANDU")
    put(CHILD_COLUMNS.sex, row, child.sex === "M" ? 1 : 2)
    put(CHILD_COLUMNS.birthDay, row, Number(child.birthDate.slice(8, 10)))
    put(CHILD_COLUMNS.birthMonth, row, Number(child.birthDate.slice(5, 7)))
    put(CHILD_COLUMNS.birthYear, row, Number(child.birthDate.slice(2, 4)))
    put(CHILD_COLUMNS.referenceYear, row, year % 100)
    if (child.birthOrder !== null) {
      put(CHILD_COLUMNS.birthOrder, row, child.birthOrder)
    }
    if (child.birthWeightKg !== null) {
      put(CHILD_COLUMNS.birthWeightKg, row, child.birthWeightKg)
    }
    if (child.birthLengthCm !== null) {
      put(CHILD_COLUMNS.birthLengthCm, row, child.birthLengthCm)
    }

    // Satu hari per baris: hari pengukuran pertama tahun itu, bila masuk akal.
    const firstDay = Number(
      [...cells.values()]
        .map((m) => m.measuredAt)
        .sort()[0]
        .slice(8, 10)
    )
    put(
      CHILD_COLUMNS.firstMeasureDay,
      row,
      firstDay >= 1 && firstDay <= 28 ? firstDay : DEFAULT_MEASURE_DAY
    )

    // Umur kalender tiap bulan (seperti kolom Umur workbook); hitam bila di luar sasaran SKDN.
    for (const g of MONTHS) {
      const monthKey = `${year}-${String(g.month).padStart(2, "0")}`
      const age = calendarAgeMonths(child.birthDate, monthKey)
      if (age < 0) continue
      const cell = sheet.getCell(`${g.age}${row}`)
      cell.value = age
      if (age >= SKDN_MAX_AGE_EXCLUSIVE && !isSpecialMonth(g)) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.black },
        }
        cell.font = { name: FONT, size: 8, color: { argb: "FFFFFFFF" } }
      }
    }

    for (const [columns, m] of cells) {
      const remeasured = m.rowNote?.startsWith(REMEASURED_NOTE_PREFIX) ?? false
      const note = remeasured ? `Hasil ukur ulang. ${m.rowNote}` : null
      if (m.weightKg !== null) {
        const cell = sheet.getCell(`${columns.weight}${row}`)
        cell.value = m.weightKg
        if (note) cell.note = note
      }
      if (m.rawLengthHeightCm !== null && columns.height) {
        const cell = sheet.getCell(`${columns.height}${row}`)
        cell.value = m.rawLengthHeightCm
        if (note) cell.note = note
      }

      const age = calendarAgeMonths(
        child.birthDate,
        `${year + columns.yearOffset}-${String(columns.month).padStart(2, "0")}`
      )
      if (m.vitaminAStatus === true) {
        const blue =
          age >= VITAMIN_A_BLUE_AGE.min && age <= VITAMIN_A_BLUE_AGE.max
        const red = age >= VITAMIN_A_RED_AGE.min
        const target = blue
          ? columns.vitaminABlue
          : red
            ? columns.vitaminARed
            : null
        if (target) put(target, row, 1)
      }
      const asi = m.breastfeedingByMonth[age]
      if (age >= 0 && age <= ASI_MAX_AGE && (asi === true || asi === false)) {
        const target = asi ? columns.asiYes : columns.asiNo
        if (target) put(target, row, 1)
      }
    }

    // Status pertumbuhan N/T/B/O per bulan (prioritas sama dengan rumus workbook).
    for (let m = 1; m <= 12; m++) {
      const flags = classifyChild(
        child,
        all,
        `${year}-${String(m).padStart(2, "0")}`
      )
      const letter = flags.N
        ? "N"
        : flags.T
          ? "T"
          : flags.B
            ? "B"
            : flags.O
              ? "O"
              : ""
      if (letter) put(statusLetter(m), row, letter)
    }
  })

  if (options.template)
    addValidations(sheet, FIRST_DATA_ROW + TEMPLATE_ROWS - 1)
  return sheet
}

/** Validasi isian template: mencegah salah ketik sejak di Excel (mis. TB 814 atau bulan 13). */
function addValidations(sheet: Worksheet, lastRow: number): void {
  const add = (letter: string, rule: Record<string, unknown>) => {
    for (let r = FIRST_DATA_ROW; r <= lastRow; r++) {
      sheet.getCell(`${letter}${r}`).dataValidation = {
        allowBlank: true,
        showErrorMessage: true,
        errorStyle: "stop",
        ...rule,
      } as Cell["dataValidation"]
    }
  }
  const whole = (min: number, max: number, error: string) => ({
    type: "whole",
    operator: "between",
    formulae: [min, max],
    errorTitle: "Isian tidak valid",
    error,
  })
  const decimal = (min: number, max: number, title: string, error: string) => ({
    type: "decimal",
    operator: "between",
    formulae: [min, max],
    errorTitle: title,
    error,
  })

  add(
    CHILD_COLUMNS.sex,
    whole(1, 2, "Isi 1 untuk laki-laki atau 2 untuk perempuan.")
  )
  add(CHILD_COLUMNS.firstMeasureDay, whole(1, 28, "Hari timbang 1 sampai 28."))
  add(
    CHILD_COLUMNS.referenceYear,
    whole(0, 99, "Tahun dua digit, mis. 26 untuk 2026.")
  )
  add(CHILD_COLUMNS.birthDay, whole(1, 31, "Tanggal lahir harus 1 sampai 31."))
  add(CHILD_COLUMNS.birthMonth, whole(1, 12, "Bulan lahir harus 1 sampai 12."))
  add(
    CHILD_COLUMNS.birthYear,
    whole(0, 99, "Tahun dua digit, mis. 24 untuk 2024.")
  )

  const weight = decimal(
    1,
    30,
    "BB di luar rentang wajar",
    "BB balita biasanya 1 sampai 30 kg. Periksa titik desimal; kosongkan bila tidak ditimbang."
  )
  const height = decimal(
    35,
    130,
    "TB di luar rentang wajar",
    "TB balita biasanya 35 sampai 130 cm. Periksa titik desimal (mis. 81,4 bukan 814); kosongkan bila tidak diukur."
  )
  for (const columns of MONTH_COLUMNS) {
    add(columns.weight, weight)
    if (columns.height) add(columns.height, height)
  }
  for (const letter of ["V", "X"]) add(letter, weight)
  for (const letter of ["W", "Y"]) add(letter, height)
}

function notes(
  workbook: Workbook,
  name: string,
  lines: string[],
  width = 130
): void {
  const sheet = workbook.addWorksheet(name)
  sheet.getColumn(1).width = width
  lines.forEach((line, index) => {
    const cell = sheet.getCell(`A${index + 1}`)
    cell.value = line
    cell.font = { name: FONT, size: index === 0 ? 13 : 10, bold: index === 0 }
    cell.alignment = { wrapText: true, vertical: "top" }
  })
}

async function newWorkbook(): Promise<Workbook> {
  const loaded = await import("exceljs")
  const ExcelJS =
    (loaded as { default?: typeof import("exceljs") }).default ?? loaded
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "OpenASP"
  return workbook
}

async function toBytes(workbook: Workbook): Promise<Uint8Array> {
  return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer)
}

/**
 * Rekap format P1 beberapa bulan. Angka tidak diubah: berat dan tinggi apa adanya dari
 * pengukuran tersimpan.
 *
 * Keterbatasan format: TB hanya punya kolom isian untuk Januari, Februari, Agustus (serta Nov
 * dan Des tahun sebelumnya); TB bulan lain berupa rumus di workbook sehingga tidak diekspor.
 * Tanggal ukur hanya sampai bulan (satu hari per baris); bila sebulan ada beberapa pengukuran,
 * yang terakhir dipakai. Kolom Umur dan STATUS PERTUMBUHAN diisi OpenASP (nilai, bukan rumus).
 * Sel hasil ukur ulang diberi komentar sel. Kolom kode wilayah, NIK, Buku KIA, nama ortu, RT,
 * dan RW dibiarkan kosong. Berkas memuat NAMA anak dan tanggal lahir.
 */
export async function buildP1Workbook(
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[],
  meta: P1WorkbookMeta
): Promise<Uint8Array> {
  const byChild = new Map<string, StoredMeasurement[]>()
  for (const m of measurements) {
    const list = byChild.get(m.childId)
    if (list) list.push(m)
    else byChild.set(m.childId, [m])
  }

  const entries: Entry[] = []
  for (const child of children) {
    const all = byChild.get(child.id) ?? []
    const cells = new Map<MonthColumns, StoredMeasurement>()
    const sorted = [...all].sort((a, b) =>
      a.measuredAt.localeCompare(b.measuredAt)
    )
    for (const m of sorted) {
      if (m.weightKg === null && m.rawLengthHeightCm === null) continue
      const columns = monthColumnsFor(m.measuredAt, meta.year)
      if (columns) cells.set(columns, m) // yang terakhir menang
    }
    if (cells.size > 0) entries.push({ child, cells, all })
  }

  const posyanduOf = (e: Entry) => e.child.posyandu?.trim() || "TANPA POSYANDU"
  entries.sort(
    (a, b) =>
      posyanduOf(a).localeCompare(posyanduOf(b), "id") ||
      a.child.name.localeCompare(b.child.name, "id")
  )
  const groups = new Map<string, Entry[]>()
  for (const entry of entries) {
    const list = groups.get(posyanduOf(entry))
    if (list) list.push(entry)
    else groups.set(posyanduOf(entry), [entry])
  }

  const workbook = await newWorkbook()
  const sheetLog: (string | number)[][] = []
  let sheetNumber = 0
  for (const [posyandu, members] of groups) {
    for (let start = 0; start < members.length; start += MAX_ROWS_PER_SHEET) {
      const chunk = members.slice(start, start + MAX_ROWS_PER_SHEET)
      const sheetName = `P${++sheetNumber}`
      buildSheet(workbook, sheetName, posyandu, chunk, meta.year, {
        template: false,
        title: "HASIL PENGUKURAN ANTROPOMETRI BALITA",
      })
      sheetLog.push([sheetName, posyandu, chunk.length])
    }
  }

  notes(workbook, "Catatan", [
    "Rekap format sheet Posyandu (OpenASP)",
    `Tahun data: ${meta.year}`,
    `Dibuat pada: ${meta.generatedOn}`,
    "",
    "PERHATIAN: berkas ini memuat nama dan tanggal lahir anak. Simpan dan bagikan hanya kepada petugas yang berkepentingan.",
    meta.validated
      ? "Mesin antropometri telah ditinjau tenaga kesehatan."
      : "PERHATIAN: status gizi di OpenASP belum divalidasi tenaga kesehatan.",
    "",
    "Keterbatasan format",
    "TB hanya diekspor untuk Januari, Februari, Agustus, serta November dan Desember tahun sebelumnya (kolom lain di workbook berisi rumus perkiraan).",
    "Tanggal ukur hanya sampai bulan; hari diambil dari pengukuran pertama tahun itu. Bila sebulan ada beberapa pengukuran, yang terakhir dipakai.",
    "Kolom Umur (bulan kalender) dan STATUS PERTUMBUHAN (N naik, T tidak naik, B baru pertama ditimbang, O bulan lalu tidak menimbang) diisi OpenASP sebagai nilai, bukan rumus. B dihitung dari bulan pertama ditimbang menurut riwayat, jadi bisa berbeda dari workbook asli yang kolom 'Bln Pertma Timbang'-nya kosong.",
    "Sel umur berwarna hitam: umur 61 bulan atau lebih (di luar sasaran SKDN).",
    "Kolom kode wilayah, NIK, Buku KIA, nama ortu, RT, dan RW dibiarkan kosong (tidak disimpan OpenASP).",
    "Sel berkomentar adalah hasil ukur ulang; ukuran semula tercatat di komentar itu.",
    "",
    "Sheet | Posyandu | Jumlah anak",
    ...sheetLog.map((line) => line.join(" | ")),
  ])

  return toBytes(workbook)
}

/**
 * Template sheet Posyandu (P1) KOSONG: tampilan sama dengan rekap, 100 baris berborder,
 * nomor urut terisi, dan validasi isian (sex, tanggal lahir, BB 1–30 kg, TB 35–130 cm). Tanpa
 * anak atau angka contoh, supaya tidak ada data palsu yang ikut terimpor.
 */
export async function buildP1Template(): Promise<Uint8Array> {
  const workbook = await newWorkbook()
  buildSheet(workbook, "P1", null, [], new Date().getFullYear(), {
    template: true,
    title: "TEMPLATE HASIL PENGUKURAN ANTROPOMETRI BALITA (OpenASP)",
  })
  notes(workbook, "Petunjuk", [
    "Petunjuk template sheet Posyandu (P1)",
    "",
    "1. Isi satu baris per anak mulai baris 9. Jangan mengubah judul kolom (baris 6 sampai 8) atau urutan kolom.",
    "2. Kolom wajib: NAMA POSYANDU, NAMA ANAK, L/P (1 laki-laki, 2 perempuan), THN pada TGL. UKUR (dua digit), dan TGL LAHIR (tanggal, bulan, tahun dua digit).",
    "3. Satu baris memuat satu tahun data. BB (dan TB bila ada kolomnya) diisi pada kolom bulan masing-masing, hasil ukur nyata. Kosongkan bulan yang tidak ditimbang.",
    "4. TB hanya punya kolom isian untuk Januari, Februari, Agustus, serta November dan Desember tahun sebelumnya. Bulan lain cukup BB.",
    "5. TGL pada TGL. UKUR satu angka 1–28 untuk seluruh bulan pada baris itu; kosong dianggap tanggal 14. Tanggal ukur hanya sampai bulan.",
    "6. Vitamin A dan ASI-E (Februari dan Agustus): isi 1 pada kolom yang sesuai. Kosong berarti belum tercatat, bukan 'tidak'.",
    "7. Kolom Umur dan STATUS PERTUMBUHAN (berwarna) diisi otomatis oleh OpenASP; tidak perlu diisi. Kolom kode wilayah, NIK, Buku KIA, nama ortu, RT, dan RW tidak dibaca OpenASP dan boleh dikosongkan.",
    "8. Kolom isian punya pemeriksaan: tanggal lahir, Sex, BB (1–30 kg), dan TB (35–130 cm) di luar rentang akan ditolak Excel, untuk mencegah salah ketik seperti TB 814.",
    "9. Maksimal 300 anak per sheet (baris 9 sampai 308). Tambah sheet P2, P3, dan seterusnya untuk Posyandu lain atau kelebihan anak.",
    "10. Anak dikenali dari Posyandu + nama + tanggal lahir. Ejaan harus konsisten agar anak yang sama tidak terdaftar dua kali.",
    "",
    "Berkas ini nantinya memuat nama dan tanggal lahir anak. Simpan dan bagikan hanya kepada petugas yang berkepentingan.",
  ])
  return toBytes(workbook)
}
