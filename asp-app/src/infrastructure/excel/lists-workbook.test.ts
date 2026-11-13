import * as XLSX from "xlsx"
import { describe, expect, it } from "vitest"

import {
  STATUS_LIST_DEFS,
  TARGET_LIST_DEFS,
  type ListedChild,
  type StatusListId,
  type StatusLists,
  type TargetLists,
} from "@/domain/reporting/lists"

import { buildListsWorkbook } from "./lists-workbook"

const entry = (name: string): ListedChild => ({
  childId: name,
  name,
  sex: "F",
  birthDate: "2025-03-01",
  posyandu: "JERUK",
  measuredAt: "2026-06-10",
  ageMonths: 14,
  weightKg: 8.5,
  heightCm: 74,
  waz: -2.5,
  haz: -2.2,
  whz: -1.9,
  wazCategory: "BB_KURANG",
  hazCategory: "PENDEK",
  whzCategory: "GIZI_BAIK",
})

function status(overrides: Partial<Record<StatusListId, ListedChild[]>>) {
  const lists = Object.fromEntries(
    STATUS_LIST_DEFS.map((def) => [def.id, overrides[def.id] ?? []])
  ) as StatusLists["lists"]
  return { month: "2026-06", measured: 3, all: [], lists } satisfies StatusLists
}

const targets: TargetLists = {
  month: "2026-06",
  lists: {
    VITAMIN_A_BIRU: [
      {
        childId: "x",
        name: "Anak Biru",
        sex: "M",
        posyandu: null,
        ageMonths: 8,
        status: "UNKNOWN",
      },
    ],
    VITAMIN_A_MERAH: [],
    ASI: [],
  },
}

const META = { generatedOn: "2026-11-13", validated: false }

function read(
  s: StatusLists,
  t: TargetLists = targets,
  meta: { generatedOn: string; validated: boolean; scope?: string } = META
) {
  return XLSX.read(buildListsWorkbook("2026-06", s, t, meta), {
    type: "array",
  })
}

const rowsOf = (book: XLSX.WorkBook, name: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], {
    header: 1,
    defval: null,
    blankrows: false,
  })

describe("buildListsWorkbook", () => {
  it("membuat satu sheet per daftar setelah sheet Catatan", () => {
    const book = read(status({}))
    expect(book.SheetNames).toEqual([
      "Catatan",
      ...STATUS_LIST_DEFS.map((d) => d.title),
      ...TARGET_LIST_DEFS.map((d) => d.title),
    ])
  })

  it("memuat nama, Posyandu, dan nilai gizi tetapi bukan NIK atau tanggal lahir", () => {
    const book = read(status({ PENDEK: [entry("Anak Contoh")] }))
    const rows = rowsOf(book, "Pendek")
    expect(rows[1]).toEqual([
      "Anak Contoh",
      "JERUK",
      "P",
      14,
      8.5,
      74,
      "Berat badan kurang",
      -2.5,
      "Pendek",
      -2.2,
      "Gizi baik",
      -1.9,
    ])
    const everything = JSON.stringify(
      book.SheetNames.map((n) => rowsOf(book, n))
    )
    expect(everything).not.toContain("2026-06-10")
  })

  it("Catatan menyebut data pribadi, belum tervalidasi, jumlah, dan cakupan Posyandu", () => {
    const book = read(status({ PENDEK: [entry("A"), entry("B")] }), targets, {
      ...META,
      scope: "JERUK",
    })
    const text = rowsOf(book, "Catatan").flat().map(String).join("\n")
    expect(text).toContain("memuat nama anak")
    expect(text).toContain("belum divalidasi oleh tenaga kesehatan")
    expect(text).toContain("JERUK")
    const row = rowsOf(book, "Catatan").find((r) => r[0] === "Pendek")
    expect(row?.[1]).toBe(2)
  })

  it("nama yang diawali tanda rumus tetap sel teks, bukan rumus", () => {
    const book = read(status({ PENDEK: [entry("=1+1")] }))
    const cell = book.Sheets["Pendek"]["A2"]
    expect(cell.t).toBe("s")
    expect(cell.f).toBeUndefined()
    expect(cell.v).toBe("=1+1")
  })

  it("daftar kosong tetap menghasilkan sheet berisi judul kolom saja", () => {
    const rows = rowsOf(read(status({})), "Kurus")
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe("Nama")
  })

  it("daftar sasaran memakai label status yang sesuai", () => {
    const rows = rowsOf(read(status({})), "Sasaran Vitamin A biru")
    expect(rows[1]).toEqual(["Anak Biru", null, "L", 8, "Belum tercatat"])
  })
})
