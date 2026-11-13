import * as XLSX from "xlsx"
import { beforeAll, describe, expect, it } from "vitest"

import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import type { ReferenceSet } from "@/domain/anthropometry/references/reference"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import type { MonthlyRecap } from "@/domain/reporting/monthly-recap"
import {
  INDICATOR_CATEGORIES,
  STATUS_INDICATORS,
} from "@/domain/reporting/status-groups"
import { computeRecapForMonth } from "@/features/reports/services/recap-for-month"

import { buildRecapWorkbook, type RecapWorkbookMeta } from "./recap-workbook"

let refs: ReferenceSet
beforeAll(async () => {
  refs = await loadWho2006References()
})

const SECRET_NAME = "Nama Rahasia Uji"
const SECRET_NIK = "3200000000009999"

const child = (id: string, sex: "M" | "F", birthDate: string): StoredChild => ({
  id,
  sourceKey: SECRET_NIK + id,
  name: `${SECRET_NAME} ${id}`,
  birthDate,
  sex,
  birthOrder: null,
  birthWeightKg: null,
  birthLengthCm: null,
  birthHeadCircumferenceCm: null,
  importBatchId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
})

let counter = 0
const measurement = (
  childId: string,
  measuredAt: string,
  overrides: Partial<StoredMeasurement> = {}
): StoredMeasurement => ({
  id: `m${++counter}`,
  childId,
  measuredAt,
  weightKg: 11,
  rawLengthHeightCm: 82,
  measurementPosition: "STANDING",
  rawMeasurementPosition: null,
  lilaCm: null,
  headCircumferenceCm: null,
  rawPittingEdema: null,
  vitaminAStatus: true,
  breastfeedingByMonth: {},
  motherToddlerClassAttendance: null,
  mbgStatus: null,
  rowNote: "=CATATAN+BERBAHAYA",
  sourceSheet: null,
  sourceRow: null,
  importBatchId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
})

const META: RecapWorkbookMeta = {
  generatedOn: "2026-11-13",
  algorithmVersion: "openasp-anthro-0.1.0",
  referenceVersion: "WHO-2006 expanded tables (uji)",
  validated: false,
}

function buildRecap(): MonthlyRecap {
  const children = [
    child("1", "M", "2025-01-10"),
    child("2", "F", "2025-02-10"),
    child("3", "F", "2025-03-10"),
  ]
  const ms = [
    measurement("1", "2026-06-05"),
    measurement("2", "2026-06-06", { vitaminAStatus: false }),
    // Anak 3 tidak diukur bulan ini.
  ]
  return computeRecapForMonth("2026-06", children, ms, refs)
}

function readBack(recap: MonthlyRecap, meta = META) {
  const bytes = buildRecapWorkbook(recap, meta)
  return XLSX.read(bytes, { type: "array" })
}

const rowsOf = (book: XLSX.WorkBook, name: string) =>
  XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], {
    header: 1,
    defval: null,
    blankrows: false,
  })

