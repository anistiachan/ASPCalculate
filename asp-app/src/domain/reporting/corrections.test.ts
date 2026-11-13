import { describe, expect, it } from "vitest"

import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import { planCorrections, type CorrectionRow } from "./corrections"

const kid = {
  id: "c1",
  name: "Anak Contoh",
  birthDate: "2024-03-01",
  posyandu: "JERUK",
} as StoredChild

const original = {
  id: "m1",
  childId: "c1",
  measuredAt: "2026-06-10",
  weightKg: 9,
  rawLengthHeightCm: 75,
} as StoredMeasurement

const TODAY = "2026-11-13"

const row = (extra: Partial<CorrectionRow> = {}): CorrectionRow => ({
  rowNumber: 2,
  code: "m1",
  rawWeight: 9.4,
  rawHeight: 76.5,
  rawDate: "2026-06-24",
  ...extra,
})

const plan = (
  rows: CorrectionRow[],
  measurements: StoredMeasurement[] = [original]
) => planCorrections(rows, [kid], measurements, TODAY)

describe("planCorrections", () => {
  it("baris yang dibiarkan kosong tidak disentuh", () => {
    const result = plan([
      row({ rawWeight: null, rawHeight: "", rawDate: undefined }),
    ])
    expect(result).toEqual({ items: [], rejected: [], untouched: 1 })
  })

  it("hasil ukur ulang yang lengkap menjadi pengukuran baru, bukan penimpaan", () => {
    const { items, rejected } = plan([row()])
    expect(rejected).toEqual([])
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      childId: "c1",
      originalMeasurementId: "m1",
      original: { measuredAt: "2026-06-10", weightKg: 9, heightCm: 75 },
      next: { measuredAt: "2026-06-24", weightKg: 9.4, heightCm: 76.5 },
      unchanged: false,
      jumps: [],
    })
  })

  it("tanggal ukur ulang wajib diisi", () => {
    const { items, rejected } = plan([row({ rawDate: null })])
    expect(items).toEqual([])
    expect(rejected[0].message).toContain("Tgl ukur ulang wajib diisi")
  })

  it("BB dan TB harus diisi keduanya", () => {
    expect(plan([row({ rawHeight: null })]).rejected[0].message).toContain(
      "keduanya"
    )
    expect(plan([row({ rawWeight: "" })]).rejected[0].message).toContain(
      "keduanya"
    )
  })

  it("tanggal serial Excel dan koma desimal dibaca", () => {
    // 46197 = 2026-06-24
    const { items } = plan([
      row({ rawDate: 46197, rawWeight: "9,4", rawHeight: "76,5" }),
    ])
    expect(items[0].next).toEqual({
      measuredAt: "2026-06-24",
      weightKg: 9.4,
      heightCm: 76.5,
    })
  })

  it("menolak kode asing, tanggal tidak mungkin, dan nilai di luar rentang wajar", () => {
    const cases: [Partial<CorrectionRow>, string][] = [
      [{ code: "xx" }, "Kode pengukuran tidak dikenal"],
      [{ rawDate: "2027-01-01" }, "masa depan"],
      [{ rawDate: "2024-02-01" }, "tanggal lahir"],
      [{ rawDate: "2026-06-10" }, "harus setelah"],
      [{ rawDate: "2026-05-01" }, "harus setelah"],
      [{ rawWeight: 45 }, "di luar rentang wajar"],
      [{ rawHeight: 20 }, "di luar rentang wajar"],
      [{ rawWeight: 0 }, "lebih dari nol"],
      [{ rawWeight: "abc" }, "tidak bisa dibaca"],
    ]
    for (const [extra, message] of cases) {
      const result = plan([row(extra)])
      expect(result.items, JSON.stringify(extra)).toEqual([])
      expect(result.rejected[0].message, JSON.stringify(extra)).toContain(
        message
      )
    }
  })

  it("menolak tanggal yang sudah punya pengukuran dan kode ganda", () => {
    const other = {
      ...original,
      id: "m2",
      measuredAt: "2026-06-24",
    } as StoredMeasurement
    expect(plan([row()], [original, other]).rejected[0].message).toContain(
      "sudah punya pengukuran"
    )

    const twice = plan([row(), row({ rowNumber: 3, rawDate: "2026-06-25" })])
    expect(twice.items).toHaveLength(1)
    expect(twice.rejected[0].message).toContain("lebih dari sekali")
  })

  it("lonjakan besar ditandai untuk dikonfirmasi, tidak ditolak", () => {
    const { items, rejected } = plan([
      row({ rawHeight: 80.5, rawWeight: 11.5 }),
    ])
    expect(rejected).toEqual([])
    expect(items[0].jumps).toHaveLength(2)
  })

  it("angka sama dengan semula ditandai 'unchanged' (menguatkan hasil lama)", () => {
    const { items } = plan([row({ rawWeight: 9, rawHeight: 75 })])
    expect(items[0].unchanged).toBe(true)
  })

  it("baris ditolak membawa nama anak dan nomor baris untuk pratinjau", () => {
    const { rejected } = plan([row({ rowNumber: 7, rawDate: null })])
    expect(rejected[0]).toMatchObject({ rowNumber: 7, name: "Anak Contoh" })
  })
})
