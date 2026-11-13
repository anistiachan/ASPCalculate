import { normalizeHeader } from "../../normalizers/normalize-header"
import type {
  ImportAdapter,
  ImportBatch,
  SheetData,
  WorkbookData,
} from "../../types"
import {
  columnIndex,
  HEADER_CELLS,
  HEADER_ROW,
  KARANGTAWAR_ADAPTER_ID,
} from "./layout"
import { parsePosyanduSheet } from "./parse-posyandu-sheet"

const POSYANDU_SHEET = /^p\d{1,2}$/i

function isPosyanduSheet(sheet: SheetData): boolean {
  if (!POSYANDU_SHEET.test(sheet.name.trim())) return false
  const header = sheet.rows[HEADER_ROW - 1] ?? []
  return (
    normalizeHeader(header[columnIndex(HEADER_CELLS.posyandu)]) ===
      "namaposyandu" &&
    normalizeHeader(header[columnIndex(HEADER_CELLS.name)]) === "namaanak"
  )
}

const IGNORED_REASON =
  "Sheet hitungan/laporan workbook; OpenASP menghitung ulang dari data per anak."

export const karangtawarAdapter: ImportAdapter = {
  id: KARANGTAWAR_ADAPTER_ID,
  displayName: "ASP Karangtawar 2025 (sheet Posyandu P1–P10)",

  /** Dikenali dari sheet P1…P10 dengan header "NAMA POSYANDU" dan "NAMA ANAK". */
  detect(workbook: WorkbookData): boolean {
    return workbook.sheets.some(isPosyanduSheet)
  },

  parse(workbook: WorkbookData, fileName: string): ImportBatch {
    const batch: ImportBatch = {
      adapterId: KARANGTAWAR_ADAPTER_ID,
      fileName,
      children: [],
      measurements: [],
      issues: [],
      skippedSheets: [],
      sheetSummaries: [],
    }

    for (const sheet of workbook.sheets) {
      if (!isPosyanduSheet(sheet)) {
        batch.skippedSheets.push({ name: sheet.name, reason: IGNORED_REASON })
        continue
      }
      const result = parsePosyanduSheet(sheet)
      if (result.summaries.length === 0) {
        batch.skippedSheets.push({
          name: sheet.name,
          reason: "Belum ada data anak.",
        })
        continue
      }
      batch.children.push(...result.children)
      batch.measurements.push(...result.measurements)
      batch.issues.push(...result.issues)
      batch.sheetSummaries.push(...result.summaries)
    }

    return batch
  },
}
