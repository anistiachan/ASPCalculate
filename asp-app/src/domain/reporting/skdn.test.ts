import { describe, expect, it } from "vitest"

import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import { indexMeasurementsByChild } from "./monthly-recap"
import {
  buildSkdn,
  calendarAgeMonths,
  classifyChild,
  SKDN_CODES,
  type SkdnCode,
} from "./skdn"
import { minimumWeightGainKg } from "./skdn-thresholds"

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
const weigh = (
  childId: string,
  measuredAt: string,
  weightKg: number | null
): StoredMeasurement => ({
  id: `m${++counter}`,
  childId,
  measuredAt,
  weightKg,
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
})

/** Kode yang bernilai benar, urut seperti SKDN_CODES. */
const active = (flags: Record<SkdnCode, boolean>) =>
  SKDN_CODES.filter((code) => flags[code])

describe("tabel kenaikan berat badan minimal", () => {
  it("sesuai tabel workbook untuk umur muda dan berbeda menurut jenis kelamin", () => {
    expect(minimumWeightGainKg(1, "M")).toBe(0.8)
    expect(minimumWeightGainKg(2, "F")).toBe(0.9)
    expect(minimumWeightGainKg(7, "M")).toBe(0.4)
    expect(minimumWeightGainKg(7, "F")).toBe(0.3)
    expect(minimumWeightGainKg(11, "M")).toBe(0.3)
    expect(minimumWeightGainKg(11, "F")).toBe(0.2)
  })

  it("mulai 12 bulan tetap 0,2 kg sampai 60 bulan", () => {
    for (const age of [12, 24, 36, 60]) {
      expect(minimumWeightGainKg(age, "M")).toBe(0.2)
      expect(minimumWeightGainKg(age, "F")).toBe(0.2)
    }
  })
})

describe("calendarAgeMonths", () => {
  it("selisih bulan kalender, bukan bulan penuh", () => {
    expect(calendarAgeMonths("2025-01-31", "2026-01")).toBe(12)
    expect(calendarAgeMonths("2025-01-01", "2026-01")).toBe(12)
    expect(calendarAgeMonths("2025-12-31", "2026-01")).toBe(1)
    expect(calendarAgeMonths("2026-02-10", "2026-01")).toBe(-1)
  })
})

