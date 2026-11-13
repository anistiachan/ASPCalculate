import { describe, expect, it } from "vitest"

import { niceScale } from "./chart-scale"

describe("niceScale", () => {
  it.each([
    // [nilai tertinggi, langkah, interval, yMax]
    [0, 1, 2, 2],
    [1, 1, 2, 2],
    [3, 1, 3, 3],
    [5, 1, 5, 5],
    [6, 2, 3, 6],
    [9, 2, 5, 10],
    [10, 2, 5, 10],
    [11, 5, 3, 15],
    [25, 5, 5, 25],
    [26, 10, 3, 30],
    [100, 20, 5, 100],
    [101, 50, 3, 150],
    [1234, 500, 3, 1500],
  ])(
    "nilai tertinggi %i → langkah %i, %i interval, yMax %i",
    (max, step, intervals, yMax) => {
      expect(niceScale(max)).toEqual({ step, intervals, yMax })
    }
  )

  it("selalu menampung nilai tertinggi dan hanya memakai bilangan bulat", () => {
    for (let max = 0; max <= 2000; max++) {
      const scale = niceScale(max)
      expect(scale.yMax).toBeGreaterThanOrEqual(max)
      expect(Number.isInteger(scale.step)).toBe(true)
      expect(scale.intervals).toBeGreaterThanOrEqual(2)
      expect(scale.intervals).toBeLessThanOrEqual(5)
      expect(scale.yMax).toBe(scale.step * scale.intervals)
    }
  })

  it("tidak menyisakan ruang kosong berlebihan di atas batang tertinggi", () => {
    for (let max = 5; max <= 2000; max++) {
      const { yMax } = niceScale(max)
      expect(yMax).toBeLessThan(max * 1.8)
    }
  })

  it("nilai negatif atau pecahan diperlakukan sebagai bilangan bulat tak negatif", () => {
    expect(niceScale(-5)).toEqual(niceScale(0))
    expect(niceScale(2.2)).toEqual(niceScale(3))
  })
})
