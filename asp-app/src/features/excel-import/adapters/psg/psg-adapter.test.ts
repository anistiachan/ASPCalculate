import { describe, expect, it } from "vitest"

import type { SheetData, WorkbookData } from "../../types"
import { columnIndex } from "../karangtawar/layout"
import { composeImportKey } from "../karangtawar/parse-posyandu-sheet"
import { psgAdapter } from "./psg-adapter"

type RowSpec = Partial<{
  name: string | number
  sex: number
  mDay: number
  mMonth: number
  mYear: number
  bDay: number
  bMonth: number
  bYear: number
  weight: number
  height: number
  posyandu: string
}>

const SPEC_COLUMNS: Record<keyof RowSpec, string> = {
  name: "C",
  sex: "D",
  mDay: "E",
  mMonth: "F",
  mYear: "G",
  bDay: "H",
  bMonth: "I",
  bYear: "J",
  weight: "L",
  height: "M",
  posyandu: "AG",
}

const setCell = (row: unknown[], letters: string, value: unknown) => {
  row[columnIndex(letters)] = value
}

function child(spec: RowSpec = {}): unknown[] {
  const full: RowSpec = {
    name: "Anak Satu",
    sex: 2,
    mDay: 14,
    mMonth: 6,
    mYear: 25,
    bDay: 20,
    bMonth: 2,
    bYear: 24,
    weight: 9.5,
    height: 75,
    posyandu: "JERUK",
    ...spec,
  }
  const row: unknown[] = []
  for (const [key, value] of Object.entries(full)) {
    setCell(row, SPEC_COLUMNS[key as keyof RowSpec], value)
  }
  return row
}

function psgSheet(children: unknown[][], name = "PSG"): SheetData {
  const rows: unknown[][] = Array.from({ length: 8 }, () => [])
  setCell(rows[5], "C", "NAMA")
  setCell(rows[5], "E", "Tg.Timbang")
  setCell(rows[5], "H", "Tgl.Lahir")
  rows.push(...children)
  return { name, rows }
}

const workbook = (...sheets: SheetData[]): WorkbookData => ({ sheets })

describe("psgAdapter.detect", () => {
  it("mengenali sheet PSG dengan header yang benar", () => {
    expect(psgAdapter.detect(workbook(psgSheet([])))).toBe(true)
  })

  it("menolak sheet bernama lain atau header berbeda", () => {
    expect(psgAdapter.detect(workbook(psgSheet([], "Lain")))).toBe(false)
    const rusak = psgSheet([])
    rusak.rows[5][columnIndex("E")] = "Tanggal"
    expect(psgAdapter.detect(workbook(rusak))).toBe(false)
  })
})

describe("psgAdapter.parse", () => {
  it("membuat anak dan satu pengukuran dari baris PSG", () => {
    const batch = psgAdapter.parse(
      workbook(psgSheet([child()])),
      "psg-juni.xlsx"
    )
    expect(batch.issues.filter((i) => i.severity === "error")).toEqual([])
    expect(batch.children).toHaveLength(1)
    expect(batch.children[0]).toMatchObject({
      keyKind: "composite",
      posyandu: "JERUK",
      name: "Anak Satu",
      birthDate: "2024-02-20",
      sex: "F",
    })
    expect(batch.measurements).toHaveLength(1)
    expect(batch.measurements[0]).toMatchObject({
      measuredAt: "2025-06-14",
      weightKg: 9.5,
      rawLengthHeightCm: 75,
      measurementPosition: "UNKNOWN",
    })
  })

  it("kunci anak sama dengan adapter sheet P sehingga data menyatu", () => {
    const batch = psgAdapter.parse(workbook(psgSheet([child()])), "x.xlsx")
    expect(batch.children[0].sourceKey).toBe(
      composeImportKey("JERUK", "Anak Satu", "2024-02-20")
    )
    expect(batch.measurements[0].sourceChildKey).toBe(
      batch.children[0].sourceKey
    )
  })

  it("baris kosong atau bernama '0' dilewati", () => {
    const batch = psgAdapter.parse(
      workbook(psgSheet([child({ name: 0 }), child({ name: "" }), child()])),
      "x.xlsx"
    )
    expect(batch.children).toHaveLength(1)
  })

  it("anak tanpa BB dan TB tetap menjadi anak, tanpa pengukuran", () => {
    const batch = psgAdapter.parse(
      workbook(psgSheet([child({ weight: 0, height: 0 })])),
      "x.xlsx"
    )
    expect(batch.children).toHaveLength(1)
    expect(batch.measurements).toHaveLength(0)
    const summary = batch.sheetSummaries.find((s) => s.kind === "measurements")
    expect(summary?.rowsWithoutMeasurement).toBe(1)
  })

  it("TB 0 tetapi BB ada: hanya BB yang diimpor", () => {
    const batch = psgAdapter.parse(
      workbook(psgSheet([child({ height: 0 })])),
      "x.xlsx"
    )
    expect(batch.measurements[0].weightKg).toBe(9.5)
    expect(batch.measurements[0].rawLengthHeightCm).toBeNull()
  })

  it("jenis kelamin atau tanggal lahir tidak valid ditolak per baris", () => {
    const batch = psgAdapter.parse(
      workbook(psgSheet([child({ sex: 0 }), child({ bMonth: 13 }), child()])),
      "x.xlsx"
    )
    expect(batch.children).toHaveLength(1)
    const errors = batch.issues.filter((i) => i.severity === "error")
    expect(errors.map((e) => e.field)).toEqual(["sex", "birthDate"])
    expect(errors.map((e) => e.row)).toEqual([9, 10])
  })

  it("Posyandu kosong ditolak", () => {
    const batch = psgAdapter.parse(
      workbook(psgSheet([child({ posyandu: "" })])),
      "x.xlsx"
    )
    expect(batch.children).toHaveLength(0)
    expect(batch.issues.some((i) => i.field === "posyandu")).toBe(true)
  })

  it("hari timbang kosong memakai tanggal 14", () => {
    const row = child()
    row[columnIndex("E")] = undefined
    const batch = psgAdapter.parse(workbook(psgSheet([row])), "x.xlsx")
    expect(batch.measurements[0].measuredAt).toBe("2025-06-14")
  })

  it("memperingatkan TB bulan selain Jan/Feb/Agu mungkin perkiraan rumus", () => {
    const juni = psgAdapter.parse(workbook(psgSheet([child()])), "x.xlsx")
    expect(
      juni.issues.some(
        (i) => i.severity === "warning" && i.message.includes("rumus perkiraan")
      )
    ).toBe(true)

    const februari = psgAdapter.parse(
      workbook(psgSheet([child({ mMonth: 2 })])),
      "x.xlsx"
    )
    expect(
      februari.issues.some((i) => i.message.includes("rumus perkiraan"))
    ).toBe(false)
    expect(februari.issues.some((i) => i.code === "POSITION_UNKNOWN")).toBe(
      true
    )
  })

  it("sheet lain pada berkas dilewati dengan alasan", () => {
    const batch = psgAdapter.parse(
      workbook(psgSheet([child()]), { name: "SKDN", rows: [] }),
      "x.xlsx"
    )
    expect(batch.skippedSheets).toEqual([
      expect.objectContaining({ name: "SKDN" }),
    ])
  })

  it("sheet PSG tanpa anak dilewati sebagai 'belum ada data'", () => {
    const batch = psgAdapter.parse(workbook(psgSheet([])), "x.xlsx")
    expect(batch.children).toHaveLength(0)
    expect(batch.skippedSheets[0].reason).toBe("Belum ada data anak.")
  })
})
