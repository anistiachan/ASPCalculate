import { beforeAll, describe, expect, it } from "vitest"

import { lmsZScore, roundZScore, valueAtZ } from "./lms"
import {
  computeAnthropometry,
  type AnthropometryInput,
  type AnthropometryResult,
} from "./compute"
import { loadWho2006References } from "./references/load-who-2006"
import {
  lookupByAgeDays,
  lookupByLengthHeight,
  type ReferenceSet,
} from "./references/reference"

let refs: ReferenceSet
beforeAll(async () => {
  refs = await loadWho2006References()
})

const BIRTH = "2020-01-01"

/** Tanggal ukur yang membuat umur tepat `days` hari sejak BIRTH. */
function measuredOnDay(days: number): string {
  const [year, month, day] = BIRTH.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10)
}

function compute(
  days: number,
  overrides: Partial<AnthropometryInput> = {}
): AnthropometryResult {
  return computeAnthropometry(
    {
      sex: "M",
      birthDate: BIRTH,
      measuredAt: measuredOnDay(days),
      weightKg: null,
      rawLengthHeightCm: null,
      position: "UNKNOWN",
      pittingEdema: "NONE",
      ...overrides,
    },
    refs
  )
}

describe("vektor uji dari suite tes WHO Anthro (paket anthro v1.1.0)", () => {
  it("BB/U: perempuan, 1522 hari, 17 kg → 0,24 (BB normal)", () => {
    const result = compute(1522, { sex: "F", weightKg: 17 })
    expect(result.waz).toBe(0.24)
    expect(result.wazCategory).toBe("BB_NORMAL")
    expect(result.flags).not.toContain("IMPLAUSIBLE_WAZ")
  })

  it("TB/U: laki-laki, 987 hari, 72,86 cm diukur telentang → dikoreksi 72,16 cm, z = -6,09, ditandai", () => {
    const result = compute(987, {
      rawLengthHeightCm: 72.86,
      position: "RECUMBENT",
    })
    expect(result.correctedLengthHeightCm).toBeCloseTo(72.16, 10)
    expect(result.correctionCm).toBe(-0.7)
    expect(result.haz).toBe(-6.09)
    expect(result.hazCategory).toBe("SANGAT_PENDEK")
    expect(result.flags).toContain("IMPLAUSIBLE_HAZ")
  })

  it("bayi 8 bulan diukur berdiri (60 cm): ditandai, tidak dikoreksi, z = -4,81", () => {
    // WHO membulatkan 8 × 30,4375 = 243,5 → 244 hari.
    const result = compute(244, { rawLengthHeightCm: 60, position: "STANDING" })
    expect(result.flags).toContain("STANDING_UNDER_9_MONTHS")
    expect(result.correctedLengthHeightCm).toBe(60)
    expect(result.haz).toBeCloseTo(-4.81, 2)
  })

  it("bayi 9 bulan diukur berdiri (60 cm): dikoreksi menjadi 60,7 cm, z = -5,02", () => {
    // 9 × 30,4375 = 273,94 → 274 hari.
    const result = compute(274, { rawLengthHeightCm: 60, position: "STANDING" })
    expect(result.flags).not.toContain("STANDING_UNDER_9_MONTHS")
    expect(result.correctedLengthHeightCm).toBeCloseTo(60.7, 10)
    expect(result.haz).toBeCloseTo(-5.02, 2)
  })

  it("TB/U: perempuan, 24 bulan (731 hari), 77,5 cm tanpa posisi → z = -2,55", () => {
    const result = compute(731, {
      sex: "F",
      rawLengthHeightCm: 77.5,
      position: "UNKNOWN",
    })
    expect(result.haz).toBeCloseTo(-2.55, 2)
    expect(result.flags).toContain("POSITION_UNKNOWN")
    expect(result.correctionCm).toBe(0)
  })

  it("koreksi panjang/tinggi: 730 berdiri +0,7; 800 telentang -0,7; yang sesuai tidak diubah", () => {
    const corrected = (days: number, position: "STANDING" | "RECUMBENT") =>
      compute(days, { rawLengthHeightCm: 100, position })
        .correctedLengthHeightCm
    expect(corrected(730, "STANDING")).toBeCloseTo(100.7, 10)
    expect(corrected(800, "RECUMBENT")).toBeCloseTo(99.3, 10)
    expect(corrected(730, "RECUMBENT")).toBe(100)
    expect(corrected(800, "STANDING")).toBe(100)
  })

  it("TB/U laki-laki 44 hari, 50 cm: z = ((50/56,4833) - 1) / 0,03492 dibulatkan", () => {
    const expected = Math.round(((50 / 56.4833 - 1) / 0.03492) * 100) / 100
    const result = compute(44, { rawLengthHeightCm: 50, position: "RECUMBENT" })
    expect(result.haz).toBe(expected)
    expect(result.haz).toBe(-3.29)
  })

  it("IMT = berat / (tinggi terkoreksi dalam meter)^2", () => {
    const result = compute(800, {
      weightKg: 12,
      rawLengthHeightCm: 100,
      position: "RECUMBENT",
    })
    expect(result.bmi).toBeCloseTo(12 / 0.993 ** 2, 10)
  })

  it("berat ≤ 0 atau tinggi ≤ 0 diperlakukan sebagai kosong, bukan nol", () => {
    const result = compute(300, {
      weightKg: 0,
      rawLengthHeightCm: -5,
      position: "RECUMBENT",
    })
    expect(result.weightKg).toBeNull()
    expect(result.rawLengthHeightCm).toBeNull()
    expect([result.waz, result.haz, result.whz, result.baz]).toEqual([
      null,
      null,
      null,
      null,
    ])
    expect(result.flags).toEqual(
      expect.arrayContaining(["WEIGHT_MISSING", "HEIGHT_MISSING"])
    )
  })
})

