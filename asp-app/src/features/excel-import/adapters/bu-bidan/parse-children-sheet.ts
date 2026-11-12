import { parseDate } from "@/lib/date/parse-date"
import { parseDecimal } from "@/lib/number/parse-decimal"

import { parseNik } from "../../normalizers/parse-nik"
import { parseSex } from "../../normalizers/parse-sex"
import { isRowEmpty, RowReader } from "../../parsers/row-reader"
import { buildSheetTable } from "../../parsers/sheet-table"
import type {
  ImportedChild,
  ImportIssue,
  SheetData,
  SheetSummary,
} from "../../types"
import { CHILDREN_SPEC } from "./headers"

export type ChildrenSheetResult = {
  children: ImportedChild[]
  issues: ImportIssue[]
  summary: SheetSummary | null
}

function parseBirthOrder(raw: unknown) {
  const result = parseDecimal(raw)
  if (!result.ok || result.value === null) return result
  return Number.isInteger(result.value) && result.value > 0
    ? result
    : { ok: false as const, reason: "bukan bilangan bulat positif" }
}

export function parseChildrenSheet(sheet: SheetData): ChildrenSheetResult {
  const issues: ImportIssue[] = []
  const built = buildSheetTable(sheet.name, sheet.rows, CHILDREN_SPEC)
  if (!built.ok) return { children: [], issues: [built.issue], summary: null }

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

  const children: ImportedChild[] = []
  let rowsRead = 0

  for (const { rowNumber, cells } of table.dataRows) {
    if (isRowEmpty(table, cells, ["rowNumber"])) continue
    rowsRead++

    const row = new RowReader(sheet.name, rowNumber, table, cells, issues)

    const nik = row.required("nik", "NIK", parseNik)
    const name = row.text("name")
    if (name === "")
      row.report("error", "MISSING_VALUE", "Nama anak kosong.", "name")
    const birthDate = row.required("birthDate", "Tanggal lahir", parseDate)
    const sex = row.required("sex", "Jenis kelamin", parseSex)

    // Satuan kolom-kolom lahir belum dikonfirmasi pemilik format; nilai dibaca
    // apa adanya dan kegagalan parsing tidak menggagalkan baris.
    const birthOrder = row.optional(
      "birthOrder",
      "Anak ke",
      parseBirthOrder,
      "warning"
    )
    const birthWeightKg = row.optional(
      "birthWeightKg",
      "Berat lahir",
      parseDecimal,
      "warning"
    )
    const birthLengthCm = row.optional(
      "birthLengthCm",
      "Panjang lahir",
      parseDecimal,
      "warning"
    )
    const birthHeadCircumferenceCm = row.optional(
      "birthHeadCircumferenceCm",
      "Lingkar kepala lahir",
      parseDecimal,
      "warning"
    )

    // Aturan proses untuk hapus/pindah belum ditetapkan: baris tetap diimpor.
    if (!row.isBlank("deleteFlag") || !row.isBlank("movedFlag")) {
      row.report(
        "warning",
        "FLAGGED_ROW",
        "Baris bertanda hapus/pindah; aturan prosesnya belum ditetapkan sehingga baris tetap diimpor."
      )
    }

    if (row.hasError || nik === null || birthDate === null || sex === null)
      continue

    children.push({
      sourceKey: nik,
      name,
      birthDate,
      sex,
      birthOrder,
      birthWeightKg,
      birthLengthCm,
      birthHeadCircumferenceCm,
      source: { sheet: sheet.name, row: rowNumber },
    })
  }

  return {
    children,
    issues,
    summary: {
      sheet: sheet.name,
      kind: "children",
      rowsRead,
      rowsImported: children.length,
      rowsWithoutMeasurement: 0,
    },
  }
}
