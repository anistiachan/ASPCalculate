import { beforeAll, describe, expect, it } from "vitest"

import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import type { ReferenceSet } from "@/domain/anthropometry/references/reference"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import { computeRecapForMonth } from "./recap-for-month"

let refs: ReferenceSet
beforeAll(async () => {
  refs = await loadWho2006References()
})

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
  weightKg: null,
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

describe("computeRecapForMonth", () => {
  it("menghitung status gizi dari mesin antropometri: perempuan 1522 hari, 17 kg → BB/U normal", () => {
    // Vektor uji WHO Anthro: 2022-01-01 + 1522 hari = 2026-03-03, BB/U +0,24.
    const children = [child("a", "F", "2022-01-01")]
    const ms = [measurement("a", "2026-03-03", { weightKg: 17 })]
    const recap = computeRecapForMonth("2026-03", children, ms, refs)

    expect(recap.eligible).toEqual({ M: 0, F: 1, ALL: 1 })
    expect(recap.weighed.F).toBe(1)
    expect(recap.status.waz.F.counts).toEqual({ BB_NORMAL: 1 })
    expect(recap.status.waz.ALL.assessed).toBe(1)
    // Tanpa tinggi: indikator lain tidak dapat dihitung, bukan dianggap nol.
    expect(recap.status.haz.ALL).toMatchObject({ assessed: 0, notAssessed: 1 })
    expect(recap.status.whz.ALL).toMatchObject({ assessed: 0, notAssessed: 1 })
  })

  it("bulan tanpa pengukuran menghasilkan rekap kosong, bukan error", () => {
    const children = [child("a", "F", "2022-01-01")]
    const ms = [measurement("a", "2026-03-03", { weightKg: 17 })]
    const recap = computeRecapForMonth("2026-04", children, ms, refs)

    expect(recap.eligible.ALL).toBe(1)
    expect(recap.weighed.ALL).toBe(0)
    expect(recap.measured.ALL).toBe(0)
    expect(recap.status.waz.ALL).toMatchObject({ assessed: 0, notAssessed: 0 })
  })

  it("hanya menghitung pengukuran pada bulan yang diminta", () => {
    const children = [child("a", "M", "2025-01-01")]
    const ms = [
      measurement("a", "2026-05-20", { weightKg: 12 }),
      measurement("a", "2026-06-10", { weightKg: 12.5 }),
    ]
    const recap = computeRecapForMonth("2026-06", children, ms, refs)
    expect(recap.weighed.ALL).toBe(1)
    expect(recap.status.waz.ALL.assessed).toBe(1)
  })

  it("pengukuran dari anak yang tidak dikenal diabaikan tanpa error", () => {
    const ms = [measurement("hantu", "2026-06-10", { weightKg: 12 })]
    const recap = computeRecapForMonth("2026-06", [], ms, refs)
    expect(recap.measured.ALL).toBe(0)
  })

  it("anak di atas 60 bulan saat diukur: dicatat tetapi status tidak dapat dihitung", () => {
    // Berulang tahun ke-5 pada 2026-06-20; diukur 2026-06-25 (60,2 bulan).
    const children = [child("a", "F", "2021-06-20")]
    const ms = [measurement("a", "2026-06-25", { weightKg: 18 })]
    const recap = computeRecapForMonth("2026-06", children, ms, refs)

    expect(recap.eligible.ALL).toBe(1)
    expect(recap.weighed.ALL).toBe(1)
    expect(recap.status.waz.ALL).toMatchObject({ assessed: 0, notAssessed: 1 })
  })
})
