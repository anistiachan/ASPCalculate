import { describe, expect, it } from "vitest"

import type { AnthropometryResult } from "@/domain/anthropometry/compute"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import {
  addMonths,
  buildCoverage,
  buildCoverageSeries,
  buildMonthlyRecap,
  buildOverview,
  indexMeasurementsByChild,
  isEligibleInMonth,
  lastDayOfMonth,
  monthKeyOf,
  ratio,
  recentMonths,
} from "./monthly-recap"

const child = (id: string, sex: "M" | "F", birthDate: string): StoredChild => ({
  id,
  sourceKey: null,
  name: `Anak ${id}`,
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
  weightKg: 10,
  rawLengthHeightCm: null,
  measurementPosition: "UNKNOWN",
  rawMeasurementPosition: null,
  lilaCm: null,
  headCircumferenceCm: null,
  rawPittingEdema: null,
  vitaminAStatus: null,
  breastfeedingByMonth: {},
  motherToddlerClassAttendance: null,
  mbgStatus: null,
  rowNote: null,
  sourceSheet: null,
  sourceRow: null,
  importBatchId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
})

const result = (
  overrides: Partial<AnthropometryResult> = {}
): AnthropometryResult => ({
  sex: "M",
  ageInDays: 400,
  ageInMonthsExact: 13,
  weightKg: 10,
  rawLengthHeightCm: null,
  measurementPosition: "UNKNOWN",
  correctedLengthHeightCm: null,
  correctionCm: 0,
  bmi: null,
  waz: null,
  haz: null,
  whz: null,
  baz: null,
  wazCategory: null,
  hazCategory: null,
  whzCategory: null,
  bazCategory: null,
  whzTable: null,
  flags: [],
  standardName: "uji",
  referenceDataVersion: "uji",
  algorithmVersion: "uji",
  ...overrides,
})

describe("bulan", () => {
  it("monthKeyOf mengambil YYYY-MM", () => {
    expect(monthKeyOf("2026-06-10")).toBe("2026-06")
  })

  it("lastDayOfMonth memperhitungkan tahun kabisat dan panjang bulan", () => {
    expect(lastDayOfMonth("2024-02")).toBe("2024-02-29")
    expect(lastDayOfMonth("2025-02")).toBe("2025-02-28")
    expect(lastDayOfMonth("2026-04")).toBe("2026-04-30")
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31")
  })

  it("addMonths melewati pergantian tahun ke dua arah", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01")
    expect(addMonths("2026-01", -1)).toBe("2025-12")
    expect(addMonths("2026-06", 0)).toBe("2026-06")
    expect(addMonths("2026-06", -18)).toBe("2024-12")
  })

  it("recentMonths: urut naik, panjang sesuai, berakhir di bulan yang diminta", () => {
    const months = recentMonths("2026-03", 12)
    expect(months).toHaveLength(12)
    expect(months[0]).toBe("2025-04")
    expect(months[11]).toBe("2026-03")
    expect(new Set(months).size).toBe(12)
  })
})

describe("isEligibleInMonth (balita terdata)", () => {
  const eligible = (birthDate: string, month: string) =>
    isEligibleInMonth({ birthDate }, month)

  it("belum lahir hingga akhir bulan: tidak terdata; lahir di hari terakhir: terdata", () => {
    expect(eligible("2026-07-01", "2026-06")).toBe(false)
    expect(eligible("2026-06-30", "2026-06")).toBe(true)
    expect(eligible("2026-06-01", "2026-06")).toBe(true)
  })

  it("umur 60 bulan penuh pada hari pertama bulan: keluar; 59 bulan: masuk", () => {
    // Lahir 2021-06-15: pada 2026-06-01 umur 59 bulan (belum genap 60) → masuk.
    expect(eligible("2021-06-15", "2026-06")).toBe(true)
    // Lahir 2021-06-01: pada 2026-06-01 tepat 60 bulan → keluar.
    expect(eligible("2021-06-01", "2026-06")).toBe(false)
    expect(eligible("2021-05-31", "2026-06")).toBe(false)
  })

  it("anak yang berulang tahun ke-5 di tengah bulan tetap terdata bulan itu", () => {
    expect(eligible("2021-06-20", "2026-06")).toBe(true)
    expect(eligible("2021-06-20", "2026-07")).toBe(false)
  })
})