describe("batas umur 60 bulan", () => {
  it("1826 hari (59,99 bulan) dihitung; 1827 hari (60,02 bulan) tidak", () => {
    const at = (days: number) =>
      compute(days, {
        weightKg: 18,
        rawLengthHeightCm: 110,
        position: "STANDING",
      })

    expect(at(1826).waz).not.toBeNull()
    const over = at(1827)
    expect([over.waz, over.haz, over.whz, over.baz]).toEqual([
      null,
      null,
      null,
      null,
    ])
    expect(over.flags).toContain("AGE_OUT_OF_RANGE")
  })

  it("tanggal ukur sebelum lahir tidak menghasilkan apa pun dan diberi flag", () => {
    const result = computeAnthropometry(
      {
        sex: "M",
        birthDate: "2025-03-15",
        measuredAt: "2025-03-14",
        weightKg: 5,
        rawLengthHeightCm: 55,
        position: "RECUMBENT",
        pittingEdema: "NONE",
      },
      refs
    )
    expect(result.ageInDays).toBeNull()
    expect(result.waz).toBeNull()
    expect(result.flags).toEqual(["AGE_INVALID"])
  })

  it("hari lahir (umur 0) dihitung", () => {
    expect(compute(0, { weightKg: 3.3 }).waz).not.toBeNull()
  })
})

