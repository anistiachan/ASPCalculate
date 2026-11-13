import { normalizeHeader } from "../../normalizers/normalize-header"
import type {
  ImportAdapter,
  ImportBatch,
  ImportedChild,
  ImportedMeasurement,
  ImportIssue,
  SheetData,
  WorkbookData,
} from "../../types"
import { columnIndex } from "../karangtawar/layout"
import {
  composeImportKey,
  isoDate,
  norm,
  numberAt,
  parseSexCode,
  textAt,
} from "../karangtawar/parse-posyandu-sheet"
import {
  MEASURED_HEIGHT_MONTHS,
  PSG_ADAPTER_ID,
  PSG_COLUMNS,
  PSG_FIRST_DATA_ROW,
  PSG_HEADER_CELLS,
  PSG_HEADER_ROW,
  PSG_SHEET_NAME,
} from "./layout"

const DEFAULT_MEASURE_DAY = 14

function isPsgSheet(sheet: SheetData): boolean {
  if (sheet.name.trim().toUpperCase() !== PSG_SHEET_NAME) return false
  const header = sheet.rows[PSG_HEADER_ROW - 1] ?? []
  return Object.values(PSG_HEADER_CELLS).every(
    ({ column, text }) => normalizeHeader(header[columnIndex(column)]) === text
  )
}

/** Nama kosong, "0" (rumus workbook untuk baris tak terisi), atau hanya spasi = bukan anak. */
const isRealName = (name: string) => name !== "" && name !== "0"

function parsePsgSheet(sheet: SheetData) {
  const children: ImportedChild[] = []
  const measurements: ImportedMeasurement[] = []
  const issues: ImportIssue[] = []
  const measuredMonths = new Set<number>()
  let rowsRead = 0
  let withoutMeasurement = 0

  for (
    let rowNumber = PSG_FIRST_DATA_ROW;
    rowNumber <= sheet.rows.length;
    rowNumber++
  ) {
    const row = sheet.rows[rowNumber - 1] ?? []
    const name = textAt(row, PSG_COLUMNS.name)
    if (!isRealName(name)) continue
    rowsRead++

    const source = { sheet: sheet.name, row: rowNumber }
    const report = (
      code: ImportIssue["code"],
      message: string,
      field: string
    ) =>
      issues.push({
        severity: "error",
        code,
        message,
        sheet: sheet.name,
        row: rowNumber,
        field,
      })

    const sexResult = parseSexCode(row[columnIndex(PSG_COLUMNS.sex)])
    const birthYY = numberAt(row, PSG_COLUMNS.birthYear)
    const birthMonth = numberAt(row, PSG_COLUMNS.birthMonth)
    const birthDay = numberAt(row, PSG_COLUMNS.birthDay)
    const birthDate =
      birthYY !== null && birthMonth !== null && birthDay !== null
        ? isoDate(2000 + birthYY, birthMonth, birthDay)
        : null
    const posyandu = textAt(row, PSG_COLUMNS.posyandu)

    let rowHasError = false
    if (!sexResult.ok) {
      report("INVALID_VALUE", `Jenis kelamin: ${sexResult.reason}.`, "sex")
      rowHasError = true
    }
    if (birthDate === null) {
      report(
        "INVALID_VALUE",
        "Tanggal lahir tidak lengkap atau tidak valid.",
        "birthDate"
      )
      rowHasError = true
    }
    if (posyandu === "" || posyandu === "0") {
      report("MISSING_VALUE", "Nama Posyandu kosong.", "posyandu")
      rowHasError = true
    }
    if (rowHasError || !sexResult.ok || birthDate === null) continue

    const sourceKey = composeImportKey(posyandu, name, birthDate)
    children.push({
      sourceKey,
      keyKind: "composite",
      posyandu: norm(posyandu),
      name,
      birthDate,
      sex: sexResult.value,
      birthOrder: null,
      birthWeightKg: null,
      birthLengthCm: null,
      birthHeadCircumferenceCm: null,
      source,
    })

    const weight = numberAt(row, PSG_COLUMNS.weightKg)
    const height = numberAt(row, PSG_COLUMNS.heightCm)
    const hasWeight = weight !== null && weight > 0
    const hasHeight = height !== null && height > 0
    if (!hasWeight && !hasHeight) {
      withoutMeasurement++
      continue
    }

    const measureYY = numberAt(row, PSG_COLUMNS.measureYear)
    const measureMonth = numberAt(row, PSG_COLUMNS.measureMonth)
    const dayInput = numberAt(row, PSG_COLUMNS.measureDay)
    const measureDay =
      dayInput !== null && Number.isInteger(dayInput) && dayInput >= 1
        ? dayInput
        : DEFAULT_MEASURE_DAY
    const measuredAt =
      measureYY !== null && measureMonth !== null
        ? isoDate(2000 + measureYY, measureMonth, measureDay)
        : null
    if (measuredAt === null) {
      report(
        "INVALID_VALUE",
        "Tanggal timbang tidak lengkap atau tidak valid; pengukuran tidak diimpor.",
        "measuredAt"
      )
      continue
    }
    measuredMonths.add(Number(measuredAt.slice(5, 7)))

    measurements.push({
      sourceChildKey: sourceKey,
      sourceChildName: name,
      birthDateFromSheet: birthDate,
      measuredAt,
      weightKg: hasWeight ? weight : null,
      rawLengthHeightCm: hasHeight ? height : null,
      measurementPosition: "UNKNOWN",
      rawMeasurementPosition: null,
      lilaCm: null,
      headCircumferenceCm: null,
      rawPittingEdema: null,
      vitaminAStatus: null,
      breastfeedingByMonth: {},
      motherToddlerClassAttendance: null,
      mbgStatus: null,
      rowNote: null,
      source,
    })
  }

  if (rowsRead > 0) {
    issues.push({
      severity: "warning",
      code: "POSITION_UNKNOWN",
      message:
        "Cara ukur (berdiri/terlentang) tidak tercatat di sheet PSG; status TB/U dan BB/TB memakai nilai tanpa koreksi posisi.",
      sheet: sheet.name,
      row: null,
    })
    const estimated = [...measuredMonths].filter(
      (m) => !MEASURED_HEIGHT_MONTHS.includes(m)
    )
    if (estimated.length > 0) {
      issues.push({
        severity: "warning",
        code: "INVALID_VALUE",
        message:
          "TB di workbook ASP hanya hasil ukur untuk Januari, Februari, dan Agustus; bulan lain berupa rumus perkiraan. Status stunting bulan ini bisa berdasarkan TB perkiraan, bukan hasil ukur. Ukur ulang sebelum mengambil keputusan.",
        sheet: sheet.name,
        row: null,
        field: "heightCm",
      })
    }
  }

  return {
    children,
    measurements,
    issues,
    rowsRead,
    withoutMeasurement,
  }
}

