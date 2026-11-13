import { readFileSync } from "node:fs"
import { join } from "node:path"

import ExcelJS from "exceljs"
import * as XLSX from "xlsx"
import { describe, expect, it } from "vitest"

import {
  STATUS_LIST_DEFS,
  type ListedChild,
  type StatusLists,
} from "@/domain/reporting/lists"
import type { RecheckEntry } from "@/domain/reporting/recheck"
import { detectAdapter } from "@/features/excel-import/adapters"

import { buildPsgWorkbook, type PsgWorkbookMeta } from "./psg-workbook"
import { readWorkbook } from "./workbook-reader"

const TEMPLATE = new Uint8Array(
  readFileSync(join(process.cwd(), "public", "templates", "template-psg.xlsx"))
)

const entry = (
  name: string,
  extra: Partial<ListedChild> = {}
): ListedChild => ({
  childId: name,
  name,
  sex: "F",
  birthDate: "2025-04-20",
  posyandu: "JERUK",
  measuredAt: "2026-06-14",
  ageMonths: 13,
  weightKg: 8.5,
  heightCm: 74,
  waz: -1,
  haz: -2.2,
  whz: -0.5,
  wazCategory: "BB_NORMAL",
  hazCategory: "PENDEK",
  whzCategory: "GIZI_BAIK",
  ...extra,
})

const NORMAL: Partial<ListedChild> = { haz: 0, hazCategory: "TB_NORMAL" }

function status(all: ListedChild[]): StatusLists {
  const lists = Object.fromEntries(
    STATUS_LIST_DEFS.map((def) => [def.id, [] as ListedChild[]])
  ) as StatusLists["lists"]
  return { month: "2026-06", measured: all.length, all, lists }
}

const META: PsgWorkbookMeta = { generatedOn: "2026-11-13", validated: false }

const bytesOf = (
  all: ListedChild[],
  meta: PsgWorkbookMeta = META,
  recheck: RecheckEntry[] = []
) => buildPsgWorkbook("2026-06", status(all), meta, recheck, TEMPLATE)

const sheetOf = async (...args: Parameters<typeof bytesOf>) => {
  const book = XLSX.read(await bytesOf(...args), { type: "array" })
  expect(book.SheetNames).toEqual(["PSG"])
  return book.Sheets["PSG"]
}

const styled = async (...args: Parameters<typeof bytesOf>) => {
  const book = new ExcelJS.Workbook()
  await book.xlsx.load((await bytesOf(...args)) as unknown as ExcelJS.Buffer)
  return book.getWorksheet("PSG")!
}

const v = (sheet: XLSX.WorkSheet, address: string) => sheet[address]?.v

