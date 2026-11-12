import { normalizeHeader } from "../../normalizers/normalize-header"
import type { ImportAdapter, ImportBatch, WorkbookData } from "../../types"
import {
  BIDAN_ADAPTER_ID,
  CHILDREN_SHEET_NAME,
  MONTH_SHEET_NAMES,
  SAMPLE_SHEET_NAME,
} from "./headers"
import { parseChildrenSheet } from "./parse-children-sheet"
import { parseMeasurementSheet } from "./parse-measurement-sheet"

const sheetKey = (name: string) => normalizeHeader(name)

export const buBidanAdapter: ImportAdapter = {
  id: BIDAN_ADAPTER_ID,
  displayName: "Format Ukur Master Bu Bidan",

  /** Dikenali dari sheet `Tambah Balita` dan minimal satu sheet bulan. */
  detect(workbook: WorkbookData): boolean {
    const keys = workbook.sheets.map((sheet) => sheetKey(sheet.name))
    return (
      keys.includes(CHILDREN_SHEET_NAME) &&
      keys.some((key) => MONTH_SHEET_NAMES.has(key))
    )
  },

  parse(workbook: WorkbookData, fileName: string): ImportBatch {
    const batch: ImportBatch = {
      adapterId: BIDAN_ADAPTER_ID,
      fileName,
      children: [],
      measurements: [],
      issues: [],
      skippedSheets: [],
      sheetSummaries: [],
    }

    for (const sheet of workbook.sheets) {
      const key = sheetKey(sheet.name)

      if (key === CHILDREN_SHEET_NAME) {
        const result = parseChildrenSheet(sheet)
        batch.children.push(...result.children)
        batch.issues.push(...result.issues)
        if (result.summary) batch.sheetSummaries.push(result.summary)
      } else if (MONTH_SHEET_NAMES.has(key)) {
        const result = parseMeasurementSheet(sheet)
        batch.measurements.push(...result.measurements)
        batch.issues.push(...result.issues)
        if (result.summary) batch.sheetSummaries.push(result.summary)
      } else if (key === SAMPLE_SHEET_NAME) {
        // Baris contoh tidak boleh ikut diimpor sebagai data balita nyata.
        batch.skippedSheets.push({
          name: sheet.name,
          reason: "Sheet contoh pengisian, bukan data balita.",
        })
      } else {
        batch.skippedSheets.push({
          name: sheet.name,
          reason: "Nama sheet tidak dikenali.",
        })
      }
    }

    return batch
  },
}
