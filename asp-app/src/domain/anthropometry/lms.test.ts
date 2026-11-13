import { describe, expect, it } from "vitest"

import {
  lmsZScore,
  lmsZScoreAdjusted,
  roundZScore,
  valueAtZ,
  type Lms,
} from "./lms"

describe("lmsZScore", () => {
  it("memakai rumus ((y/M)^L - 1) / (L*S) untuk L != 0", () => {
    const lms: Lms = { l: 1, m: 56.4833, s: 0.03492 }
    expect(lmsZScore(50, lms)).toBeCloseTo((50 / 56.4833 - 1) / 0.03492, 12)
  })

  it("memakai ln(y/M)/S untuk L = 0", () => {
    const lms: Lms = { l: 0, m: 10, s: 0.1 }
    expect(lmsZScore(12, lms)).toBeCloseTo(Math.log(1.2) / 0.1, 12)
  })

  it("L = 0 adalah limit dari L mendekati 0", () => {
    const base = { m: 10, s: 0.12 }
    const atZero = lmsZScore(11, { ...base, l: 0 })
    expect(lmsZScore(11, { ...base, l: 1e-6 })).toBeCloseTo(atZero, 4)
    expect(lmsZScore(11, { ...base, l: -1e-6 })).toBeCloseTo(atZero, 4)
  })

  it("z = 0 tepat pada median", () => {
    // Bisa -0 untuk L negatif; nilainya tetap nol.
    expect(
      lmsZScore(13.4069, { l: -0.3053, m: 13.4069, s: 0.0956 })
    ).toBeCloseTo(0, 12)
  })
})

describe("valueAtZ", () => {
  const cases: Lms[] = [
    { l: 0.3487, m: 3.3464, s: 0.14602 },
    { l: -0.3053, m: 13.4069, s: 0.0956 },
    { l: 1, m: 49.8842, s: 0.03795 },
    { l: 0, m: 10, s: 0.1 },
  ]

  it.each(cases)("kebalikan dari lmsZScore untuk %o", (lms) => {
    for (const z of [-3, -2, -1, 0, 1, 2, 3]) {
      expect(lmsZScore(valueAtZ(lms, z), lms)).toBeCloseTo(z, 9)
    }
  })
})

describe("lmsZScoreAdjusted (penyesuaian WHO di luar ±3 SD)", () => {
  const lms: Lms = { l: 0.3487, m: 3.3464, s: 0.14602 }

  it("sama dengan rumus biasa di dalam ±3 SD", () => {
    for (const z of [-3, -2.5, -1, 0, 1, 2.5, 3]) {
      const y = valueAtZ(lms, z)
      expect(lmsZScoreAdjusted(y, lms)).toBeCloseTo(lmsZScore(y, lms), 12)
    }
  })

  it("kontinu tepat di ±3 SD", () => {
    expect(lmsZScoreAdjusted(valueAtZ(lms, 3), lms)).toBeCloseTo(3, 9)
    expect(lmsZScoreAdjusted(valueAtZ(lms, -3), lms)).toBeCloseTo(-3, 9)
  })

  it("di luar ±3 SD diekstrapolasi linear dengan jarak SD3-SD2", () => {
    const sd2 = valueAtZ(lms, 2)
    const sd3 = valueAtZ(lms, 3)
    const y = sd3 + 0.5 * (sd3 - sd2)
    expect(lmsZScoreAdjusted(y, lms)).toBeCloseTo(3.5, 9)

    const sdn2 = valueAtZ(lms, -2)
    const sdn3 = valueAtZ(lms, -3)
    expect(lmsZScoreAdjusted(sdn3 - 2 * (sdn2 - sdn3), lms)).toBeCloseTo(-5, 9)
  })

  it("berbeda dari rumus biasa di luar ±3 SD (bukan sekadar sama)", () => {
    const y = valueAtZ(lms, 3) + 2 * (valueAtZ(lms, 3) - valueAtZ(lms, 2))
    expect(
      Math.abs(lmsZScoreAdjusted(y, lms) - lmsZScore(y, lms))
    ).toBeGreaterThan(0.05)
  })

  it("monoton naik terhadap pengukuran, termasuk melewati ±3 SD", () => {
    let previous = -Infinity
    for (let y = 1.5; y <= 7; y += 0.05) {
      const z = lmsZScoreAdjusted(y, lms)
      expect(z).toBeGreaterThan(previous)
      previous = z
    }
  })
})

describe("roundZScore", () => {
  it("membulatkan ke 2 desimal", () => {
    expect(roundZScore(-2.004)).toBe(-2)
    expect(roundZScore(-2.006)).toBe(-2.01)
    expect(roundZScore(0.244)).toBe(0.24)
    expect(roundZScore(3.999)).toBe(4)
  })

  it("tidak pernah menghasilkan nol negatif (akan tampil sebagai '-0')", () => {
    expect(Object.is(roundZScore(-0), 0)).toBe(true)
    expect(Object.is(roundZScore(-0.004), 0)).toBe(true)
    expect(Object.is(roundZScore(0), 0)).toBe(true)
  })

  it("z-score tepat di median setelah dibulatkan adalah +0", () => {
    const lms = { l: -0.3053, m: 13.4069, s: 0.0956 }
    expect(Object.is(roundZScore(lmsZScore(13.4069, lms)), 0)).toBe(true)
  })
})
