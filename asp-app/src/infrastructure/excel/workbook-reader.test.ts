import * as XLSX from "xlsx"
import { describe, expect, it } from "vitest"

import { buBidanAdapter } from "@/features/excel-import/adapters/bu-bidan/bu-bidan-adapter"
import { validateBatch } from "@/features/excel-import/validators/validate-batch"
import { buildValidWorkbook } from "@/test/fixtures/bu-bidan-workbook"

import {
  MAX_IMPORT_FILE_BYTES,
  readWorkbook,
  WorkbookReadError,
} from "./workbook-reader"

/** Menulis fixture sebagai file Excel sungguhan agar jalur baca file ikut teruji. */
function toFileBytes(bookType: "xlsx" | "biff8"): Uint8Array {
  const book = XLSX.utils.book_new()
  for (const sheet of buildValidWorkbook().sheets) {
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet(sheet.rows),
      sheet.name
    )
  }
  return new Uint8Array(XLSX.write(book, { type: "array", bookType }))
}

describe("readWorkbook", () => {
  it.each(["xlsx", "biff8"] as const)(
    "membaca file %s dan menghasilkan data yang sama dengan fixture",
    (bookType) => {
      const workbook = readWorkbook(toFileBytes(bookType))
      expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(
        buildValidWorkbook().sheets.map((sheet) => sheet.name)
      )

      expect(buBidanAdapter.detect(workbook)).toBe(true)
      const result = validateBatch(buBidanAdapter.parse(workbook, "uji"))
      expect(result.children).toHaveLength(2)
      expect(result.measurements).toHaveLength(4)
      expect(result.counts.errors).toBe(0)

      // Tanggal berupa serial Excel harus kembali sebagai tanggal yang benar.
      const first = result.measurements.find(
        (m) => m.source.sheet === "JANUARI" && m.source.row === 2
      )
      expect(first?.measuredAt).toBe("2025-01-20")
    }
  )

  it("mempertahankan nomor baris Excel walau sheet tidak dimulai dari A1", () => {
    const worksheet: XLSX.WorkSheet = {}
    XLSX.utils.sheet_add_aoa(worksheet, [["x"]], { origin: "C4" })
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, worksheet, "S")
    const bytes = new Uint8Array(
      XLSX.write(book, { type: "array", bookType: "xlsx" })
    )

    const { rows } = readWorkbook(bytes).sheets[0]
    expect(rows[3][2]).toBe("x")
  })

  it("menolak file kosong, terlalu besar, dan yang bukan Excel", () => {
    expect(() => readWorkbook(new Uint8Array(0))).toThrow(WorkbookReadError)
    expect(() =>
      readWorkbook(new Uint8Array(MAX_IMPORT_FILE_BYTES + 1))
    ).toThrow(WorkbookReadError)
    expect(() => readWorkbook(new Uint8Array([1, 2, 3, 4]))).toThrow(
      WorkbookReadError
    )
  })

  it("menolak file teks/CSV yang bukan Excel", () => {
    const csv = new TextEncoder().encode(
      "NIK,nama_anak\n3201000000000001,Uji\n"
    )
    expect(() => readWorkbook(csv)).toThrow(/bukan Excel/)
  })
})
