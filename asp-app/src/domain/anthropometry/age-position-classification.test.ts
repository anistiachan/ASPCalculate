import { describe, expect, it } from "vitest"

import { ageInDays, ageInMonthsExact } from "./age"
import {
  CATEGORY_LABELS,
  CATEGORY_SEVERITY,
  classifyHeightForAge,
  classifyNutritionalStatus,
  classifyWeightForAge,
} from "./classification"
import { standardizeLengthHeight } from "./position"

describe("ageInDays", () => {
  it("menghitung hari kalender penuh", () => {
    expect(ageInDays("2025-03-15", "2025-03-15")).toBe(0)
    expect(ageInDays("2025-03-15", "2025-03-16")).toBe(1)
    expect(ageInDays("2025-01-01", "2026-01-01")).toBe(365)
    expect(ageInDays("2024-01-01", "2025-01-01")).toBe(366) // tahun kabisat
  })

  it("tidak bergeser oleh pergantian bulan dan tahun", () => {
    expect(ageInDays("2025-12-31", "2026-01-01")).toBe(1)
    expect(ageInDays("2024-02-28", "2024-03-01")).toBe(2)
  })

  it("null jika tanggal ukur sebelum tanggal lahir", () => {
    expect(ageInDays("2025-03-15", "2025-03-14")).toBeNull()
  })
})

describe("ageInMonthsExact", () => {
  it("membagi hari dengan 30,4375", () => {
    expect(ageInMonthsExact(0)).toBe(0)
    expect(ageInMonthsExact(1826.25)).toBeCloseTo(60, 12)
    expect(ageInMonthsExact(731)).toBeCloseTo(24.0164, 3)
  })
})

describe("standardizeLengthHeight", () => {
  const standardize = (
    position: "STANDING" | "RECUMBENT" | "UNKNOWN",
    ageDays: number,
    rawCm = 100
  ) => standardizeLengthHeight({ rawCm, position, ageDays })

  it("berdiri di bawah 731 hari: +0,7 cm", () => {
    expect(standardize("STANDING", 730)).toMatchObject({
      cm: 100.7,
      correctionCm: 0.7,
      flags: ["POSITION_CORRECTED_UP"],
    })
  })

  it("telentang pada 731 hari ke atas: -0,7 cm", () => {
    const result = standardize("RECUMBENT", 731)
    expect(result.cm).toBeCloseTo(99.3, 10)
    expect(result.correctionCm).toBe(-0.7)
    expect(result.flags).toEqual(["POSITION_CORRECTED_DOWN"])
  })

  it("posisi yang sudah sesuai umur tidak dikoreksi (batas 730/731 hari)", () => {
    expect(standardize("RECUMBENT", 730)).toMatchObject({
      cm: 100,
      correctionCm: 0,
      flags: [],
    })
    expect(standardize("STANDING", 731)).toMatchObject({
      cm: 100,
      correctionCm: 0,
      flags: [],
    })
  })

  it("posisi tidak diketahui: tidak dikoreksi dan diberi flag", () => {
    expect(standardize("UNKNOWN", 200)).toMatchObject({
      cm: 100,
      correctionCm: 0,
      flags: ["POSITION_UNKNOWN"],
    })
  })

  it("berdiri pada bayi di bawah 9 bulan: tidak dikoreksi dan diberi flag", () => {
    // 8 bulan ≈ 244 hari; 9 bulan ≈ 274 hari (30,4375 hari/bulan).
    expect(standardize("STANDING", 244, 60)).toMatchObject({
      cm: 60,
      correctionCm: 0,
      flags: ["STANDING_UNDER_9_MONTHS"],
      effectivePosition: "UNKNOWN",
    })
    expect(standardize("STANDING", 274, 60)).toMatchObject({
      cm: 60.7,
      correctionCm: 0.7,
      flags: ["POSITION_CORRECTED_UP"],
    })
  })

  it("batas 9 bulan tepat: 273 hari masih di bawah, 274 hari tidak", () => {
    expect(standardize("STANDING", 273, 60).flags).toContain(
      "STANDING_UNDER_9_MONTHS"
    )
    expect(standardize("STANDING", 274, 60).flags).not.toContain(
      "STANDING_UNDER_9_MONTHS"
    )
  })

  it("telentang pada bayi muda tidak diberi flag 9 bulan", () => {
    expect(standardize("RECUMBENT", 100).flags).toEqual([])
  })
})

