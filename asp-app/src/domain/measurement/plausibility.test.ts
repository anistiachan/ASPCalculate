import { describe, expect, it } from "vitest"

import { checkPlausibility } from "./plausibility"

describe("checkPlausibility", () => {
  it("tidak memberi peringatan untuk nilai wajar", () => {
    expect(
      checkPlausibility({
        weightKg: 11.2,
        heightCm: 82.5,
        lilaCm: 14.5,
        headCm: 47,
      })
    ).toEqual([])
  })

  it("memberi peringatan untuk nilai di luar rentang, di kedua sisi", () => {
    const fields = (values: Parameters<typeof checkPlausibility>[0]) =>
      checkPlausibility(values).map((warning) => warning.field)

    expect(fields({ weightKg: 0.5 })).toEqual(["weightKg"])
    expect(fields({ weightKg: 45 })).toEqual(["weightKg"])
    expect(fields({ heightCm: 20 })).toEqual(["heightCm"])
    expect(fields({ heightCm: 200 })).toEqual(["heightCm"])
    expect(fields({ lilaCm: 40 })).toEqual(["lilaCm"])
    expect(fields({ headCm: 10 })).toEqual(["headCm"])
  })

  it("batas rentang itu sendiri dianggap wajar", () => {
    expect(checkPlausibility({ weightKg: 1, heightCm: 130 })).toEqual([])
  })

  it("mengabaikan nilai kosong", () => {
    expect(checkPlausibility({ weightKg: null, heightCm: undefined })).toEqual(
      []
    )
    expect(checkPlausibility({})).toEqual([])
  })

  it("menyebut nilai dan rentang pada pesan", () => {
    const [warning] = checkPlausibility({ weightKg: 45 })
    expect(warning.message).toContain("45 kg")
    expect(warning.message).toContain("1–30 kg")
  })
})
