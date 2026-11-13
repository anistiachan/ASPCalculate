import { describe, expect, it } from "vitest"

import type { AnthropometryResult } from "@/domain/anthropometry/compute"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import { buildRecheckList } from "./recheck"

const child = (id: string, extra: Partial<StoredChild> = {}): StoredChild =>
  ({
    id,
    name: `Anak ${id}`,
    sex: "M",
    birthDate: "2025-01-01",
    posyandu: null,
    ...extra,
  }) as StoredChild

let counter = 0
const measurement = (
  childId: string,
  measuredAt: string,
  weightKg: number | null,
  heightCm: number | null
): StoredMeasurement =>
  ({
    id: `m${++counter}`,
    childId,
    measuredAt,
    weightKg,
    rawLengthHeightCm: heightCm,
  }) as StoredMeasurement

const z = (extra: Partial<AnthropometryResult> = {}) =>
  ({ haz: 0, waz: 0, whz: 0, ...extra }) as AnthropometryResult

const MONTH = "2026-06"

function reasonsFor(
  ms: StoredMeasurement[],
  results: Record<string, Partial<AnthropometryResult>> = {}
) {
  const map = new Map(
    Object.entries(results).map(([id, r]) => [id, z(r)] as const)
  )
  const list = buildRecheckList(MONTH, [child("A")], ms, map)
  return list.flatMap((e) => e.reasons.map((r) => r.code))
}

describe("buildRecheckList", () => {
  it("pengukuran wajar dan naik tidak ditandai", () => {
    const ms = [
      measurement("A", "2026-05-10", 9, 74),
      measurement("A", "2026-06-10", 9.4, 75),
    ]
    expect(reasonsFor(ms)).toEqual([])
  })

  it("tinggi turun lebih dari 1 cm ditandai, turun 1 cm atau kurang tidak", () => {
    const base = measurement("A", "2026-05-10", 9, 76)
    expect(
      reasonsFor([base, measurement("A", "2026-06-10", 9.2, 74.5)])
    ).toEqual(["TINGGI_TURUN"])
    expect(reasonsFor([base, measurement("A", "2026-06-10", 9.2, 75)])).toEqual(
      []
    )
  })

  it("berat turun lebih dari 1 kg ditandai", () => {
    const ms = [
      measurement("A", "2026-05-10", 10, 75),
      measurement("A", "2026-06-10", 8.8, 76),
    ]
    expect(reasonsFor(ms)).toEqual(["BERAT_TURUN"])
  })

  it("membandingkan dengan pengukuran sebelumnya yang memuat nilai terkait", () => {
    const ms = [
      measurement("A", "2026-04-10", 9, 76),
      measurement("A", "2026-05-10", 9.3, null),
      measurement("A", "2026-06-10", 9.5, 74),
    ]
    expect(reasonsFor(ms)).toEqual(["TINGGI_TURUN"])
  })

  it("nilai di luar rentang wajar ditandai", () => {
    expect(reasonsFor([measurement("A", "2026-06-10", 45, 80)])).toEqual([
      "DI_LUAR_RENTANG",
    ])
  })

  it("z-score tak masuk akal secara biologis ditandai", () => {
    const m = measurement("A", "2026-06-10", 9, 75)
    expect(reasonsFor([m], { [m.id]: { haz: -6.5 } })).toEqual([
      "Z_TAK_MASUK_AKAL",
    ])
    const n = measurement("A", "2026-06-10", 9, 75)
    expect(reasonsFor([n], { [n.id]: { haz: -5.9, whz: 5.1 } })).toEqual([
      "Z_TAK_MASUK_AKAL",
    ])
  })

  it("anak pendek masuk daftar hanya sebagai verifikasi, bukan sebagai data salah", () => {
    const m = measurement("A", "2026-06-10", 8.5, 70)
    expect(
      reasonsFor([m], { [m.id]: { haz: -3.4, hazCategory: "SANGAT_PENDEK" } })
    ).toEqual(["SANGAT_PENDEK"])
    const n = measurement("A", "2026-06-10", 8.5, 70)
    expect(
      reasonsFor([n], { [n.id]: { haz: -2.3, hazCategory: "PENDEK" } })
    ).toEqual(["PENDEK"])
  })

  it("anak tinggi normal dengan data konsisten tidak masuk daftar", () => {
    const m = measurement("A", "2026-06-10", 9, 75)
    expect(
      reasonsFor([m], { [m.id]: { haz: -0.5, hazCategory: "TB_NORMAL" } })
    ).toEqual([])
  })

  it("hanya pengukuran terakhir bulan itu yang dinilai dan memuat data bulan sebelumnya", () => {
    const ms = [
      measurement("A", "2026-05-10", 9, 76),
      measurement("A", "2026-06-02", 9, 70),
      measurement("A", "2026-06-20", 9.3, 77),
    ]
    expect(reasonsFor(ms)).toEqual([])
    const [entry] = buildRecheckList(
      MONTH,
      [child("A")],
      [
        measurement("A", "2026-05-10", 9, 76),
        measurement("A", "2026-06-10", 9, 70),
      ],
      new Map()
    )
    expect(entry.previousHeightCm).toBe(76)
    expect(entry.heightCm).toBe(70)
    expect(entry.measurementId).toBeTruthy()
  })

  it("diurutkan menurut Posyandu lalu nama", () => {
    const children = [
      child("B", { name: "Budi", posyandu: "PEPAYA" }),
      child("A", { name: "Ani", posyandu: "JERUK" }),
    ]
    const ms = [
      measurement("B", "2026-06-10", 60, 80),
      measurement("A", "2026-06-10", 60, 80),
    ]
    const list = buildRecheckList(MONTH, children, ms, new Map())
    expect(list.map((e) => e.name)).toEqual(["Ani", "Budi"])
  })
})
