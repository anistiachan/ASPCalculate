import { parseDate } from "@/lib/date/parse-date"
import { parseDecimal } from "@/lib/number/parse-decimal"

import { parseMeasurementPosition } from "../../normalizers/parse-measurement-position"
import { parseNik } from "../../normalizers/parse-nik"
import { parseYesNo } from "../../normalizers/parse-yes-no"
import { isRowEmpty, RowReader } from "../../parsers/row-reader"
import { buildSheetTable } from "../../parsers/sheet-table"
import type {
  ImportedMeasurement,
  ImportIssue,
  SheetData,
  SheetSummary,
} from "../../types"
import { BREASTFEEDING_FIELDS, MEASUREMENT_SPEC } from "./headers"

export type MeasurementSheetResult = {
  measurements: ImportedMeasurement[]
  issues: ImportIssue[]
  summary: SheetSummary | null
}

/** Kolom indikator yang tidak boleh hilang diam-diam walau baris tidak punya tanggal ukur. */
const INDICATOR_FIELDS = [
  "lilaCm",
  "headCircumferenceCm",
  "pittingEdema",
  "vitaminA",
  "motherToddlerClass",
  "mbg",
  ...BREASTFEEDING_FIELDS.map(({ field }) => field),
]

export function parseMeasurementSheet(
  sheet: SheetData
): MeasurementSheetResult {
  const issues: ImportIssue[] = []
  const built = buildSheetTable(sheet.name, sheet.rows, MEASUREMENT_SPEC)
  if (!built.ok) {
    return { measurements: [], issues: [built.issue], summary: null }
  }

  const { table } = built
  for (const header of table.unknownHeaders) {
    issues.push({
      severity: "warning",
      code: "UNKNOWN_COLUMN",
      message: `Kolom tidak dikenal diabaikan: ${header}.`,
      sheet: sheet.name,
      row: table.headerRowIndex + 1,
      field: header,
    })
  }

  const measurements: ImportedMeasurement[] = []
  let rowsRead = 0
  let rowsWithoutMeasurement = 0

  for (const { rowNumber, cells } of table.dataRows) {
    if (isRowEmpty(table, cells, ["rowNumber"])) continue
    rowsRead++

    const row = new RowReader(sheet.name, rowNumber, table, cells, issues)

    // Daftar anak yang belum diukur bulan ini bukan kesalahan.
    const notMeasured =
      row.isBlank("measuredAt") &&
      row.isBlank("weightKg") &&
      row.isBlank("heightCm")
    if (notMeasured) {
      rowsWithoutMeasurement++
      if (INDICATOR_FIELDS.some((field) => !row.isBlank(field))) {
        row.report(
          "warning",
          "MISSING_VALUE",
          "Baris berisi data indikator tetapi tanpa tanggal ukur, berat, dan tinggi; baris tidak diimpor."
        )
      }
      continue
    }

    const nik = row.required("nik", "NIK", parseNik)
    const measuredAt = row.required("measuredAt", "Tanggal ukur", parseDate)
    const weightKg = row.optional("weightKg", "Berat", parseDecimal, "error")
    const rawLengthHeightCm = row.optional(
      "heightCm",
      "Tinggi",
      parseDecimal,
      "error"
    )
    const birthDateFromSheet = row.optional(
      "birthDate",
      "Tanggal lahir",
      parseDate,
      "warning"
    )

    if (weightKg === null && rawLengthHeightCm === null && !row.hasError) {
      row.report(
        "warning",
        "MISSING_VALUE",
        "Berat dan tinggi sama-sama kosong."
      )
    }

    const position = parseMeasurementPosition(row.raw("position"))
    if (!position.recognized) {
      row.report(
        "warning",
        "POSITION_UNKNOWN",
        "Cara ukur tidak dikenal.",
        "position"
      )
    } else if (position.position === "UNKNOWN" && rawLengthHeightCm !== null) {
      row.report("warning", "POSITION_UNKNOWN", "Cara ukur kosong.", "position")
    }

    const breastfeedingByMonth: Record<number, boolean | null> = {}
    for (const { month, field } of BREASTFEEDING_FIELDS) {
      breastfeedingByMonth[month] = row.optional(
        field,
        `ASI bulan ${month}`,
        parseYesNo,
        "warning"
      )
    }

    const rawPittingEdema = row.text("pittingEdema") || null
    if (rawPittingEdema !== null) {
      row.report(
        "warning",
        "NEEDS_MAPPING",
        "Pitting edema terisi tetapi kamus nilainya belum dikonfirmasi; nilai disimpan apa adanya.",
        "pittingEdema"
      )
    }

    const measurement = {
      lilaCm: row.optional("lilaCm", "LILA", parseDecimal, "warning"),
      headCircumferenceCm: row.optional(
        "headCircumferenceCm",
        "Lingkar kepala",
        parseDecimal,
        "warning"
      ),
      vitaminAStatus: row.optional(
        "vitaminA",
        "Vitamin A",
        parseYesNo,
        "warning"
      ),
      motherToddlerClassAttendance: row.optional(
        "motherToddlerClass",
        "Kelas ibu balita",
        parseYesNo,
        "warning"
      ),
      mbgStatus: row.optional("mbg", "MBG", parseYesNo, "warning"),
    }

    if (row.hasError || nik === null || measuredAt === null) continue

    measurements.push({
      sourceChildKey: nik,
      sourceChildName: row.text("name"),
      birthDateFromSheet,
      measuredAt,
      weightKg,
      rawLengthHeightCm,
      measurementPosition: position.position,
      rawMeasurementPosition: position.raw,
      rawPittingEdema,
      breastfeedingByMonth,
      rowNote: row.text("note") || null,
      source: { sheet: sheet.name, row: rowNumber },
      ...measurement,
    })
  }

  return {
    measurements,
    issues,
    summary: {
      sheet: sheet.name,
      kind: "measurements",
      rowsRead,
      rowsImported: measurements.length,
      rowsWithoutMeasurement,
    },
  }
}