describe("buildRecapWorkbook", () => {
  it("menghasilkan berkas xlsx sah dengan empat sheet berurutan", () => {
    const bytes = buildRecapWorkbook(buildRecap(), META)
    // Tanda pengenal ZIP (.xlsx).
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(readBack(buildRecap()).SheetNames).toEqual([
      "Ringkasan",
      "Status Gizi",
      "Vitamin A",
      "Catatan",
    ])
  })

  it("sheet Ringkasan memuat periode dan angka cakupan menurut jenis kelamin", () => {
    const rows = rowsOf(readBack(buildRecap()), "Ringkasan")
    // Baris pendek dibaca dengan sisa kolom null (lebar tabel), jadi hanya dua sel pertama.
    expect(rows[1].slice(0, 2)).toEqual(["Periode", "Juni 2026"])
    const byLabel = Object.fromEntries(rows.map((r) => [r[0] as string, r]))
    expect(byLabel["Balita terdata"]).toEqual(["Balita terdata", 1, 2, 3])
    expect(byLabel["Ditimbang (ada berat)"]).toEqual([
      "Ditimbang (ada berat)",
      1,
      1,
      2,
    ])
  })

  it("persen disimpan sebagai angka sejati berformat persen, bukan teks", () => {
    const book = readBack(buildRecap())
    const rows = rowsOf(book, "Ringkasan")
    const percentRow = rows.find((r) => String(r[0]).startsWith("Persen"))!
    // Total: 2 ditimbang dari 3 terdata.
    expect(percentRow[3]).toBeCloseTo(2 / 3, 10)
    const sheet = book.Sheets["Ringkasan"]
    const address = Object.keys(sheet).find(
      (key) => sheet[key]?.v === percentRow[3]
    )!
    expect(sheet[address].t).toBe("n")
  })

  it("persen dengan penyebut nol berupa strip, bukan 0 atau NaN", () => {
    const empty = computeRecapForMonth("2026-06", [], [], refs)
    const rows = rowsOf(readBack(empty), "Ringkasan")
    const percentRow = rows.find((r) => String(r[0]).startsWith("Persen"))!
    expect(percentRow.slice(1)).toEqual(["–", "–", "–"])
  })

  it("sheet Status Gizi memuat semua kategori setiap indikator beserta yang tidak dapat dihitung", () => {
    const rows = rowsOf(readBack(buildRecap()), "Status Gizi")
    expect(rows[0]).toEqual([
      "Indikator",
      "Kategori",
      "Laki-laki",
      "Perempuan",
      "Jumlah",
      "Persen",
    ])
    const expected = STATUS_INDICATORS.reduce(
      (sum, indicator) => sum + INDICATOR_CATEGORIES[indicator].length + 2,
      0
    )
    expect(rows.length - 1).toBe(expected)
    expect(rows.some((r) => r[1] === "Tidak dapat dihitung")).toBe(true)
    // Jumlah per baris = laki-laki + perempuan.
    for (const row of rows.slice(1)) {
      expect((row[2] as number) + (row[3] as number)).toBe(row[4])
    }
  })

  it("sheet Vitamin A menghitung ya dan tidak", () => {
    const rows = rowsOf(readBack(buildRecap()), "Vitamin A")
    expect(rows[1]).toEqual(["Tercatat ya", 1, 0, 1])
    expect(rows[2]).toEqual(["Tercatat tidak", 0, 1, 1])
  })

  it("TIDAK memuat data pribadi: nama, NIK, atau isian catatan pengguna", () => {
    const bytes = buildRecapWorkbook(buildRecap(), META)
    const book = XLSX.read(bytes, { type: "array" })
    const everything = book.SheetNames.flatMap((name) =>
      rowsOf(book, name).flat().map(String)
    ).join("\n")

    expect(everything).not.toContain(SECRET_NAME)
    expect(everything).not.toContain("3200000000009999")
    expect(everything).not.toContain("CATATAN+BERBAHAYA")
  })

  it("sel teks tidak pernah diawali = + - @ (aman dari injeksi rumus)", () => {
    const book = readBack(buildRecap())
    for (const name of book.SheetNames) {
      for (const row of rowsOf(book, name)) {
        for (const cell of row) {
          if (typeof cell === "string" && cell !== "") {
            expect(cell, `sel "${cell}" di sheet ${name}`).not.toMatch(
              /^[=+\-@\t\r]/
            )
          }
        }
      }
    }
  })

  it("peringatan validasi tercantum selama mesin belum divalidasi", () => {
    const notes = rowsOf(readBack(buildRecap()), "Catatan").flat().map(String)
    expect(notes.join("\n")).toContain("belum divalidasi oleh tenaga kesehatan")

    const validated = rowsOf(
      readBack(buildRecap(), { ...META, validated: true }),
      "Catatan"
    )
      .flat()
      .map(String)
    expect(validated.join("\n")).not.toContain("belum divalidasi")
  })

  it("mencatat versi algoritma, versi referensi, dan hal yang belum tersedia", () => {
    const text = rowsOf(readBack(buildRecap()), "Catatan")
      .flat()
      .map(String)
      .join("\n")
    expect(text).toContain("openasp-anthro-0.1.0")
    expect(text).toContain("WHO-2006 expanded tables (uji)")
    expect(text).toContain("SKDN")
    expect(text).toContain("2026-11-13")
  })
})
