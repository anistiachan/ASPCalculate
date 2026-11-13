import { describe, expect, it } from "vitest"

import { yearOptions } from "./year-options"

const at = (measuredAt: string) => ({ measuredAt })

describe("yearOptions", () => {
  it("tanpa pengukuran hanya menawarkan tahun ini", () => {
    expect(yearOptions([], "2026-11-12")).toEqual([2026])
  })

  it("dari tahun pengukuran tertua sampai tahun ini, urut turun", () => {
    expect(
      yearOptions(
        [at("2024-03-01"), at("2026-01-05"), at("2025-07-07")],
        "2026-11-12"
      )
    ).toEqual([2026, 2025, 2024])
  })

  it("pengukuran hanya di tahun ini", () => {
    expect(yearOptions([at("2026-02-02")], "2026-11-12")).toEqual([2026])
  })

  it("tidak menawarkan tahun yang belum tiba walau ada tanggal ukur di masa depan", () => {
    expect(yearOptions([at("2027-01-01")], "2026-11-12")).toEqual([2026])
  })
})
