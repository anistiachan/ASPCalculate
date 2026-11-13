import { describe, expect, it } from "vitest"

import {
  ALGORITHM_VERSION,
  ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL,
  DAYS_PER_MONTH,
  LENGTH_HEIGHT_SWITCH_DAYS,
  MAX_AGE_MONTHS_EXCLUSIVE,
  POSITION_CORRECTION_CM,
  STANDING_IMPLAUSIBLE_UNDER_MONTHS,
} from "./constants"

describe("konstanta mesin antropometri", () => {
  it("penanda validasi tenaga kesehatan tetap false sampai ada tinjauan tertulis", () => {
    // Jangan ubah tes ini tanpa catatan tinjauan di docs/OPENASP-VALIDASI-ANTROPOMETRI.md
    // (bagian 6). Selama false, setiap hasil menampilkan peringatan "belum divalidasi".
    expect(ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL).toBe(false)
  })

  it("nilai yang bersumber dari WHO Anthro dan Permenkes tidak berubah diam-diam", () => {
    expect(DAYS_PER_MONTH).toBe(30.4375)
    expect(MAX_AGE_MONTHS_EXCLUSIVE).toBe(60)
    expect(LENGTH_HEIGHT_SWITCH_DAYS).toBe(731)
    expect(POSITION_CORRECTION_CM).toBe(0.7)
    expect(STANDING_IMPLAUSIBLE_UNDER_MONTHS).toBe(9)
  })

  it("versi algoritma berformat semver", () => {
    expect(ALGORITHM_VERSION).toMatch(/^openasp-anthro-\d+\.\d+\.\d+$/)
  })
})