describe("klasifikasi Permenkes 2/2020 — batas tepat", () => {
  it("BB/U", () => {
    const at = classifyWeightForAge
    expect(at(-3.01)).toBe("BB_SANGAT_KURANG")
    expect(at(-3)).toBe("BB_KURANG")
    expect(at(-2.01)).toBe("BB_KURANG")
    expect(at(-2)).toBe("BB_NORMAL")
    expect(at(1)).toBe("BB_NORMAL")
    expect(at(1.01)).toBe("BB_RISIKO_LEBIH")
  })

  it("TB/U atau PB/U", () => {
    const at = classifyHeightForAge
    expect(at(-3.01)).toBe("SANGAT_PENDEK")
    expect(at(-3)).toBe("PENDEK")
    expect(at(-2.01)).toBe("PENDEK")
    expect(at(-2)).toBe("TB_NORMAL")
    expect(at(3)).toBe("TB_NORMAL")
    expect(at(3.01)).toBe("TINGGI")
  })

  it("BB/PB-TB dan IMT/U", () => {
    const at = classifyNutritionalStatus
    expect(at(-3.01)).toBe("GIZI_BURUK")
    expect(at(-3)).toBe("GIZI_KURANG")
    expect(at(-2.01)).toBe("GIZI_KURANG")
    expect(at(-2)).toBe("GIZI_BAIK")
    expect(at(1)).toBe("GIZI_BAIK")
    expect(at(1.01)).toBe("BERISIKO_GIZI_LEBIH")
    expect(at(2)).toBe("BERISIKO_GIZI_LEBIH")
    expect(at(2.01)).toBe("GIZI_LEBIH")
    expect(at(3)).toBe("GIZI_LEBIH")
    expect(at(3.01)).toBe("OBESITAS")
  })

  it("setiap z-score di rentang −10..+10 mendapat tepat satu kategori (tanpa celah)", () => {
    for (let z = -1000; z <= 1000; z++) {
      const value = z / 100
      expect(classifyWeightForAge(value)).toBeDefined()
      expect(classifyHeightForAge(value)).toBeDefined()
      expect(classifyNutritionalStatus(value)).toBeDefined()
    }
  })

  it("ambang yang berbeda antar indikator tidak tertukar (lihat OPENASP-VALIDASI-ANTROPOMETRI)", () => {
    // z = +1,5: BB/U sudah berisiko lebih, TB/U masih normal, BB/TB berisiko gizi lebih.
    expect(classifyWeightForAge(1.5)).toBe("BB_RISIKO_LEBIH")
    expect(classifyHeightForAge(1.5)).toBe("TB_NORMAL")
    expect(classifyNutritionalStatus(1.5)).toBe("BERISIKO_GIZI_LEBIH")
  })

  it("setiap kategori punya label resmi dan tingkat perhatian", () => {
    for (const category of Object.keys(CATEGORY_LABELS)) {
      expect(
        CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]
      ).not.toBe("")
      expect(["ok", "watch", "alert"]).toContain(
        CATEGORY_SEVERITY[category as keyof typeof CATEGORY_SEVERITY]
      )
    }
    expect(CATEGORY_LABELS.BB_SANGAT_KURANG).toBe("Berat badan sangat kurang")
    expect(CATEGORY_LABELS.BERISIKO_GIZI_LEBIH).toBe("Berisiko gizi lebih")
  })
})
