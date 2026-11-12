import * as XLSX from "xlsx"

import type { WorkbookData } from "@/features/excel-import/types"

/** Batas ukuran file yang dibaca di browser; file lebih besar hampir pasti bukan format yang diharapkan. */
export const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024

export class WorkbookReadError extends Error {}

// SheetJS menganggap data yang bukan Excel sebagai teks/CSV tanpa error, jadi
// tipe file dicek dari tanda pengenalnya sebelum dibaca.
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] // .xlsx
const OLE2_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] // .xls

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte)
}

function isExcelFile(bytes: Uint8Array): boolean {
  return startsWith(bytes, ZIP_SIGNATURE) || startsWith(bytes, OLE2_SIGNATURE)
}

/**
 * Membaca file Excel (.xlsx maupun .xls) menjadi larik baris per sheet.
 *
 * - Sel tanggal dibiarkan sebagai angka serial (tanpa `cellDates`) supaya hasilnya
 *   tidak bergeser oleh zona waktu perangkat; `parseDate` yang mengubahnya.
 * - Setiap sheet dibaca dari sel A1 dengan baris kosong dipertahankan, sehingga
 *   indeks baris + 1 sama dengan nomor baris di Excel.
 */
export function readWorkbook(data: ArrayBuffer | Uint8Array): WorkbookData {
  const byteLength = data.byteLength
  if (byteLength === 0) throw new WorkbookReadError("File kosong.")
  if (byteLength > MAX_IMPORT_FILE_BYTES) {
    throw new WorkbookReadError("Ukuran file terlalu besar (maksimal 20 MB).")
  }

  if (!isExcelFile(new Uint8Array(data))) {
    throw new WorkbookReadError(
      "File bukan Excel. Gunakan file .xlsx atau .xls."
    )
  }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(data, { type: "array", cellDates: false })
  } catch {
    throw new WorkbookReadError("File tidak dapat dibaca sebagai Excel.")
  }

  const sheets = workbook.SheetNames.map((name) => {
    const worksheet = workbook.Sheets[name]
    const ref = worksheet?.["!ref"]
    if (!worksheet || !ref) return { name, rows: [] as unknown[][] }

    const range = XLSX.utils.decode_range(ref)
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
      range: { s: { r: 0, c: 0 }, e: range.e },
    })
    return { name, rows }
  })

  return { sheets }
}