describe("classifyChild", () => {
  const baby = child("a", "M", "2026-01-15")

  it("anak yang belum pernah ditimbang tidak masuk apa pun", () => {
    expect(active(classifyChild(baby, [], "2026-06"))).toEqual([])
  })

  it("bulan pertama ditimbang: K, D, D2, dan B (bukan N, T, O)", () => {
    const ms = [weigh("a", "2026-03-05", 4)]
    expect(active(classifyChild(baby, ms, "2026-03"))).toEqual([
      "K",
      "D2",
      "D",
      "B",
    ])
  })

  it("K berlanjut di bulan tanpa penimbangan, tetapi D tidak", () => {
    const ms = [weigh("a", "2026-03-05", 4)]
    expect(active(classifyChild(baby, ms, "2026-04"))).toEqual(["K"])
  })

  it("sebelum bulan pertama ditimbang anak belum masuk K", () => {
    const ms = [weigh("a", "2026-03-05", 4)]
    expect(active(classifyChild(baby, ms, "2026-02"))).toEqual([])
  })

  it("naik: kenaikan sama dengan ambang dihitung N", () => {
    // Umur 3 bulan (kalender) pada April: ambang 0,8 kg.
    const ms = [weigh("a", "2026-03-05", 4), weigh("a", "2026-04-05", 4.8)]
    expect(active(classifyChild(baby, ms, "2026-04"))).toEqual([
      "K",
      "D2",
      "D",
      "N",
    ])
  })

  it("tidak naik: kenaikan di bawah ambang dihitung T", () => {
    const ms = [weigh("a", "2026-03-05", 4), weigh("a", "2026-04-05", 4.7)]
    expect(active(classifyChild(baby, ms, "2026-04"))).toEqual([
      "K",
      "D2",
      "D",
      "T",
    ])
  })

  it("selisih dibulatkan 1 desimal sebelum dibandingkan (4,79 → 0,8 = naik)", () => {
    const ms = [weigh("a", "2026-03-05", 4), weigh("a", "2026-04-05", 4.79)]
    expect(classifyChild(baby, ms, "2026-04").N).toBe(true)
  })

  it("berat badan turun dihitung T", () => {
    const ms = [weigh("a", "2026-03-05", 4), weigh("a", "2026-04-05", 3.9)]
    expect(classifyChild(baby, ms, "2026-04").T).toBe(true)
  })

  it("O: ditimbang lagi setelah bulan kosong, bukan N maupun T", () => {
    const ms = [weigh("a", "2026-03-05", 4), weigh("a", "2026-05-05", 5)]
    expect(active(classifyChild(baby, ms, "2026-05"))).toEqual([
      "K",
      "D2",
      "D",
      "O",
    ])
  })

  it("2T: tidak naik dua bulan berturut-turut", () => {
    const ms = [
      weigh("a", "2026-03-05", 4),
      weigh("a", "2026-04-05", 4.1), // T
      weigh("a", "2026-05-05", 4.2), // T
    ]
    expect(classifyChild(baby, ms, "2026-05").T2).toBe(true)
    expect(classifyChild(baby, ms, "2026-04").T2).toBe(false)
  })

  it("2T tidak terjadi bila bulan sebelumnya naik atau tidak ditimbang", () => {
    const naik = [
      weigh("a", "2026-03-05", 4),
      weigh("a", "2026-04-05", 5), // N
      weigh("a", "2026-05-05", 5.1), // T
    ]
    expect(classifyChild(baby, naik, "2026-05").T).toBe(true)
    expect(classifyChild(baby, naik, "2026-05").T2).toBe(false)

    const bolong = [
      weigh("a", "2026-03-05", 4),
      weigh("a", "2026-05-05", 4.1),
      weigh("a", "2026-06-05", 4.2), // T; bulan lalu O, bukan T
    ]
    expect(classifyChild(baby, bolong, "2026-06").T2).toBe(false)
  })

  it("dua penimbangan sebulan: yang terakhir dipakai", () => {
    const ms = [
      weigh("a", "2026-03-05", 4),
      weigh("a", "2026-04-02", 4.0),
      weigh("a", "2026-04-20", 4.9),
    ]
    expect(classifyChild(baby, ms, "2026-04").N).toBe(true)
  })

  it("pengukuran tanpa berat badan tidak dihitung ditimbang", () => {
    const ms = [weigh("a", "2026-03-05", null)]
    expect(active(classifyChild(baby, ms, "2026-03"))).toEqual([])
  })

  it("batas umur baduta: 23 bulan D2, 24 bulan D25", () => {
    const at23 = child("b", "F", "2024-07-10") // Juni 2026 = 23 bulan kalender
    const at24 = child("c", "F", "2024-06-10") // Juni 2026 = 24 bulan kalender
    const m23 = [weigh("b", "2026-06-05", 11)]
    const m24 = [weigh("c", "2026-06-05", 11)]
    expect(classifyChild(at23, m23, "2026-06")).toMatchObject({
      D2: true,
      D25: false,
    })
    expect(classifyChild(at24, m24, "2026-06")).toMatchObject({
      D2: false,
      D25: true,
    })
  })

  it("anak 61 bulan atau lebih keluar dari K dan tidak bisa N, tetapi tetap dihitung D (seperti workbook)", () => {
    const old = child("o", "M", "2021-05-10") // Juni 2026 = 61 bulan
    const ms = [weigh("o", "2026-05-05", 18), weigh("o", "2026-06-05", 18.5)]
    const flags = classifyChild(old, ms, "2026-06")
    expect(flags.K).toBe(false)
    expect(flags.D).toBe(true)
    expect(flags.D25).toBe(true)
    // Kenaikan 0,5 kg tetap tidak dihitung N pada umur >= 61 bulan: dihitung T.
    expect(flags.N).toBe(false)
    expect(flags.T).toBe(true)
    // 60 bulan masih masuk K (rumus workbook memakai < 61).
    const sixty = child("s", "M", "2021-06-10")
    expect(
      classifyChild(sixty, [weigh("s", "2026-06-05", 18)], "2026-06").K
    ).toBe(true)
  })

  it("anak yang belum lahir pada bulan itu tidak masuk K maupun B", () => {
    const future = child("f", "F", "2026-07-01")
    const flags = classifyChild(
      future,
      [weigh("f", "2026-06-05", 3)],
      "2026-06"
    )
    expect(flags.K).toBe(false)
    expect(flags.B).toBe(false)
  })

  it("mode workbookParity: K memakai penimbangan kapan pun, B nol, O termasuk penimbangan pertama", () => {
    const baby = child("a", "M", "2026-01-15")
    const ms = [weigh("a", "2026-03-05", 4)]
    const parity = { workbookParity: true }
    // Sebelum ditimbang pertama kali pun K sudah terhitung.
    expect(classifyChild(baby, ms, "2026-02", parity).K).toBe(true)
    const march = classifyChild(baby, ms, "2026-03", parity)
    expect(march.B).toBe(false)
    expect(march.O).toBe(true)
  })

  it("lintas tahun: Desember ke Januari dianggap bulan berturut-turut", () => {
    const ms = [weigh("a", "2025-12-05", 6), weigh("a", "2026-01-05", 6.3)]
    const older = child("a", "M", "2025-01-10") // umur 12 bulan pada Januari 2026
    expect(classifyChild(older, ms, "2026-01").N).toBe(true) // 0,3 >= 0,2
  })
})

