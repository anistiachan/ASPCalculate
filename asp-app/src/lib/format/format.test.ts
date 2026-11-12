import { describe, expect, it } from "vitest"

import {
  formatAgeMonths,
  formatDate,
  formatNumber,
  formatShortDate,
} from "./format"

describe("format tanggal", () => {
  it("memformat tanggal ISO dalam bahasa Indonesia", () => {
    expect(formatDate("2025-03-15")).toBe("15 Maret 2025")
    expect(formatDate("2026-11-02")).toBe("2 November 2026")
  })

  it("tidak bergeser pada awal dan akhir tahun (bebas zona waktu)", () => {
    expect(formatDate("2026-01-01")).toBe("1 Januari 2026")
    expect(formatDate("2025-12-31")).toBe("31 Desember 2025")
  })

  it("format pendek", () => {
    expect(formatShortDate("2025-03-05")).toMatch(/^05 Mar(et)? 2025$/)
  })
})

describe("formatNumber", () => {
  it("memakai koma desimal dan membuang nol di belakang", () => {
    expect(formatNumber(11.2)).toBe("11,2")
    expect(formatNumber(82)).toBe("82")
    expect(formatNumber(6.125)).toBe("6,13")
  })

  it("null menjadi strip, bukan nol", () => {
    expect(formatNumber(null)).toBe("–")
  })
})

describe("formatAgeMonths", () => {
  it("bulan untuk di bawah 24 bulan", () => {
    expect(formatAgeMonths(0)).toBe("0 bln")
    expect(formatAgeMonths(23)).toBe("23 bln")
  })

  it("tahun dan bulan untuk 24 bulan ke atas", () => {
    expect(formatAgeMonths(24)).toBe("2 th")
    expect(formatAgeMonths(30)).toBe("2 th 6 bln")
    expect(formatAgeMonths(59)).toBe("4 th 11 bln")
  })

  it("null menjadi strip", () => {
    expect(formatAgeMonths(null)).toBe("–")
  })
})
