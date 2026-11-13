import { readFileSync } from "node:fs"
import { join } from "node:path"

import ExcelJS from "exceljs"
import * as XLSX from "xlsx"
import { describe, expect, it } from "vitest"

import { detectAdapter } from "@/features/excel-import/adapters"

import { readWorkbook } from "./workbook-reader"

/** Mengisi sel pada sheet hasil template, seperti yang dilakukan petugas di Excel. */
function fill(
  bytes: Uint8Array,
  sheetName: string,
  cells: Record<string, string | number>
): Uint8Array {
  const book = XLSX.read(bytes, { type: "array" })
  const sheet = book.Sheets[sheetName]
  for (const [address, value] of Object.entries(cells)) {
    sheet[address] =
      typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value }
  }
  const range = XLSX.utils.decode_range(sheet["!ref"]!)
  for (const address of Object.keys(cells)) {
    const cell = XLSX.utils.decode_cell(address)
    range.e.r = Math.max(range.e.r, cell.r)
    range.e.c = Math.max(range.e.c, cell.c)
  }
  sheet["!ref"] = XLSX.utils.encode_range(range)
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }))
}

const psgTemplateBuffer = () =>
  readFileSync(join(process.cwd(), "public", "templates", "template-psg.xlsx"))
const psgTemplateBytes = () => new Uint8Array(psgTemplateBuffer())

describe("template PSG (berkas statis public/templates/template-psg.xlsx)", () => {
  it("dikenali adapter PSG, kosong, dan punya sheet petunjuk", () => {
    const workbook = readWorkbook(psgTemplateBytes())
    expect(workbook.sheets.map((s) => s.name)).toEqual(["PSG", "Petunjuk"])
    const adapter = detectAdapter(workbook)
    expect(adapter?.id).toBe("asp-psg")
    const batch = adapter!.parse(workbook, "template-psg.xlsx")
    expect(batch.children).toHaveLength(0)
    expect(batch.measurements).toHaveLength(0)
  })

  it("baris yang diisi petugas diimpor sebagai anak dengan satu pengukuran", () => {
    const filled = fill(psgTemplateBytes(), "PSG", {
      C9: "Anak Uji",
      D9: 2,
      E9: 14,
      F9: 2,
      G9: 26,
      H9: 12,
      I9: 3,
      J9: 24,
      L9: 11.5,
      M9: 85,
      AG9: "JERUK",
    })
    const workbook = readWorkbook(filled)
    const batch = detectAdapter(workbook)!.parse(workbook, "x.xlsx")
    expect(batch.issues.filter((i) => i.severity === "error")).toEqual([])
    expect(batch.children[0]).toMatchObject({
      name: "Anak Uji",
      sex: "F",
      birthDate: "2024-03-12",
      posyandu: "JERUK",
    })
    expect(batch.measurements[0]).toMatchObject({
      measuredAt: "2026-02-14",
      weightKg: 11.5,
      rawLengthHeightCm: 85,
    })
  })

  it("tampilan rapi seperti sheet PSG: pita judul, header hijau, kolom berwarna, kolom V–AF tersembunyi", async () => {
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(psgTemplateBuffer() as unknown as ExcelJS.Buffer)
    const sheet = book.getWorksheet("PSG")!
    const argb = (address: string) =>
      (sheet.getCell(address).fill as ExcelJS.FillPattern | undefined)?.fgColor
        ?.argb

    // Pita judul tergabung dan berwarna biru muda.
    expect(sheet.getCell("B1").isMerged).toBe(true)
    expect(argb("B1")).toBe("FFC5D9F1")
    // Header hijau; kolom Umur kuning; kolom hasil hitungan berwarna.
    expect(argb("C6")).toBe("FF00FF00")
    expect(argb("K9")).toBe("FFFFFF00")
    expect(argb("Q9")).toBe("FFF2DCDB")
    expect(argb("R9")).toBe("FFFDE9D9")
    expect(argb("S9")).toBe("FFDAEEF3")
    expect(argb("T9")).toBe("FFCCFFCC")
    // Nomor urut 1–100 terisi; kolom nama kosong.
    expect(sheet.getCell("B9").value).toBe(1)
    expect(sheet.getCell("B108").value).toBe(100)
    expect(sheet.getCell("C9").value).toBeNull()
    // Kolom hitungan lanjutan workbook disembunyikan; Posyandu (AG) tampil.
    expect(sheet.getColumn("V").hidden).toBe(true)
    expect(sheet.getColumn("AF").hidden).toBe(true)
    expect(sheet.getColumn("AG").hidden).toBeFalsy()
    // Judul tetap terlihat saat menggulir.
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 7 })
  })

  it("kolom isian punya validasi untuk mencegah salah ketik (mis. TB 814)", async () => {
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(psgTemplateBuffer() as unknown as ExcelJS.Buffer)
    const sheet = book.getWorksheet("PSG")!
    const rule = (address: string) => sheet.getCell(address).dataValidation

    expect(rule("D9")).toMatchObject({ type: "whole", formulae: [1, 2] })
    expect(rule("F9")).toMatchObject({ type: "whole", formulae: [1, 12] })
    expect(rule("L9")).toMatchObject({ type: "decimal", formulae: [1, 30] })
    expect(rule("M9")).toMatchObject({ type: "decimal", formulae: [35, 130] })
    expect(rule("M108")?.errorStyle).toBe("stop")
    // Kolom hasil hitungan tidak diberi validasi.
    expect(rule("N9")).toBeUndefined()
  })

  it("petunjuk melarang angka perkiraan dan menjelaskan kolom otomatis", () => {
    const book = XLSX.read(psgTemplateBytes(), { type: "array" })
    const text = XLSX.utils
      .sheet_to_json<unknown[]>(book.Sheets["Petunjuk"], { header: 1 })
      .flat()
      .join("\n")
    expect(text).toContain("Jangan mengisi angka perkiraan")
    expect(text).toContain("memuat nama anak")
    expect(text).toContain("diisi otomatis oleh OpenASP")
  })
})
