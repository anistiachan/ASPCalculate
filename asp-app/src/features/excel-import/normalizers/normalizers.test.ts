import { describe, expect, it } from "vitest"

import { parseDate } from "@/lib/date/parse-date"
import { parseDecimal } from "@/lib/number/parse-decimal"
import type { ParseResult } from "@/lib/result/parse-result"

import { normalizeHeader } from "./normalize-header"
import { parseMeasurementPosition } from "./parse-measurement-position"
import { parseNik } from "./parse-nik"
import { parseSex } from "./parse-sex"
import { parseYesNo } from "./parse-yes-no"

/** Nilai hasil parsing, atau "GAGAL" agar perbandingan tetap terbaca di laporan tes. */
const valueOf = <T>(result: ParseResult<T>) =>
  result.ok ? result.value : "GAGAL"

describe("parseDecimal", () => {
  it("menerima titik dan koma desimal", () => {
    expect(valueOf(parseDecimal("15.8"))).toBe(15.8)
    expect(valueOf(parseDecimal("15,8"))).toBe(15.8)
    expect(valueOf(parseDecimal(15.8))).toBe(15.8)
    expect(valueOf(parseDecimal(" 7 "))).toBe(7)
  })

  it("mempertahankan kosong sebagai null, bukan nol", () => {
    expect(valueOf(parseDecimal(""))).toBeNull()
    expect(valueOf(parseDecimal("   "))).toBeNull()
    expect(valueOf(parseDecimal(null))).toBeNull()
    expect(valueOf(parseDecimal(undefined))).toBeNull()
    expect(valueOf(parseDecimal("-"))).toBeNull()
  })

  it("menolak format ambigu atau bukan angka", () => {
    expect(parseDecimal("1,234.5").ok).toBe(false)
    expect(parseDecimal("1.234,5").ok).toBe(false)
    expect(parseDecimal("abc").ok).toBe(false)
    expect(parseDecimal("12 kg").ok).toBe(false)
    expect(parseDecimal(Number.NaN).ok).toBe(false)
    expect(parseDecimal(Number.POSITIVE_INFINITY).ok).toBe(false)
  })
})

describe("parseDate", () => {
  it("membaca format teks dengan hari lebih dulu", () => {
    expect(valueOf(parseDate("2025-09-03"))).toBe("2025-09-03")
    expect(valueOf(parseDate("03/09/2025"))).toBe("2025-09-03")
    expect(valueOf(parseDate("3-9-2025"))).toBe("2025-09-03")
    expect(valueOf(parseDate("2025-09-03 00:00:00"))).toBe("2025-09-03")
  })

  it("membaca serial tanggal Excel", () => {
    // 45903 = 3 September 2025 pada sistem tanggal 1900.
    expect(valueOf(parseDate(45903))).toBe("2025-09-03")
    expect(valueOf(parseDate(45903.75))).toBe("2025-09-03")
  })

  it("menolak tanggal yang tidak ada di kalender", () => {
    expect(parseDate("31/02/2025").ok).toBe(false)
    expect(parseDate("2025-13-01").ok).toBe(false)
    expect(parseDate("29/02/2025").ok).toBe(false)
    expect(valueOf(parseDate("29/02/2024"))).toBe("2024-02-29")
  })

  it("menolak format tidak dikenal dan tahun tidak wajar", () => {
    expect(parseDate("September 2025").ok).toBe(false)
    expect(parseDate("01/01/1800").ok).toBe(false)
    expect(parseDate(0).ok).toBe(false)
  })

  it("mempertahankan kosong sebagai null", () => {
    expect(valueOf(parseDate(""))).toBeNull()
    expect(valueOf(parseDate(null))).toBeNull()
  })
})

describe("parseNik", () => {
  it("menerima 16 digit sebagai teks", () => {
    expect(valueOf(parseNik("3201000000000001"))).toBe("3201000000000001")
    expect(valueOf(parseNik(" 3201 0000 0000 0001 "))).toBe("3201000000000001")
    expect(valueOf(parseNik("'3201000000000001"))).toBe("3201000000000001")
  })

  it("menolak panjang salah dan angka yang kehilangan presisi", () => {
    expect(parseNik("12345").ok).toBe(false)
    expect(parseNik("32010000000000AB").ok).toBe(false)
    expect(parseNik(3.201e17).ok).toBe(false)
  })

  it("menganggap kosong sebagai tidak tersedia", () => {
    expect(valueOf(parseNik(""))).toBeNull()
    expect(valueOf(parseNik(null))).toBeNull()
  })

  it("tidak memuat nilai NIK pada pesan kegagalan", () => {
    const result = parseNik("3201000000000AB1")
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).not.toContain("3201")
  })
})

describe("parseYesNo", () => {
  it("tidak peka huruf besar/kecil", () => {
    expect(valueOf(parseYesNo("YA"))).toBe(true)
    expect(valueOf(parseYesNo("ya"))).toBe(true)
    expect(valueOf(parseYesNo("Tidak"))).toBe(false)
  })

  it("kosong menjadi null, bukan false", () => {
    expect(valueOf(parseYesNo(""))).toBeNull()
    expect(valueOf(parseYesNo(null))).toBeNull()
  })

  it("menolak nilai lain", () => {
    expect(parseYesNo("mungkin").ok).toBe(false)
    expect(parseYesNo(1).ok).toBe(false)
  })
})

describe("parseMeasurementPosition", () => {
  it("memetakan Berdiri dan Terlentang dan menyimpan teks asli", () => {
    expect(parseMeasurementPosition("BERDIRI")).toEqual({
      position: "STANDING",
      raw: "BERDIRI",
      recognized: true,
    })
    expect(parseMeasurementPosition("terlentang").position).toBe("RECUMBENT")
    expect(parseMeasurementPosition("Telentang").position).toBe("RECUMBENT")
  })

  it("kosong menjadi UNKNOWN tanpa dianggap salah", () => {
    expect(parseMeasurementPosition("")).toEqual({
      position: "UNKNOWN",
      raw: null,
      recognized: true,
    })
  })

  it("nilai tidak dikenal menjadi UNKNOWN dan ditandai", () => {
    expect(parseMeasurementPosition("duduk")).toEqual({
      position: "UNKNOWN",
      raw: "duduk",
      recognized: false,
    })
  })
})

describe("parseSex", () => {
  it("menerima L/P dan kata lengkapnya", () => {
    expect(valueOf(parseSex("L"))).toBe("M")
    expect(valueOf(parseSex("laki-laki"))).toBe("M")
    expect(valueOf(parseSex("Laki Laki"))).toBe("M")
    expect(valueOf(parseSex("P"))).toBe("F")
    expect(valueOf(parseSex("Perempuan"))).toBe("F")
  })

  it("menolak kode numerik yang belum terkonfirmasi", () => {
    expect(parseSex("1").ok).toBe(false)
    expect(parseSex(2).ok).toBe(false)
  })

  it("menolak kosong dan nilai tidak dikenal", () => {
    expect(parseSex("").ok).toBe(false)
    expect(parseSex("X").ok).toBe(false)
  })
})

describe("normalizeHeader", () => {
  it("menyeragamkan huruf, spasi, dan tanda baca", () => {
    expect(normalizeHeader("TANGGAL LAHIR")).toBe("tanggallahir")
    expect(normalizeHeader("tanggal_lahir")).toBe("tanggallahir")
    expect(normalizeHeader("Pitting_edema")).toBe("pittingedema")
    expect(normalizeHeader("asi_bulan_0")).toBe("asibulan0")
    expect(normalizeHeader(null)).toBe("")
  })
})
