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

const NORMAL: Partial<ListedChild> = {
  haz: 0,
  hazCategory: "TB_NORMAL",
}

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
) => buildPsgWorkbook("2026-06", status(all), meta, recheck)

const sheetOf = (...args: Parameters<typeof bytesOf>) => {
  const book = XLSX.read(bytesOf(...args), { type: "array" })
  expect(book.SheetNames).toEqual(["PSG"])
  return book.Sheets["PSG"]
}

const v = (sheet: XLSX.WorkSheet, address: string) => sheet[address]?.v

describe("buildPsgWorkbook (tata letak sheet PSG)", () => {
  it("kolom masukan dan hasil hitungan berada di posisi sheet PSG workbook", () => {
    const sheet = sheetOf([entry("Anak Pendek")])
    // Judul kolom.
    expect(v(sheet, "C6")).toBe("NAMA")
    expect(v(sheet, "E6")).toBe("Tg.Timbang")
    expect(v(sheet, "H6")).toBe("Tgl.Lahir")
    expect(v(sheet, "N7")).toBe("TB / U")
    expect(v(sheet, "Q7")).toBe("TB / U")
    // Baris data pertama = baris 9.
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
    expect(v(sheet, "T9")).toBe(15.5)
    expect(v(sheet, "AG9")).toBe("JERUK")
  })

  it("penanda 1/0 per kolom dan ringkasan JML dan persen", () => {
    const sheet = sheetOf([
      entry("A"),
      entry("B"),
      entry("C", NORMAL),
      entry("D", NORMAL),
    ])
    expect(v(sheet, "W9")).toBe(1) // PDK
    expect(v(sheet, "AC9")).toBe(1) // MSL
    expect(v(sheet, "X9")).toBe(0) // S.PDK
    expect(v(sheet, "W11")).toBe(0)
    expect(v(sheet, "AC11")).toBe(0)
    expect(v(sheet, "W4")).toBe(2)
    expect(v(sheet, "W5")).toBe(50)
  })

  it("BBK tidak termasuk bermasalah (MSL), seperti rumus workbook", () => {
    const sheet = sheetOf([
      entry("BBK saja", {
        ...NORMAL,
        wazCategory: "BB_KURANG",
        waz: -2.5,
      }),
    ])
    expect(v(sheet, "AH9")).toBe(1)
    expect(v(sheet, "AC9")).toBe(0)
  })

  it("anak berstatus tidak normal diberi tahu: PERLU DICEK dan KETERANGAN", () => {
    const sheet = sheetOf([entry("Anak Pendek"), entry("Anak Normal", NORMAL)])
    expect(v(sheet, "U9")).toBe("YA")
    expect(v(sheet, "AI9")).toContain("TB/U: Pendek (z -2,20)")
    expect(v(sheet, "U10")).toBeUndefined()
    expect(v(sheet, "AI10")).toBeUndefined()
  })

  it("alasan data janggal dari daftar ukur ulang ikut ditulis (mis. TB 814 cm)", () => {
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
    const sheet = sheetOf([janggal], META, recheck)
    expect(v(sheet, "U9")).toBe("YA")
    expect(v(sheet, "AI9")).toContain("di luar rentang wajar")
    expect(v(sheet, "AI9")).toContain("TB/U: Tinggi")
  })

  it("berkas dikenali adapter PSG dan bisa diimpor kembali", () => {
    const workbook = readWorkbook(
      bytesOf([entry("Anak Pendek"), entry("Anak Normal", NORMAL)])
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

  it("keterangan menyebut data pribadi, belum tervalidasi, dan cakupan", () => {
    const sheet = sheetOf([entry("A")], { ...META, scope: "JERUK" })
    const header = [1, 2, 3, 4]
      .map((row) => String(v(sheet, `B${row}`)))
      .join("\n")
    expect(header).toContain("memuat nama dan tanggal lahir")
    expect(header).toContain("belum divalidasi")
    expect(header).toContain("JERUK")
  })

  it("tanpa anak: ringkasan nol dan tidak ada baris data", () => {
    const sheet = sheetOf([])
    expect(v(sheet, "W4")).toBe(0)
    expect(v(sheet, "C9")).toBeUndefined()
  })

  it("nama berawalan tanda rumus tetap sel teks", () => {
    const cell = sheetOf([entry("=1+1")])["C9"]
    expect(cell.t).toBe("s")
    expect(cell.f).toBeUndefined()
    expect(cell.v).toBe("=1+1")
  })
})
