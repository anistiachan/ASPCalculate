import { normalizeHeader } from "@/features/excel-import/normalizers/normalize-header"
import type { CorrectionRow } from "@/domain/reporting/corrections"
import { RECHECK_HEADERS } from "@/infrastructure/excel/recheck-workbook"
import { readWorkbook } from "@/infrastructure/excel/workbook-reader"
import { isBlank } from "@/lib/result/parse-result"

export const RECHECK_SHEET_NAME = "Perlu diukur ulang"

export class CorrectionFileError extends Error {}

/**
 * Membaca berkas daftar "perlu diukur ulang" yang sudah diisi petugas menjadi baris mentah.
 * Validasi isi dilakukan `planCorrections`; di sini hanya struktur berkas yang diperiksa.
 */
export function readCorrectionRows(data: ArrayBuffer): CorrectionRow[] {
  const workbook = readWorkbook(data)
  const sheet = workbook.sheets.find((s) => s.name === RECHECK_SHEET_NAME)
  if (!sheet) {
    throw new CorrectionFileError(
      `Sheet "${RECHECK_SHEET_NAME}" tidak ditemukan. Gunakan berkas yang diunduh dari tombol "Unduh daftar ukur ulang".`
    )
  }

  const header = (sheet.rows[0] ?? []).map(normalizeHeader)
  const indexOf = (title: string) => header.indexOf(normalizeHeader(title))
  const code = indexOf(RECHECK_HEADERS.code)
  const weight = indexOf(RECHECK_HEADERS.newWeight)
  const height = indexOf(RECHECK_HEADERS.newHeight)
  const date = indexOf(RECHECK_HEADERS.remeasuredOn)

  const missing = [
    [code, RECHECK_HEADERS.code],
    [weight, RECHECK_HEADERS.newWeight],
    [height, RECHECK_HEADERS.newHeight],
    [date, RECHECK_HEADERS.remeasuredOn],
  ]
    .filter(([index]) => index === -1)
    .map(([, title]) => title)
  if (missing.length > 0) {
    throw new CorrectionFileError(
      `Kolom tidak lengkap: ${missing.join(", ")}. Jangan menghapus atau mengganti nama kolom.`
    )
  }

  const rows: CorrectionRow[] = []
  for (let index = 1; index < sheet.rows.length; index++) {
    const row = sheet.rows[index] ?? []
    if (isBlank(row[code])) continue
    rows.push({
      rowNumber: index + 1,
      code: String(row[code]).trim(),
      rawWeight: row[weight],
      rawHeight: row[height],
      rawDate: row[date],
    })
  }
  return rows
}