describe("BB/PB dan BB/TB", () => {
  const median = (table: "wfl" | "wfh", sex: "M" | "F", cm: number) =>
    lookupByLengthHeight(refs[table], sex, cm)!.m

  it("memakai tabel panjang (WFL) di bawah 731 hari dan tinggi (WFH) mulai 731 hari", () => {
    const at = (days: number, position: "STANDING" | "RECUMBENT") =>
      compute(days, { weightKg: 11, rawLengthHeightCm: 85, position })

    expect(at(730, "RECUMBENT").whzTable).toBe("WFL")
    expect(at(731, "STANDING").whzTable).toBe("WFH")
  })

  it("berat tepat di median tabel memberi z-score 0 (dan bukan -0)", () => {
    const w = median("wfh", "F", 85)
    const result = compute(800, {
      sex: "F",
      weightKg: w,
      rawLengthHeightCm: 85,
      position: "STANDING",
    })
    expect(Object.is(result.whz, 0)).toBe(true)
    expect(result.whzCategory).toBe("GIZI_BAIK")
  })

  it("tinggi di antara dua baris tabel diinterpolasi (kontinu dan monoton)", () => {
    const zAt = (cm: number) =>
      compute(800, {
        weightKg: 11,
        rawLengthHeightCm: cm,
        position: "STANDING",
      }).whz!
    // Makin tinggi anak, dengan berat sama, makin rendah z-score BB/TB.
    const values = [85, 85.02, 85.05, 85.08, 85.1].map(zAt)
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1])
    }
    // Perbedaan antar langkah kecil (tidak ada lompatan).
    expect(Math.abs(values[0] - values[4])).toBeLessThan(0.1)
  })

  it("tinggi di luar tabel: z-score kosong dan diberi flag", () => {
    const tooTall = compute(800, {
      weightKg: 20,
      rawLengthHeightCm: 121,
      position: "STANDING",
    })
    expect(tooTall.whz).toBeNull()
    expect(tooTall.flags).toContain("WFH_OUT_OF_RANGE")

    const tooShort = compute(100, {
      weightKg: 2,
      rawLengthHeightCm: 44,
      position: "RECUMBENT",
    })
    expect(tooShort.whz).toBeNull()
    expect(tooShort.flags).toContain("WFH_OUT_OF_RANGE")
    // Indikator lain tetap dihitung.
    expect(tooShort.haz).not.toBeNull()
  })

  it("batas rentang tabel dihitung (WFL 45 & 110, WFH 65 & 120)", () => {
    expect(
      compute(100, {
        weightKg: 2.5,
        rawLengthHeightCm: 45,
        position: "RECUMBENT",
      }).whz
    ).not.toBeNull()
    expect(
      compute(700, {
        weightKg: 18,
        rawLengthHeightCm: 110,
        position: "RECUMBENT",
      }).whz
    ).not.toBeNull()
    expect(
      compute(800, {
        weightKg: 7,
        rawLengthHeightCm: 65.7,
        position: "STANDING",
      }).whz
    ).not.toBeNull()
    expect(
      compute(1500, {
        weightKg: 25,
        rawLengthHeightCm: 120,
        position: "STANDING",
      }).whz
    ).not.toBeNull()
  })
})

describe("nilai ekstrem", () => {
  it("BB/U di luar ±3 SD memakai penyesuaian WHO, dan ditandai tidak wajar di luar [-6, +5]", () => {
    const lms = lookupByAgeDays(refs.wfa, "M", 365)!
    // Berat pada z = 3 + 2,5 (ekstrapolasi linear dengan jarak SD3-SD2).
    const sd3 = valueAtZ(lms, 3)
    const sd2 = valueAtZ(lms, 2)
    const weight = sd3 + 2.5 * (sd3 - sd2)
    const result = compute(365, { weightKg: weight })

    expect(result.waz).toBeCloseTo(5.5, 1)
    expect(result.wazCategory).toBe("BB_RISIKO_LEBIH")
    expect(result.flags).toContain("IMPLAUSIBLE_WAZ")
    // Rumus LMS biasa akan memberi angka yang jauh berbeda.
    expect(Math.abs(lmsZScore(weight, lms) - 5.5)).toBeGreaterThan(0.1)
  })

  it("TB/U memakai rumus LMS biasa tanpa penyesuaian di luar ±3 SD", () => {
    const lms = lookupByAgeDays(refs.lhfa, "F", 500)!
    const height = valueAtZ(lms, -5)
    const result = compute(500, {
      sex: "F",
      rawLengthHeightCm: height,
      position: "RECUMBENT",
    })
    expect(result.haz).toBe(roundZScore(lmsZScore(height, lms)))
    expect(result.haz).toBeCloseTo(-5, 1)
  })

  it("flag tidak wajar tepat di ambang: BB/U 5 dan -6 tidak ditandai, di luarnya ditandai", () => {
    const lms = lookupByAgeDays(refs.wfa, "F", 400)!
    const weightAt = (z: number) => {
      const sd3 = valueAtZ(lms, 3)
      const sd2 = valueAtZ(lms, 2)
      const n3 = valueAtZ(lms, -3)
      const n2 = valueAtZ(lms, -2)
      return z >= 3 ? sd3 + (z - 3) * (sd3 - sd2) : n3 + (z + 3) * (n2 - n3)
    }
    const flagged = (z: number) =>
      compute(400, { sex: "F", weightKg: weightAt(z) }).flags.includes(
        "IMPLAUSIBLE_WAZ"
      )

    expect(flagged(5)).toBe(false)
    expect(flagged(5.1)).toBe(true)
    expect(flagged(-6)).toBe(false)
    expect(flagged(-6.1)).toBe(true)
  })
})

