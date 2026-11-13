import "fake-indexeddb/auto"

import * as XLSX from "xlsx"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { planCorrections } from "@/domain/reporting/corrections"
import type { RecheckEntry } from "@/domain/reporting/recheck"
import { buildRecheckWorkbook } from "@/infrastructure/excel/recheck-workbook"
import { OpenAspDatabase } from "@/infrastructure/storage/db"
import {
  createChild,
  createMeasurement,
  listChildren,
  listMeasurementsForChild,
} from "@/infrastructure/storage/repositories/child-repository"

import { applyCorrections } from "./apply-corrections"
import { CorrectionFileError, readCorrectionRows } from "./read-corrections"

let db: OpenAspDatabase
let counter = 0

beforeEach(() => {
  db = new OpenAspDatabase(`openasp-corrections-test-${++counter}`)
})

afterEach(async () => {
  db.close()
  await db.delete()
})

const entryFor = (id: string): RecheckEntry => ({
  childId: "c",
  measurementId: id,
  name: "Anak Uji",
  sex: "F",
  posyandu: "JERUK",
  measuredAt: "2026-06-10",
  weightKg: 9,
  heightCm: 75,
  previousMeasuredAt: null,
  previousWeightKg: null,
  previousHeightCm: null,
  reasons: [{ code: "PENDEK", message: "TB/U pendek." }],
})

/** Meniru petugas: membuka berkas unduhan, mengisi tiga kolom, lalu menyimpannya. */
function filled(id: string, values: [unknown, unknown, unknown]): ArrayBuffer {
  const bytes = buildRecheckWorkbook("2026-06", [entryFor(id)], {
    generatedOn: "2026-11-13",
  })
  const book = XLSX.read(bytes, { type: "array" })
  const sheet = book.Sheets["Perlu diukur ulang"]
  const [weight, height, date] = values
  const put = (cell: string, value: unknown) => {
    if (value === null) return
    sheet[cell] =
      typeof value === "number"
        ? { t: "n", v: value }
        : { t: "s", v: String(value) }
  }
  put("L2", weight)
  put("M2", height)
  put("N2", date)
  sheet["!ref"] = "A1:N2"
  const out = XLSX.write(book, { type: "array", bookType: "xlsx" })
  return out as ArrayBuffer
}

describe("readCorrectionRows", () => {
  it("membaca kode dan tiga kolom isian petugas", () => {
    const rows = readCorrectionRows(filled("m-1", [9.4, 76.5, "2026-06-24"]))
    expect(rows).toEqual([
      {
        rowNumber: 2,
        code: "m-1",
        rawWeight: 9.4,
        rawHeight: 76.5,
        rawDate: "2026-06-24",
      },
    ])
  })

  it("baris yang tidak diisi tetap terbaca sebagai baris kosong", () => {
    const [row] = readCorrectionRows(filled("m-1", [null, null, null]))
    expect(row.rawWeight).toBeNull()
    expect(row.rawDate).toBeNull()
  })

  it("menolak berkas tanpa sheet atau kolom yang dibutuhkan", () => {
    const wrongSheet = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wrongSheet,
      XLSX.utils.aoa_to_sheet([["a"]]),
      "Lain"
    )
    expect(() =>
      readCorrectionRows(
        XLSX.write(wrongSheet, { type: "array", bookType: "xlsx" })
      )
    ).toThrow(CorrectionFileError)

    const noColumns = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      noColumns,
      XLSX.utils.aoa_to_sheet([["Kode", "Nama"]]),
      "Perlu diukur ulang"
    )
    expect(() =>
      readCorrectionRows(
        XLSX.write(noColumns, { type: "array", bookType: "xlsx" })
      )
    ).toThrow(/Kolom tidak lengkap/)
  })
})

describe("applyCorrections", () => {
  async function seed() {
    const child = await createChild(db, {
      name: "Anak Uji",
      birthDate: "2024-03-01",
      sex: "F",
      nik: null,
    })
    const original = await createMeasurement(db, child.id, {
      measuredAt: "2026-06-10",
      weightKg: 9,
      rawLengthHeightCm: 75,
      measurementPosition: "UNKNOWN",
      lilaCm: null,
      headCircumferenceCm: null,
      rowNote: null,
    })
    return { child, original }
  }

  it("menyimpan hasil ukur ulang sebagai pengukuran baru dan TIDAK menimpa yang lama", async () => {
    const { child, original } = await seed()
    const rows = readCorrectionRows(
      filled(original.id, [9.4, 76.5, "2026-06-24"])
    )
    const plan = planCorrections(
      rows,
      await listChildren(db),
      await listMeasurementsForChild(db, child.id),
      "2026-11-13"
    )
    expect(plan.rejected).toEqual([])

    const result = await applyCorrections(db, plan.items)
    expect(result).toEqual({ saved: 1, failed: [] })

    const all = await listMeasurementsForChild(db, child.id)
    expect(all).toHaveLength(2)
    const old = all.find((m) => m.id === original.id)!
    expect(old).toMatchObject({
      measuredAt: "2026-06-10",
      weightKg: 9,
      rawLengthHeightCm: 75,
    })
    const added = all.find((m) => m.id !== original.id)!
    expect(added).toMatchObject({
      measuredAt: "2026-06-24",
      weightKg: 9.4,
      rawLengthHeightCm: 76.5,
    })
    expect(added.rowNote).toContain("Ukuran semula 2026-06-10")
    expect(added.rowNote).toContain("BB 9 kg")
  })

  it("satu baris gagal tidak membatalkan baris lain", async () => {
    const { child, original } = await seed()
    const [item] = planCorrections(
      readCorrectionRows(filled(original.id, [9.4, 76.5, "2026-06-24"])),
      await listChildren(db),
      await listMeasurementsForChild(db, child.id),
      "2026-11-13"
    ).items

    // Seseorang menambah pengukuran pada tanggal yang sama sebelum disimpan.
    await createMeasurement(db, child.id, {
      measuredAt: "2026-06-24",
      weightKg: 9.1,
      rawLengthHeightCm: 76,
      measurementPosition: "UNKNOWN",
      lilaCm: null,
      headCircumferenceCm: null,
      rowNote: null,
    })
    const result = await applyCorrections(db, [
      item,
      {
        ...item,
        rowNumber: 3,
        next: { ...item.next, measuredAt: "2026-06-26" },
      },
    ])
    expect(result.saved).toBe(1)
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0].rowNumber).toBe(item.rowNumber)
  })
})
