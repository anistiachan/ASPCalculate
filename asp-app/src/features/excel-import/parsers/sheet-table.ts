import { normalizeHeader } from "../normalizers/normalize-header"
import type { ImportIssue } from "../types"

/** Berapa baris teratas yang dicari untuk menemukan baris header. */
const HEADER_SEARCH_ROWS = 10
/** Baris dianggap header jika minimal sebanyak ini selnya dikenali. */
const MIN_RECOGNIZED_HEADERS = 3

export type SheetSpec = {
  /** Nama field internal → alias header yang sudah dinormalisasi (lihat `normalizeHeader`). */
  fields: Readonly<Record<string, readonly string[]>>
  /** Header yang dikenali tetapi sengaja tidak diimpor, supaya tidak dilaporkan sebagai tak dikenal. */
  ignoredHeaders: readonly string[]
  /**
   * Awalan header (sudah dinormalisasi) yang juga diabaikan, mis. kolom bantu rumus ("bantu...").
   * Dipakai agar workbook yang kolom hitungannya ditambahkan tetap bisa diimpor tanpa peringatan.
   */
  ignoredHeaderPrefixes?: readonly string[]
  required: readonly string[]
}

export type SheetTable = {
  /** Indeks (mulai 0) baris header di `rows`. */
  headerRowIndex: number
  /** Nama field → indeks kolom. */
  columns: ReadonlyMap<string, number>
  /** Teks header asli yang tidak dikenali. */
  unknownHeaders: string[]
  /** Baris data beserta nomor baris Excel-nya (mulai 1). */
  dataRows: { rowNumber: number; cells: unknown[] }[]
}

type BuildResult =
  { ok: true; table: SheetTable } | { ok: false; issue: ImportIssue }

function buildAliasLookup(spec: SheetSpec): Map<string, string> {
  const lookup = new Map<string, string>()
  for (const [field, aliases] of Object.entries(spec.fields)) {
    for (const alias of aliases) lookup.set(alias, field)
  }
  return lookup
}

/**
 * Mencari baris header berdasarkan isinya (bukan nomor baris tetap), lalu
 * memetakan kolom berdasarkan nama header.
 */
export function buildSheetTable(
  sheetName: string,
  rows: unknown[][],
  spec: SheetSpec
): BuildResult {
  const aliasLookup = buildAliasLookup(spec)
  const ignoredSet = new Set(spec.ignoredHeaders)
  const prefixes = spec.ignoredHeaderPrefixes ?? []
  const ignored = {
    has: (key: string) =>
      ignoredSet.has(key) || prefixes.some((prefix) => key.startsWith(prefix)),
  }

  let headerRowIndex = -1
  let bestScore = 0
  const searchLimit = Math.min(rows.length, HEADER_SEARCH_ROWS)
  for (let i = 0; i < searchLimit; i++) {
    const score = rows[i].filter((cell) => {
      const key = normalizeHeader(cell)
      return aliasLookup.has(key) || ignored.has(key)
    }).length
    if (score > bestScore) {
      bestScore = score
      headerRowIndex = i
    }
  }

  if (headerRowIndex === -1 || bestScore < MIN_RECOGNIZED_HEADERS) {
    return {
      ok: false,
      issue: {
        severity: "error",
        code: "SHEET_HEADER_NOT_FOUND",
        message: "Baris header tidak ditemukan; sheet dilewati.",
        sheet: sheetName,
        row: null,
      },
    }
  }

  const columns = new Map<string, number>()
  const unknownHeaders: string[] = []
  rows[headerRowIndex].forEach((cell, columnIndex) => {
    const key = normalizeHeader(cell)
    if (key === "") return

    const field = aliasLookup.get(key)
    if (field !== undefined) {
      // Jika header yang sama muncul dua kali, kolom pertama yang dipakai.
      if (!columns.has(field)) columns.set(field, columnIndex)
    } else if (!ignored.has(key)) {
      unknownHeaders.push(String(cell).trim())
    }
  })

  const missing = spec.required.filter((field) => !columns.has(field))
  if (missing.length > 0) {
    return {
      ok: false,
      issue: {
        severity: "error",
        code: "SHEET_MISSING_REQUIRED_COLUMN",
        message: `Kolom wajib tidak ditemukan: ${missing.join(", ")}; sheet dilewati.`,
        sheet: sheetName,
        row: null,
      },
    }
  }

  const dataRows = rows.slice(headerRowIndex + 1).map((cells, offset) => ({
    rowNumber: headerRowIndex + offset + 2,
    cells,
  }))

  return {
    ok: true,
    table: { headerRowIndex, columns, unknownHeaders, dataRows },
  }
}

/** Nilai sel untuk sebuah field, atau undefined jika kolomnya tidak ada di sheet. */
export function readCell(
  table: SheetTable,
  cells: unknown[],
  field: string
): unknown {
  const columnIndex = table.columns.get(field)
  return columnIndex === undefined ? undefined : cells[columnIndex]
}