describe("buildPsgWorkbook (berbasis template PSG)", () => {
  it("kolom masukan dan hasil hitungan berada di posisi sheet PSG", async () => {
    const sheet = await sheetOf([entry("Anak Pendek")])
    expect(v(sheet, "C6")).toBe("NAMA")
    expect(v(sheet, "E6")).toBe("Tg.Timbang")
    expect(v(sheet, "H6")).toBe("Tgl.Lahir")
    expect(v(sheet, "N7")).toBe("TB / U")
    expect(v(sheet, "Q7")).toBe("TB / U")

    expect(v(sheet, "B9")).toBe(1)
    expect(v(sheet, "C9")).toBe("Anak Pendek")
    expect(v(sheet, "D9")).toBe(2)
    expect([v(sheet, "E9"), v(sheet, "F9"), v(sheet, "G9")]).toEqual([
      14, 6, 26,
    ])
    expect([v(sheet, "H9"), v(sheet, "I9"), v(sheet, "J9")]).toEqual([
      20, 4, 25,
    ])
    expect(v(sheet, "K9")).toBe(13)
    expect(v(sheet, "L9")).toBe(8.5)
    expect(v(sheet, "M9")).toBe(74)
    expect(v(sheet, "N9")).toBe(-2.2)
    expect(v(sheet, "O9")).toBe(-1)
    expect(v(sheet, "P9")).toBe(-0.5)
    expect(v(sheet, "Q9")).toBe("Pendek")
    expect(v(sheet, "R9")).toBe("Berat badan normal")
    expect(v(sheet, "S9")).toBe("Gizi baik")
    expect(v(sheet, "U9")).toBe(15.5)
    expect(v(sheet, "AG9")).toBe("JERUK")
  })

  it("penanda 1/0 dan ringkasan JML dan persen berada di kanan POSY", async () => {
    const sheet = await sheetOf([
      entry("A"),
      entry("B"),
      entry("C", NORMAL),
      entry("D", NORMAL),
    ])
    expect(v(sheet, "AJ6")).toBe("PDK")
    expect(v(sheet, "AJ9")).toBe(1) // PDK
    expect(v(sheet, "AP9")).toBe(1) // MSL
    expect(v(sheet, "AK9")).toBe(0) // S.PDK
    expect(v(sheet, "AJ11")).toBe(0)
    expect(v(sheet, "AP11")).toBe(0)
    expect(v(sheet, "AJ4")).toBe(2)
    expect(v(sheet, "AJ5")).toBe(50)
  })

  it("BBK tidak termasuk bermasalah (MSL), seperti rumus workbook", async () => {
    const sheet = await sheetOf([
      entry("BBK saja", { ...NORMAL, wazCategory: "BB_KURANG", waz: -2.5 }),
    ])
    expect(v(sheet, "AR9")).toBe(1)
    expect(v(sheet, "AP9")).toBe(0)
  })

  it("anak berstatus tidak normal diberi tahu: PERLU DICEK dan KETERANGAN", async () => {
    const sheet = await sheetOf([
      entry("Anak Pendek"),
      entry("Anak Normal", NORMAL),
    ])
    expect(v(sheet, "AH6")).toBe("PERLU")
    expect(v(sheet, "AH9")).toBe("YA")
    expect(v(sheet, "AI9")).toContain("TB/U: Pendek (z -2,20)")
    expect(v(sheet, "AH10")).toBeUndefined()
    expect(v(sheet, "AI10")).toBeUndefined()
  })

  it("alasan data janggal dari daftar ukur ulang ikut ditulis (mis. TB 814 cm)", async () => {
    const janggal = entry("Anak Salah Ketik", {
      ...NORMAL,
      heightCm: 814,
      haz: 237.6,
      hazCategory: "TINGGI",
    })
    const recheck = [
      {
        childId: "Anak Salah Ketik",
        reasons: [
          {
            code: "DI_LUAR_RENTANG",
            message: "Panjang/tinggi 814 cm di luar rentang wajar balita.",
          },
        ],
      },
    ] as RecheckEntry[]
    const sheet = await sheetOf([janggal], META, recheck)
    expect(v(sheet, "AH9")).toBe("YA")
    expect(v(sheet, "AI9")).toContain("di luar rentang wajar")
    expect(v(sheet, "AI9")).toContain("TB/U: Tinggi")
  })

  it("berkas dikenali adapter PSG dan bisa diimpor kembali", async () => {
    const workbook = readWorkbook(
      await bytesOf([entry("Anak Pendek"), entry("Anak Normal", NORMAL)])
    )
    const adapter = detectAdapter(workbook)
    expect(adapter?.id).toBe("asp-psg")
    const batch = adapter!.parse(workbook, "psg.xlsx")
    expect(batch.issues.filter((i) => i.severity === "error")).toEqual([])
    expect(batch.children.map((c) => [c.name, c.birthDate, c.sex])).toEqual([
      ["Anak Pendek", "2025-04-20", "F"],
      ["Anak Normal", "2025-04-20", "F"],
    ])
    expect(batch.measurements[0]).toMatchObject({
      measuredAt: "2026-06-14",
      weightKg: 8.5,
      rawLengthHeightCm: 74,
    })
  })

  it("judul menyebut periode, cakupan, data pribadi, dan belum tervalidasi", async () => {
    const sheet = await sheetOf([entry("A")], { ...META, scope: "JERUK" })
    const header = ["B2", "B3", "B4"].map((a) => String(v(sheet, a))).join("\n")
    expect(header).toContain("Juni 2026")
    expect(header).toContain("JERUK")
    expect(header).toContain("memuat nama dan tanggal lahir")
    expect(header).toContain("belum divalidasi")
  })

  it("tanpa anak: ringkasan nol dan tidak ada baris data", async () => {
    const sheet = await sheetOf([])
    expect(v(sheet, "AJ4")).toBe(0)
    expect(v(sheet, "C9")).toBeUndefined()
  })

  it("baris yang tidak terpakai dibuang: tidak ada nomor urut tanpa anak", async () => {
    const sheet = await sheetOf([entry("A"), entry("B")])
    expect(v(sheet, "B10")).toBe(2)
    expect(v(sheet, "B11")).toBeUndefined()
  })

  it("nama berawalan tanda rumus tetap sel teks", async () => {
    const cell = (await sheetOf([entry("=1+1")]))["C9"]
    expect(cell.t).toBe("s")
    expect(cell.f).toBeUndefined()
    expect(cell.v).toBe("=1+1")
  })
})