describe("buildCoverage", () => {
  const children = [
    child("a", "M", "2025-01-10"),
    child("b", "F", "2025-02-10"),
    child("c", "F", "2025-03-10"),
    child("tua", "M", "2019-01-01"), // di luar 0–59 bulan
    child("lahirNanti", "M", "2027-01-01"),
  ]

  it("menghitung terdata, ditimbang, dan panjang/tinggi menurut jenis kelamin", () => {
    const measurements = [
      measurement("a", "2026-06-05"),
      measurement("b", "2026-06-07", { weightKg: null, rawLengthHeightCm: 80 }),
      measurement("c", "2026-05-20"), // bulan lain
    ]
    const coverage = buildCoverage(
      "2026-06",
      children,
      indexMeasurementsByChild(measurements)
    )
    expect(coverage.eligible).toEqual({ M: 1, F: 2, ALL: 3 })
    expect(coverage.weighed).toEqual({ M: 1, F: 0, ALL: 1 })
    expect(coverage.heightMeasured).toEqual({ M: 0, F: 1, ALL: 1 })
  })

  it("anak yang diukur beberapa kali dalam sebulan dihitung sekali", () => {
    const measurements = [
      measurement("a", "2026-06-01"),
      measurement("a", "2026-06-15"),
      measurement("a", "2026-06-30"),
    ]
    const coverage = buildCoverage(
      "2026-06",
      children,
      indexMeasurementsByChild(measurements)
    )
    expect(coverage.weighed.ALL).toBe(1)
  })

  it("pengukuran anak di luar cakupan umur tidak ikut dihitung", () => {
    const measurements = [measurement("tua", "2026-06-05")]
    const coverage = buildCoverage(
      "2026-06",
      children,
      indexMeasurementsByChild(measurements)
    )
    expect(coverage.weighed.ALL).toBe(0)
    expect(coverage.eligible.ALL).toBe(3)
  })

  it("batas awal dan akhir bulan masuk ke bulan itu, hari tetangga tidak", () => {
    const measurements = [
      measurement("a", "2026-05-31"),
      measurement("b", "2026-06-01"),
      measurement("c", "2026-06-30"),
      measurement("a", "2026-07-01"),
    ]
    const coverage = buildCoverage(
      "2026-06",
      children,
      indexMeasurementsByChild(measurements)
    )
    expect(coverage.weighed).toEqual({ M: 0, F: 2, ALL: 2 })
  })

  it("invarian: yang ditimbang tidak pernah melebihi yang terdata", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      child(`k${i}`, i % 2 ? "M" : "F", "2025-01-01")
    )
    const measurements = many.flatMap((c) => [
      measurement(c.id, "2026-06-03"),
      measurement(c.id, "2026-06-20"),
    ])
    const coverage = buildCoverage(
      "2026-06",
      many,
      indexMeasurementsByChild(measurements)
    )
    for (const group of ["M", "F", "ALL"] as const) {
      expect(coverage.weighed[group]).toBeLessThanOrEqual(
        coverage.eligible[group]
      )
    }
    expect(coverage.weighed.M + coverage.weighed.F).toBe(coverage.weighed.ALL)
  })

  it("tanpa data: nol, bukan error", () => {
    const coverage = buildCoverage("2026-06", [], new Map())
    expect(coverage.eligible).toEqual({ M: 0, F: 0, ALL: 0 })
  })
})

