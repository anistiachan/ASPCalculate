import type { MeasurementPosition, Sex } from "@/domain/child/child.types"

/** Isi satu sheet sebagai larik baris. Tidak bergantung pada library Excel. */
export type SheetData = {
  name: string
  /** `rows[0]` adalah baris 1 di Excel, sehingga nomor baris sumber = indeks + 1. */
  rows: unknown[][]
}

export type WorkbookData = {
  sheets: SheetData[]
}

export type IssueSeverity = "error" | "warning"

export type ImportIssueCode =
  | "SHEET_HEADER_NOT_FOUND"
  | "SHEET_MISSING_REQUIRED_COLUMN"
  | "UNKNOWN_COLUMN"
  | "INVALID_VALUE"
  | "MISSING_VALUE"
  | "CHILD_DUPLICATE_KEY"
  | "CHILD_NOT_FOUND"
  | "NAME_MISMATCH"
  | "BIRTH_DATE_MISMATCH"
  | "MEASURED_BEFORE_BIRTH"
  | "NON_POSITIVE_MEASUREMENT"
  | "POSITION_UNKNOWN"
  | "DUPLICATE_MEASUREMENT"
  | "NEEDS_MAPPING"
  | "FLAGGED_ROW"
  | "CHILD_CONFLICT"
  | "MEASUREMENT_CONFLICT"

/**
 * Catatan masalah pada hasil import. `message` tidak boleh memuat NIK, nama,
 * atau data pribadi lain; gunakan `sheet` dan `row` untuk menunjuk lokasinya.
 */
export type ImportIssue = {
  severity: IssueSeverity
  code: ImportIssueCode
  message: string
  sheet: string
  /** Nomor baris Excel (mulai 1), atau null jika masalahnya pada level sheet. */
  row: number | null
  /** Nama field internal atau header sumber yang terkait, jika ada. */
  field?: string
}

export type SourceLocation = {
  sheet: string
  row: number
}

/**
 * Data induk anak hasil impor. Field pribadi yang tidak dibutuhkan untuk
 * perhitungan (nomor KK, nama/NIK/telepon orang tua, alamat, RT/RW) sengaja
 * tidak diimpor.
 */
export type ImportedChild = {
  /** NIK, hanya dipakai untuk mencocokkan data saat import. */
  sourceKey: string
  name: string
  birthDate: string
  sex: Sex
  birthOrder: number | null
  birthWeightKg: number | null
  birthLengthCm: number | null
  birthHeadCircumferenceCm: number | null
  source: SourceLocation
}

export type ImportedMeasurement = {
  sourceChildKey: string
  sourceChildName: string
  /** Hanya terisi pada sheet yang memiliki kolom tanggal lahir. */
  birthDateFromSheet: string | null
  measuredAt: string
  weightKg: number | null
  rawLengthHeightCm: number | null
  measurementPosition: MeasurementPosition
  /** Teks asli kolom cara ukur, untuk audit. */
  rawMeasurementPosition: string | null
  lilaCm: number | null
  headCircumferenceCm: number | null
  /** Kamus nilai belum terkonfirmasi, jadi disimpan apa adanya dan tidak ditafsirkan. */
  rawPittingEdema: string | null
  vitaminAStatus: boolean | null
  breastfeedingByMonth: Record<number, boolean | null>
  motherToddlerClassAttendance: boolean | null
  mbgStatus: boolean | null
  rowNote: string | null
  source: SourceLocation
}

export type SheetSummary = {
  sheet: string
  kind: "children" | "measurements"
  rowsRead: number
  rowsImported: number
  /** Baris berisi anak tetapi belum ada pengukuran bulan itu. Bukan kesalahan. */
  rowsWithoutMeasurement: number
}

export type ImportBatch = {
  adapterId: string
  fileName: string
  children: ImportedChild[]
  measurements: ImportedMeasurement[]
  issues: ImportIssue[]
  skippedSheets: { name: string; reason: string }[]
  sheetSummaries: SheetSummary[]
}

export interface ImportAdapter {
  id: string
  displayName: string
  detect(workbook: WorkbookData): boolean
  parse(workbook: WorkbookData, fileName: string): ImportBatch
}