describe("tampilan hasil PSG (sama dengan template)", () => {
  it("pita judul, header hijau, dan kolom berwarna seperti template", async () => {
    const sheet = await styled([entry("A"), entry("B", NORMAL)])
    const argb = (address: string) =>
      (sheet.getCell(address).fill as ExcelJS.FillPattern | undefined)?.fgColor
        ?.argb
    expect(sheet.getCell("B1").isMerged).toBe(true)
    expect(argb("B1")).toBe("FFC5D9F1")
    expect(argb("C6")).toBe("FF00FF00")
    expect(argb("K9")).toBe("FFFFFF00") // Umur kuning
    expect(argb("N9")).toBe("FFDDD9C4") // z-score
    expect(argb("S9")).toBe("FFDAEEF3") // status BB/TB
    expect(argb("U9")).toBe("FFCCFFCC") // IMT
    expect(sheet.getColumn("V").hidden).toBe(true)
    expect(sheet.getColumn("AG").hidden).toBeFalsy()
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 7 })
  })

  it("status tidak normal berwarna merah tebal dan baris perlu perhatian diberi latar merah muda", async () => {
    const sheet = await styled([
      entry("Anak Pendek"),
      entry("Anak Normal", NORMAL),
    ])
    const font = (address: string) => sheet.getCell(address).font
    const argb = (address: string) =>
      (sheet.getCell(address).fill as ExcelJS.FillPattern | undefined)?.fgColor
        ?.argb

    expect(font("Q9")?.color?.argb).toBe("FFC00000")
    expect(font("Q9")?.bold).toBe(true)
    expect(font("R9")?.color?.argb).not.toBe("FFC00000") // BB/U normal
    expect(font("Q10")?.color?.argb).not.toBe("FFC00000") // anak normal

    expect(argb("C9")).toBe("FFFFC7CE")
    expect(argb("AH9")).toBe("FFFFC7CE")
    expect(argb("C10")).not.toBe("FFFFC7CE")
  })

  it("nilai z-score berformat dua desimal", async () => {
    const sheet = await styled([entry("A")])
    expect(sheet.getCell("N9").numFmt).toBe("0.00")
    expect(sheet.getCell("U9").numFmt).toBe("0.0")
  })

  it("lebih dari 100 anak: baris tambahan meniru gaya template", async () => {
    const many = Array.from({ length: 105 }, (_, i) =>
      entry(`Anak ${String(i).padStart(3, "0")}`, NORMAL)
    )
    const sheet = await styled(many)
    const argb = (address: string) =>
      (sheet.getCell(address).fill as ExcelJS.FillPattern | undefined)?.fgColor
        ?.argb
    // Baris ke-105 = baris Excel 113, di luar 100 baris bawaan template.
    expect(sheet.getCell("B113").value).toBe(105)
    expect(sheet.getCell("C113").value).toBe("Anak 104")
    expect(argb("K113")).toBe("FFFFFF00")
    expect(sheet.getCell("C113").border?.top?.style).toBe("thin")
  })
})