describe("buildSkdn", () => {
  it("menjumlahkan menurut jenis kelamin dan total", () => {
    const children = [
      child("1", "M", "2026-01-10"),
      child("2", "F", "2026-01-10"),
      child("3", "F", "2026-01-10"),
    ]
    const ms = [
      weigh("1", "2026-03-05", 4),
      weigh("2", "2026-03-05", 4),
      // Anak 3 belum pernah ditimbang.
    ]
    const { counts } = buildSkdn(
      "2026-03",
      children,
      indexMeasurementsByChild(ms)
    )
    expect(counts.K).toEqual({ M: 1, F: 1, ALL: 2 })
    expect(counts.D).toEqual({ M: 1, F: 1, ALL: 2 })
    expect(counts.B).toEqual({ M: 1, F: 1, ALL: 2 })
    expect(counts.N).toEqual({ M: 0, F: 0, ALL: 0 })
  })

  it("D selalu sama dengan D2 + D25 dan tidak melebihi K", () => {
    const children = [
      child("1", "M", "2026-01-10"),
      child("2", "F", "2023-01-10"),
    ]
    const ms = [weigh("1", "2026-03-05", 4), weigh("2", "2026-03-05", 13)]
    const { counts } = buildSkdn(
      "2026-03",
      children,
      indexMeasurementsByChild(ms)
    )
    expect(counts.D.ALL).toBe(counts.D2.ALL + counts.D25.ALL)
    expect(counts.D.ALL).toBeLessThanOrEqual(counts.K.ALL)
    expect(counts.D2.ALL).toBe(1)
    expect(counts.D25.ALL).toBe(1)
  })

  it("N + T + O + B = D (setiap anak yang ditimbang masuk satu golongan)", () => {
    const children = [
      child("1", "M", "2026-01-10"), // naik
      child("2", "F", "2026-01-10"), // tidak naik
      child("3", "M", "2026-01-10"), // O
      child("4", "F", "2026-01-10"), // B
    ]
    const ms = [
      weigh("1", "2026-03-05", 4),
      weigh("1", "2026-04-05", 5),
      weigh("2", "2026-03-05", 4),
      weigh("2", "2026-04-05", 4.1),
      weigh("3", "2026-02-05", 3),
      weigh("3", "2026-04-05", 5),
      weigh("4", "2026-04-05", 4),
    ]
    const { counts } = buildSkdn(
      "2026-04",
      children,
      indexMeasurementsByChild(ms)
    )
    const { N, T, O, B, D } = counts
    expect(N.ALL + T.ALL + O.ALL + B.ALL).toBe(D.ALL)
    expect([N.ALL, T.ALL, O.ALL, B.ALL]).toEqual([1, 1, 1, 1])
  })
})
