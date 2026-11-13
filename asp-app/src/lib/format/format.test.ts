import { describe, expect, it } from "vitest"

import {
  formatAgeMonths,
  formatDate,
  formatMonth,
  formatMonthShort,
  formatNumber,
  formatPercent,
  formatShortDate,
} from "./format"

describe("formatMonth", () => {
  it("nama bulan lengkap dan singkat dalam bahasa Indonesia", () => {
    expect(formatMonth("2026-06")).toBe("Juni 2026")
    expect(formatMonth("2026-12")).toBe("Desember 2026")
    expect(formatMonthShort("2026-01")).toBe("Jan")
    expect(formatMonthShort("2026-08")).toMatch(/^Agu/)
  })
})

describe("formatPercent", () => {
  it("memakai koma desimal dan maksimal satu desimal", () => {
    expect(formatPercent(8, 9)).toBe("88,9%")
    expect(formatPercent(1, 2)).toBe("50%")
    expect(formatPercent(9, 9)).toBe("100%")
    expect(formatPercent(0, 5)).toBe("0%")
  })

  it("penyebut nol menghasilkan strip, bukan 0% atau NaN", () => {
    expect(formatPercent(0, 0)).toBe("–")
    expect(formatPercent(3, 0)).toBe("–")
  })
})

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