export const psgAdapter: ImportAdapter = {
  id: PSG_ADAPTER_ID,
  displayName: "ASP Karangtawar 2025 (sheet PSG bulanan)",

  /** Dikenali dari sheet "PSG" dengan header NAMA, Tg.Timbang, dan Tgl.Lahir pada baris 6. */
  detect(workbook: WorkbookData): boolean {
    return workbook.sheets.some(isPsgSheet)
  },

  parse(workbook: WorkbookData, fileName: string): ImportBatch {
    const batch: ImportBatch = {
      adapterId: PSG_ADAPTER_ID,
      fileName,
      children: [],
      measurements: [],
      issues: [],
      skippedSheets: [],
      sheetSummaries: [],
    }

    for (const sheet of workbook.sheets) {
      if (!isPsgSheet(sheet)) {
        batch.skippedSheets.push({
          name: sheet.name,
          reason:
            "Bukan sheet PSG; OpenASP hanya membaca sheet PSG pada berkas ini.",
        })
        continue
      }
      const result = parsePsgSheet(sheet)
      if (result.rowsRead === 0) {
        batch.skippedSheets.push({
          name: sheet.name,
          reason: "Belum ada data anak.",
        })
        continue
      }
      batch.children.push(...result.children)
      batch.measurements.push(...result.measurements)
      batch.issues.push(...result.issues)
      batch.sheetSummaries.push(
        {
          sheet: sheet.name,
          kind: "children",
          rowsRead: result.rowsRead,
          rowsImported: result.children.length,
          rowsWithoutMeasurement: 0,
        },
        {
          sheet: sheet.name,
          kind: "measurements",
          rowsRead: result.rowsRead,
          rowsImported: result.measurements.length,
          rowsWithoutMeasurement: result.withoutMeasurement,
        }
      )
    }

    return batch
  },
}
