import { beforeAll, describe, expect, it } from "vitest"

import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import type { ReferenceSet } from "@/domain/anthropometry/references/reference"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import { computeNutritionResults, toPittingEdema } from "./nutrition-results"

let refs: ReferenceSet
beforeAll(async () => {
  refs = await loadWho2006References()
})

const child = (overrides: Partial<StoredChild> = {}): StoredChild => ({
  id: "c1",
  sourceKey: null,
  name: "Anak Uji",
  birthDate: "2022-01-01",
  sex: "F",
  birthOrder: null,
  birthWeightKg: null,
  birthLengthCm: null,
  birthHeadCircumferenceCm: null,
  importBatchId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
})

const measurement = (
  overrides: Partial<StoredMeasurement> = {}
): StoredMeasurement => ({
  id: "m1",
  childId: "c1",
  measuredAt: "2026-03-03",
  weightKg: 17,
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

describe("toPittingEdema", () => {
  it("kosong dianggap tidak ada edema; terisi tidak ditafsirkan", () => {
    expect(toPittingEdema(null)).toBe("NONE")
    expect(toPittingEdema("")).toBe("NONE")
    expect(toPittingEdema("   ")).toBe("NONE")
    expect(toPittingEdema("0")).toBe("UNMAPPED")
    expect(toPittingEdema("ya")).toBe("UNMAPPED")
  })
})

describe("computeNutritionResults", () => {
  it("menghitung dari data tersimpan: perempuan 1522 hari, 17 kg → BB/U 0,24 (vektor WHO Anthro)", () => {
    // 2022-01-01 + 1522 hari = 2026-03-03.
    const [row] = computeNutritionResults(child(), [measurement()], refs)
    expect(row.result.ageInDays).toBe(1522)
    expect(row.result.waz).toBe(0.24)
    expect(row.result.wazCategory).toBe("BB_NORMAL")
  })

  it("mempertahankan urutan masukan dan menautkan tiap hasil ke pengukurannya", () => {
    const rows = computeNutritionResults(
      child(),
      [
        measurement({ id: "b", measuredAt: "2026-03-03" }),
        measurement({ id: "a", measuredAt: "2025-06-01", weightKg: 12 }),
      ],
      refs
    )
    expect(rows.map((r) => r.measurement.id)).toEqual(["b", "a"])
    expect(rows[0].result.ageInDays).toBe(1522)
    // 2022-01-01 → 2025-06-01 = 1096 hari sampai 2025-01-01 + 151 hari.
    expect(rows[1].result.ageInDays).toBe(1247)
  })

  it("isian edema yang belum dipetakan memberi flag tanpa menolak perhitungan", () => {
    const [row] = computeNutritionResults(
      child(),
      [measurement({ rawPittingEdema: "0" })],
      refs
    )
    expect(row.result.waz).not.toBeNull()
    expect(row.result.flags).toContain("PITTING_EDEMA_UNMAPPED")
  })

  it("memakai nilai mentah dan posisi tersimpan untuk koreksi", () => {
    const [row] = computeNutritionResults(
      child({ birthDate: "2025-03-15" }),
      [
        measurement({
          measuredAt: "2026-06-10",
          weightKg: 12.4,
          rawLengthHeightCm: 88.5,
          measurementPosition: "RECUMBENT",
        }),
      ],
      refs
    )
    // 452 hari (< 731): telentang sudah sesuai, tidak dikoreksi.
    expect(row.result.correctionCm).toBe(0)
    expect(row.result.correctedLengthHeightCm).toBe(88.5)
    expect(row.result.whzTable).toBe("WFL")
  })

  it("daftar kosong menghasilkan daftar kosong", () => {
    expect(computeNutritionResults(child(), [], refs)).toEqual([])
  })
})