describe("edema", () => {
  it("edema pitting ada: z-score berbasis berat tidak dihitung, TB/U tetap", () => {
    const result = compute(500, {
      weightKg: 9,
      rawLengthHeightCm: 75,
      position: "RECUMBENT",
      pittingEdema: "PRESENT",
    })
    expect([result.waz, result.whz, result.baz]).toEqual([null, null, null])
    expect(result.haz).not.toBeNull()
    expect(result.flags).toContain("PITTING_EDEMA_PRESENT")
  })

  it("isian edema yang belum dipetakan: tetap dihitung tetapi diberi flag", () => {
    const result = compute(500, { weightKg: 9, pittingEdema: "UNMAPPED" })
    expect(result.waz).not.toBeNull()
    expect(result.flags).toContain("PITTING_EDEMA_UNMAPPED")
  })
})

describe("kelengkapan data dan audit", () => {
  it("hanya berat: hanya BB/U yang dihitung, tanpa tebakan untuk yang lain", () => {
    const result = compute(300, { weightKg: 8 })
    expect(result.waz).not.toBeNull()
    expect([result.haz, result.whz, result.baz]).toEqual([null, null, null])
    expect(result.flags).toContain("HEIGHT_MISSING")
  })

  it("hanya tinggi: hanya TB/U yang dihitung", () => {
    const result = compute(300, {
      rawLengthHeightCm: 72,
      position: "RECUMBENT",
    })
    expect(result.haz).not.toBeNull()
    expect([result.waz, result.whz, result.baz, result.bmi]).toEqual([
      null,
      null,
      null,
      null,
    ])
    expect(result.flags).toContain("WEIGHT_MISSING")
  })

  it("menyimpan nilai mentah, nilai terkoreksi, dan versi referensi serta algoritma", () => {
    const result = compute(800, {
      weightKg: 12,
      rawLengthHeightCm: 88,
      position: "RECUMBENT",
    })
    expect(result.rawLengthHeightCm).toBe(88)
    expect(result.correctedLengthHeightCm).toBeCloseTo(87.3, 10)
    expect(result.standardName).toBe(
      "Permenkes 2/2020 + WHO Child Growth Standards 2006"
    )
    expect(result.algorithmVersion).toMatch(/^openasp-anthro-\d+\.\d+\.\d+$/)
    expect(result.referenceDataVersion).toContain("WHO-2006")
  })

  it("laki-laki dan perempuan memakai tabel berbeda", () => {
    const male = compute(500, { sex: "M", weightKg: 11 })
    const female = compute(500, { sex: "F", weightKg: 11 })
    expect(male.waz).not.toBe(female.waz)
  })

  it("z-score selalu dibulatkan 2 desimal", () => {
    const result = compute(500, {
      weightKg: 10.123456,
      rawLengthHeightCm: 77.77,
      position: "RECUMBENT",
    })
    for (const z of [result.waz, result.haz, result.whz, result.baz]) {
      expect(z).not.toBeNull()
      expect(Math.abs(z! * 100 - Math.round(z! * 100))).toBeLessThan(1e-9)
    }
  })

  it("klasifikasi memakai z-score yang sudah dibulatkan (z = -2,004 menjadi -2,00 → normal)", () => {
    const lms = lookupByAgeDays(refs.wfa, "M", 600)!
    // Berat dengan z mentah ≈ -2,004: dibulatkan menjadi -2,00 → "normal" (inklusif).
    const weight = valueAtZ(lms, -2.004)
    const result = compute(600, { weightKg: weight })
    expect(result.waz).toBe(-2)
    expect(result.wazCategory).toBe("BB_NORMAL")
  })
})
