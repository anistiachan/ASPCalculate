import { isBlank, type ParseResult } from "@/lib/result/parse-result"

import type { ImportIssue, ImportIssueCode, IssueSeverity } from "../types"
import { readCell, type SheetTable } from "./sheet-table"

type Parser<T> = (raw: unknown) => ParseResult<T | null>

/**
 * Membaca satu baris data dan mencatat masalah per field. Pesan masalah hanya
 * memuat nama field dan alasan, tidak pernah nilai sel (bisa berisi NIK atau nama).
 */
export class RowReader {
  /** true jika ada masalah berseverity error; baris tersebut tidak boleh diimpor. */
  hasError = false

  constructor(
    private readonly sheet: string,
    private readonly rowNumber: number,
    private readonly table: SheetTable,
    private readonly cells: unknown[],
    private readonly issues: ImportIssue[]
  ) {}

  raw(field: string): unknown {
    return readCell(this.table, this.cells, field)
  }

  hasColumn(field: string): boolean {
    return this.table.columns.has(field)
  }

  isBlank(field: string): boolean {
    return isBlank(this.raw(field))
  }

  /** Teks sel yang sudah di-trim, atau string kosong. */
  text(field: string): string {
    const raw = this.raw(field)
    return isBlank(raw) ? "" : String(raw).trim()
  }

  report(
    severity: IssueSeverity,
    code: ImportIssueCode,
    message: string,
    field?: string
  ): void {
    if (severity === "error") this.hasError = true
    this.issues.push({
      severity,
      code,
      message,
      sheet: this.sheet,
      row: this.rowNumber,
      field,
    })
  }

  /** Field wajib: kosong atau tidak valid dicatat sebagai error. */
  required<T>(field: string, label: string, parse: Parser<T>): T | null {
    const result = parse(this.raw(field))
    if (!result.ok) {
      this.report(
        "error",
        "INVALID_VALUE",
        `${label}: ${result.reason}.`,
        field
      )
      return null
    }
    if (result.value === null) {
      this.report("error", "MISSING_VALUE", `${label} kosong.`, field)
      return null
    }
    return result.value
  }

  /**
   * Field opsional: kosong menjadi null tanpa masalah. Nilai yang tidak valid
   * dicatat dengan severity yang diminta dan hasilnya null.
   */
  optional<T>(
    field: string,
    label: string,
    parse: Parser<T>,
    invalidSeverity: IssueSeverity
  ): T | null {
    const result = parse(this.raw(field))
    if (!result.ok) {
      this.report(
        invalidSeverity,
        "INVALID_VALUE",
        `${label}: ${result.reason}.`,
        field
      )
      return null
    }
    return result.value
  }
}

/** Baris kosong jika semua sel selain field yang diabaikan (mis. nomor urut) tidak terisi. */
export function isRowEmpty(
  table: SheetTable,
  cells: unknown[],
  ignoredFields: readonly string[]
): boolean {
  const ignoredColumns = new Set(
    ignoredFields
      .map((field) => table.columns.get(field))
      .filter((index): index is number => index !== undefined)
  )
  return cells.every(
    (cell, columnIndex) => ignoredColumns.has(columnIndex) || isBlank(cell)
  )
}