describe("buildMonthlyRecap", () => {
  const children = [
    child("a", "M", "2025-01-10"),
    child("b", "F", "2025-02-10"),
    child("c", "F", "2025-03-10"),
  ]

  it("status memakai pengukuran terakhir bulan itu yang berisi angka", () => {
    const early = measurement("a", "2026-06-02")
    const late = measurement("a", "2026-06-25")
    const empty = measurement("a", "2026-06-28", {
      weightKg: null,
      rawLengthHeightCm: null,
    })
    const results = new Map([
      [early.id, result({ wazCategory: "BB_KURANG", waz: -2.5 })],
      [late.id, result({ wazCategory: "BB_NORMAL", waz: 0 })],
      [empty.id, result({ wazCategory: "BB_SANGAT_KURANG", waz: -4 })],
    ])
    const recap = buildMonthlyRecap(
      "2026-06",
      children,
      [early, late, empty],
      results
    )
    expect(recap.status.waz.ALL.counts).toEqual({ BB_NORMAL: 1 })
    expect(recap.status.waz.M.assessed).toBe(1)
  })

  it("menghitung kategori per jenis kelamin, dan jumlah laki-laki + perempuan = total", () => {
    const ms = [
      measurement("a", "2026-06-05"),
      measurement("b", "2026-06-05"),
      measurement("c", "2026-06-05"),
    ]
    const results = new Map([
      [ms[0].id, result({ hazCategory: "PENDEK" })],
      [ms[1].id, result({ hazCategory: "PENDEK" })],
      [ms[2].id, result({ hazCategory: "TB_NORMAL" })],
    ])
    const { status } = buildMonthlyRecap("2026-06", children, ms, results)
    expect(status.haz.M.counts).toEqual({ PENDEK: 1 })
    expect(status.haz.F.counts).toEqual({ PENDEK: 1, TB_NORMAL: 1 })
    expect(status.haz.ALL.counts).toEqual({ PENDEK: 2, TB_NORMAL: 1 })
    expect(status.haz.ALL.assessed).toBe(
      status.haz.M.assessed + status.haz.F.assessed
    )
  })

  it("z-score yang tidak dapat dihitung dipisahkan dari yang dinilai, bukan dibuang", () => {
    const ms = [measurement("a", "2026-06-05"), measurement("b", "2026-06-05")]
    const results = new Map([
      [ms[0].id, result({ wazCategory: "BB_NORMAL" })],
      [ms[1].id, result({ wazCategory: null })],
    ])
    const { status } = buildMonthlyRecap("2026-06", children, ms, results)
    expect(status.waz.ALL).toMatchObject({ assessed: 1, notAssessed: 1 })
  })

  it("hasil perhitungan yang hilang diperlakukan sebagai tidak dapat dihitung", () => {
    const ms = [measurement("a", "2026-06-05")]
    const { status } = buildMonthlyRecap("2026-06", children, ms, new Map())
    expect(status.waz.ALL).toMatchObject({ assessed: 0, notAssessed: 1 })
  })

  it("'diukur' mencakup anak yang hanya diukur tingginya; 'ditimbang' tidak", () => {
    const ms = [
      measurement("a", "2026-06-05", { weightKg: null, rawLengthHeightCm: 80 }),
    ]
    const recap = buildMonthlyRecap("2026-06", children, ms, new Map())
    expect(recap.measured.ALL).toBe(1)
    expect(recap.weighed.ALL).toBe(0)
    expect(recap.heightMeasured.ALL).toBe(1)
  })

  it("anak tanpa pengukuran bulan itu tidak masuk status maupun vitamin A", () => {
    const recap = buildMonthlyRecap("2026-06", children, [], new Map())
    expect(recap.measured.ALL).toBe(0)
    expect(recap.status.waz.ALL).toMatchObject({ assessed: 0, notAssessed: 0 })
    expect(recap.vitaminA.ALL).toEqual({ yes: 0, no: 0, unknown: 0 })
  })

  it("vitamin A: ya mengalahkan tidak; kosong menjadi 'tidak diisi', bukan 'tidak'", () => {
    const ms = [
      measurement("a", "2026-06-02", { vitaminAStatus: false }),
      measurement("a", "2026-06-20", { vitaminAStatus: true }),
      measurement("b", "2026-06-05", { vitaminAStatus: false }),
      measurement("c", "2026-06-05", { vitaminAStatus: null }),
    ]
    const { vitaminA } = buildMonthlyRecap("2026-06", children, ms, new Map())
    expect(vitaminA.ALL).toEqual({ yes: 1, no: 1, unknown: 1 })
    expect(vitaminA.M).toEqual({ yes: 1, no: 0, unknown: 0 })
    expect(vitaminA.F).toEqual({ yes: 0, no: 1, unknown: 1 })
  })

  it("vitamin A tetap dihitung walau barisnya tidak berisi berat maupun tinggi", () => {
    const ms = [
      measurement("a", "2026-06-02", {
        weightKg: null,
        vitaminAStatus: true,
      }),
    ]
    const recap = buildMonthlyRecap("2026-06", children, ms, new Map())
    expect(recap.vitaminA.ALL.yes).toBe(1)
    expect(recap.measured.ALL).toBe(0)
  })

  it("mengabaikan pengukuran bulan lain", () => {
    const ms = [measurement("a", "2026-05-31"), measurement("a", "2026-07-01")]
    const recap = buildMonthlyRecap("2026-06", children, ms, new Map())
    expect(recap.measured.ALL).toBe(0)
  })
})

describe("buildOverview", () => {
  it("menghitung total, terdata, ditimbang bulan ini, dan yang belum pernah diukur", () => {
    const children = [
      child("a", "M", "2025-01-10"),
      child("b", "F", "2025-02-10"),
      child("tua", "M", "2019-01-01"),
    ]
    const ms = [
      measurement("a", "2026-06-05"),
      measurement("tua", "2024-01-01"), // pernah diukur, tetapi lama
    ]
    expect(buildOverview("2026-06", children, ms)).toEqual({
      totalChildren: 3,
      eligibleThisMonth: 2,
      weighedThisMonth: 1,
      neverMeasured: 1,
    })
  })
})

describe("buildCoverageSeries", () => {
  it("memberi satu titik per bulan sesuai urutan", () => {
    const children = [child("a", "M", "2025-01-10")]
    const ms = [measurement("a", "2026-05-05"), measurement("a", "2026-06-05")]
    const series = buildCoverageSeries(recentMonths("2026-06", 3), children, ms)
    expect(series.map((p) => p.month)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
    ])
    expect(series.map((p) => p.weighed.ALL)).toEqual([0, 1, 1])
  })
})

describe("ratio", () => {
  it("penyebut nol menghasilkan null, bukan 0 atau NaN", () => {
    expect(ratio(0, 0)).toBeNull()
    expect(ratio(5, 0)).toBeNull()
    expect(ratio(0, 5)).toBe(0)
    expect(ratio(1, 4)).toBe(0.25)
  })
})
