import { describe, expect, it } from "vitest"

import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import {
  buildChildSummaries,
  filterChildren,
  matchesAgeGroup,
  type ChildSummary,
} from "./child-summaries"

const child = (overrides: Partial<StoredChild>): StoredChild => ({
  id: "c1",
  sourceKey: null,
  name: "Anak",
  birthDate: "2025-01-10",
  sex: "M",
  birthOrder: null,
  birthWeightKg: null,
  birthLengthCm: null,
  birthHeadCircumferenceCm: null,
  importBatchId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
})

const measurement = (
  childId: string,
  measuredAt: string
): StoredMeasurement => ({
  id: `${childId}-${measuredAt}`,
  childId,
  measuredAt,
  weightKg: 10,
  rawLengthHeightCm: 80,
  measurementPosition: "STANDING",
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
})

const TODAY = "2026-11-12"

describe("buildChildSummaries", () => {
  it("menghitung umur, pengukuran terakhir, dan jumlah per anak", () => {
    const rows = buildChildSummaries(
      [child({ id: "a", name: "Aya", birthDate: "2025-01-10" })],
      [
        measurement("a", "2026-03-01"),
        measurement("a", "2026-09-01"),
        measurement("a", "2026-06-01"),
      ],
      TODAY
    )
    expect(rows).toEqual([
      expect.objectContaining({
        id: "a",
        ageMonths: 22,
        lastMeasuredAt: "2026-09-01",
        measurementCount: 3,
      }),
    ])
  })

  it("anak tanpa pengukuran punya nilai kosong, bukan nol palsu", () => {
    const [row] = buildChildSummaries([child({ id: "a" })], [], TODAY)
    expect(row.lastMeasuredAt).toBeNull()
    expect(row.measurementCount).toBe(0)
  })

  it("tidak mencampur pengukuran antar anak", () => {
    const rows = buildChildSummaries(
      [child({ id: "a", name: "A" }), child({ id: "b", name: "B" })],
      [measurement("a", "2026-05-01"), measurement("b", "2026-08-01")],
      TODAY
    )
    expect(rows.map((r) => [r.id, r.lastMeasuredAt])).toEqual([
      ["a", "2026-05-01"],
      ["b", "2026-08-01"],
    ])
  })

  it("hanya membawa 4 digit terakhir NIK, bukan NIK penuh", () => {
    const [row] = buildChildSummaries(
      [child({ sourceKey: "3200000000001234" })],
      [],
      TODAY
    )
    expect(row.nikLast4).toBe("1234")
    expect(JSON.stringify(row)).not.toContain("3200000000001234")
  })

  it("mengurutkan berdasarkan nama tanpa peka huruf besar/kecil", () => {
    const rows = buildChildSummaries(
      [
        child({ id: "1", name: "budi" }),
        child({ id: "2", name: "Ani" }),
        child({ id: "3", name: "Citra" }),
      ],
      [],
      TODAY
    )
    expect(rows.map((r) => r.name)).toEqual(["Ani", "budi", "Citra"])
  })
})

describe("matchesAgeGroup", () => {
  it.each([
    [0, "0-5", true],
    [5, "0-5", true],
    [6, "0-5", false],
    [6, "6-11", true],
    [11, "6-11", true],
    [12, "12-23", true],
    [23, "12-23", true],
    [24, "24-59", true],
    [59, "24-59", true],
    [60, "24-59", false],
    [60, "outside", true],
    [30, "outside", false],
    [null, "outside", true],
    [null, "0-5", false],
    [30, "all", true],
    [null, "all", true],
  ] as const)("umur %s bulan pada kelompok %s → %s", (age, group, expected) => {
    expect(matchesAgeGroup(age, group)).toBe(expected)
  })
})

describe("filterChildren", () => {
  const rows: ChildSummary[] = [
    {
      id: "1",
      name: "Siti Aminah",
      sex: "F",
      birthDate: "2025-01-10",
      ageMonths: 22,
      nikLast4: "0001",
      lastMeasuredAt: null,
      measurementCount: 0,
    },
    {
      id: "2",
      name: "Budi Santoso",
      sex: "M",
      birthDate: "2026-09-01",
      ageMonths: 2,
      nikLast4: "0002",
      lastMeasuredAt: null,
      measurementCount: 0,
    },
    {
      id: "3",
      name: "Citra Siti",
      sex: "F",
      birthDate: "2020-01-01",
      ageMonths: 82,
      nikLast4: null,
      lastMeasuredAt: null,
      measurementCount: 0,
    },
  ]
  const base = { query: "", sex: "all", ageGroup: "all" } as const
  const ids = (filter: Parameters<typeof filterChildren>[1]) =>
    filterChildren(rows, filter).map((r) => r.id)

  it("tanpa filter mengembalikan semua", () => {
    expect(ids(base)).toEqual(["1", "2", "3"])
  })

  it("mencari potongan nama tanpa peka huruf besar/kecil", () => {
    expect(ids({ ...base, query: "siti" })).toEqual(["1", "3"])
    expect(ids({ ...base, query: "  SANTO " })).toEqual(["2"])
  })

  it("mengabaikan tanda diakritik", () => {
    expect(ids({ ...base, query: "sítí" })).toEqual(["1", "3"])
  })

  it("mencari 4 digit terakhir NIK secara tepat", () => {
    expect(ids({ ...base, query: "0002" })).toEqual(["2"])
    expect(ids({ ...base, query: "0003" })).toEqual([])
    // Bukan 4 digit penuh: tidak dianggap NIK, dicari sebagai nama.
    expect(ids({ ...base, query: "000" })).toEqual([])
  })

  it("menyaring jenis kelamin dan kelompok umur, dan menggabungkannya", () => {
    expect(ids({ ...base, sex: "F" })).toEqual(["1", "3"])
    expect(ids({ ...base, ageGroup: "0-5" })).toEqual(["2"])
    expect(ids({ ...base, ageGroup: "outside" })).toEqual(["3"])
    expect(ids({ query: "siti", sex: "F", ageGroup: "12-23" })).toEqual(["1"])
  })

  it("hasil kosong jika tidak ada yang cocok", () => {
    expect(ids({ ...base, query: "zzz" })).toEqual([])
  })
})
