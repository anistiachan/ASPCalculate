import { describe, expect, it } from "vitest"

import { completedMonths, todayIso } from "./completed-months"

describe("completedMonths", () => {
  it("0 bulan pada hari lahir dan sebelum tanggal lahir bulan berikutnya tercapai", () => {
    expect(completedMonths("2025-03-15", "2025-03-15")).toBe(0)
    expect(completedMonths("2025-03-15", "2025-04-14")).toBe(0)
  })

  it("bulan penuh saat tanggal harian lahir tercapai", () => {
    expect(completedMonths("2025-03-15", "2025-04-15")).toBe(1)
    expect(completedMonths("2025-03-15", "2025-04-16")).toBe(1)
  })

  it("umur 2 bulan 29 hari tetap dihitung 2 bulan (Permenkes 2/2020)", () => {
    // 15 Maret → 14 Juni = 2 bulan 30 hari; sehari sebelum genap 3 bulan.
    expect(completedMonths("2025-03-15", "2025-06-14")).toBe(2)
    expect(completedMonths("2025-03-15", "2025-06-15")).toBe(3)
  })

  it("melewati pergantian tahun", () => {
    expect(completedMonths("2024-11-20", "2025-02-19")).toBe(2)
    expect(completedMonths("2024-11-20", "2025-02-20")).toBe(3)
  })

  it("tepat 24 dan 60 bulan", () => {
    expect(completedMonths("2023-05-10", "2025-05-09")).toBe(23)
    expect(completedMonths("2023-05-10", "2025-05-10")).toBe(24)
    expect(completedMonths("2020-05-10", "2025-05-10")).toBe(60)
  })

  it("null jika tanggal acuan sebelum tanggal lahir", () => {
    expect(completedMonths("2025-03-15", "2025-03-14")).toBeNull()
  })
})

describe("todayIso", () => {
  it("memakai tanggal lokal dengan nol di depan", () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05")
    expect(todayIso(new Date(2026, 10, 12, 0, 1))).toBe("2026-11-12")
  })
})
