import { describe, expect, it } from "vitest"

import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import {
  ALL_POSYANDU,
  filterByPosyandu,
  posyanduOptions,
} from "./posyandu-filter"

const child = (id: string, posyandu: string | null): StoredChild =>
  ({ id, posyandu, name: id }) as StoredChild
const measurement = (childId: string): StoredMeasurement =>
  ({ id: `m-${childId}`, childId }) as StoredMeasurement

const data = {
  children: [child("1", "PEPAYA"), child("2", "JERUK"), child("3", null)],
  measurements: [measurement("1"), measurement("2"), measurement("3")],
}

describe("posyanduOptions", () => {
  it("unik, urut abjad, tanpa anak yang tidak punya Posyandu", () => {
    expect(posyanduOptions(data.children)).toEqual(["JERUK", "PEPAYA"])
  })
  it("kosong bila tidak ada data Posyandu", () => {
    expect(posyanduOptions([child("1", null)])).toEqual([])
  })
})

describe("filterByPosyandu", () => {
  it("semua Posyandu: data apa adanya, termasuk anak tanpa Posyandu", () => {
    expect(filterByPosyandu(data, ALL_POSYANDU)).toBe(data)
  })
  it("satu Posyandu: hanya anak dan pengukurannya", () => {
    const result = filterByPosyandu(data, "JERUK")
    expect(result.children.map((c) => c.id)).toEqual(["2"])
    expect(result.measurements.map((m) => m.childId)).toEqual(["2"])
  })
  it("Posyandu tanpa anak menghasilkan data kosong", () => {
    expect(filterByPosyandu(data, "TIDAK ADA").children).toEqual([])
  })
})
