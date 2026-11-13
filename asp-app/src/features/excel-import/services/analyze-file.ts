import { detectAdapter } from "../adapters"
import {
  validateBatch,
  type ValidatedBatch,
} from "../validators/validate-batch"

/** Kesalahan yang pesannya aman ditampilkan ke pengguna. */
export class ImportAnalysisError extends Error {}

/**
 * Membaca file Excel di browser, mengenali formatnya, lalu memvalidasi isinya.
 * Tidak menyimpan apa pun dan tidak mengirim data ke mana pun.
 */
export async function analyzeFile(file: File): Promise<ValidatedBatch> {
  // Dimuat saat dibutuhkan agar library Excel tidak masuk ke bundle awal.
  const { readWorkbook, WorkbookReadError } =
    await import("@/infrastructure/excel/workbook-reader")

  let workbook
  try {
    workbook = readWorkbook(await file.arrayBuffer())
  } catch (error) {
    if (error instanceof WorkbookReadError) {
      throw new ImportAnalysisError(error.message)
    }
    throw new ImportAnalysisError("File tidak dapat dibaca.")
  }

  const adapter = detectAdapter(workbook)
  if (!adapter) {
    throw new ImportAnalysisError(
      "Format file belum dikenali. Yang didukung: Format Ukur Master Bu Bidan (sheet 'Tambah Balita' dan sheet bulan) dan ASP Karangtawar (sheet P1–P10)."
    )
  }

  return validateBatch(adapter.parse(workbook, file.name))
}
