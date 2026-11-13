import { describe, expect, it } from "vitest"

import type { AnthropometryResult } from "@/domain/anthropometry/compute"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import { buildStatusLists, buildTargetLists, type StatusListId } from "./lists"

const child = (
  id: string,
  birthDate: string,
  extra: Partial<StoredChild> = {}
): StoredChild =>
  ({
    id,
    name: `Anak ${id}`,
    sex: "M",
    birthDate,
    posyandu: null,
    ...extra,
  }) as StoredChild

let counter = 0
const measurement = (
  childId: string,
  measuredAt: string,
  extra: Partial<StoredMeasurement> = {}
): StoredMeasurement =>
  ({
    id: `m${++counter}`,
    childId,
    measuredAt,
    weightKg: 10,
    rawLengthHeightCm: 80,
    vitaminAStatus: null,
    breastfeedingByMonth: {},
    ...extra,
  }) as StoredMeasurement

const result = (extra: Partial<AnthropometryResult> = {}) =>
  ({
    ageInMonthsExact: 12.4,
    weightKg: 10,
    rawLengthHeightCm: 80,
    correctedLengthHeightCm: 80,
    waz: 0,
    haz: 0,
    whz: 0,
    wazCategory: "BB_NORMAL",
    hazCategory: "TB_NORMAL",
    whzCategory: "GIZI_BAIK",
    ...extra,
  }) as AnthropometryResult

function lists(
  entries: { c: StoredChild; r: Partial<AnthropometryResult> }[]
): Record<StatusListId, string[]> {
  const ms = entries.map(({ c }) => measurement(c.id, "2026-06-10"))
  const results = new Map(
    entries.map(({ r }, i) => [ms[i].id, result(r)] as const)
  )
  const built = buildStatusLists(
    "2026-06",
    entries.map((e) => e.c),
    ms,
    results
  )
  return Object.fromEntries(
    Object.entries(built.lists).map(([id, list]) => [
      id,
      list.map((e) => e.name),
    ])
  ) as Record<StatusListId, string[]>
}

const a = child("A", "2025-06-01")

describe("buildStatusLists", () => {
  it("memetakan kategori Permenkes ke daftar menu workbook", () => {
    const cases: [Partial<AnthropometryResult>, StatusListId][] = [
      [{ hazCategory: "SANGAT_PENDEK", haz: -3.5 }, "SANGAT_PENDEK"],
      [{ hazCategory: "PENDEK", haz: -2.5 }, "PENDEK"],
      [{ wazCategory: "BB_SANGAT_KURANG", waz: -3.5 }, "BGM"],
      [{ wazCategory: "BB_KURANG", waz: -2.5 }, "BBK"],
      [{ whzCategory: "GIZI_BURUK", whz: -3.5 }, "SANGAT_KURUS"],
      [{ whzCategory: "GIZI_KURANG", whz: -2.5 }, "KURUS"],
      [{ whzCategory: "GIZI_LEBIH", whz: 2.5 }, "GEMUK"],
      [{ whzCategory: "OBESITAS", whz: 3.5 }, "GEMUK"],
    ]
    for (const [override, id] of cases) {
      const built = lists([{ c: a, r: override }])
      expect(built[id], id).toEqual(["Anak A"])
    }
  })

  it("anak normal tidak masuk daftar mana pun", () => {
    const built = lists([{ c: a, r: {} }])
    for (const names of Object.values(built)) expect(names).toEqual([])
  })

  it("berisiko gizi lebih bukan gemuk", () => {
    const built = lists([
      { c: a, r: { whzCategory: "BERISIKO_GIZI_LEBIH", whz: 1.5 } },
    ])
    expect(built.GEMUK).toEqual([])
    expect(built.BERMASALAH).toEqual([])
  })

  it("BBK tidak termasuk balita bermasalah, tetapi BGM, pendek, dan gemuk termasuk", () => {
    const built = lists([
      {
        c: child("1", "2025-06-01"),
        r: { wazCategory: "BB_KURANG", waz: -2.5 },
      },
      {
        c: child("2", "2025-06-01"),
        r: { wazCategory: "BB_SANGAT_KURANG", waz: -3.5 },
      },
      {
        c: child("3", "2025-06-01"),
        r: { hazCategory: "PENDEK", haz: -2.2 },
      },
      {
        c: child("4", "2025-06-01"),
        r: { whzCategory: "GIZI_LEBIH", whz: 2.4 },
      },
    ])
    expect(built.BBK).toEqual(["Anak 1"])
    expect(built.BERMASALAH).toEqual(["Anak 2", "Anak 3", "Anak 4"])
  })

  it("calon balita kurus: BB/TB −2 sampai kurang dari −1,8 (rentang workbook)", () => {
    const at = (whz: number) =>
      lists([
        {
          c: a,
          r: {
            whz,
            whzCategory: whz < -2 ? "GIZI_KURANG" : "GIZI_BAIK",
          },
        },
      ]).CALON_KURUS.length
    expect(at(-2)).toBe(1) // batas bawah inklusif
    expect(at(-1.81)).toBe(1)
    expect(at(-1.8)).toBe(0) // batas atas eksklusif
    expect(at(-1.5)).toBe(0)
    expect(at(-2.01)).toBe(0) // sudah kurus, bukan calon
  })

  it("calon balita kurus ikut balita bermasalah", () => {
    const built = lists([{ c: a, r: { whz: -1.9 } }])
    expect(built.BERMASALAH).toEqual(["Anak A"])
  })

  it("anak dihitung sekali: pengukuran terakhir bulan itu yang dipakai", () => {
    const early = measurement("A", "2026-06-02")
    const late = measurement("A", "2026-06-20")
    const results = new Map([
      [early.id, result({ hazCategory: "PENDEK", haz: -2.4 })],
      [late.id, result()],
    ])
    const built = buildStatusLists("2026-06", [a], [early, late], results)
    expect(built.measured).toBe(1)
    expect(built.lists.PENDEK).toEqual([])
  })

  it("anak yang tidak diukur bulan itu atau sudah 60 bulan tidak dihitung", () => {
    const old = child("O", "2021-01-01") // 65 bulan pada Juni 2026
    const noData = child("N", "2025-06-01")
    const m = measurement("O", "2026-06-10")
    const built = buildStatusLists(
      "2026-06",
      [old, noData],
      [m],
      new Map([[m.id, result({ hazCategory: "PENDEK", haz: -2.4 })]])
    )
    expect(built.measured).toBe(0)
    expect(built.lists.PENDEK).toEqual([])
  })

  it("mengurutkan menurut Posyandu lalu nama, dan memuat Posyandu", () => {
    const built = buildStatusLists(
      "2026-06",
      [
        child("B", "2025-06-01", { name: "Budi", posyandu: "PEPAYA" }),
        child("A", "2025-06-01", { name: "Ani", posyandu: "PEPAYA" }),
        child("C", "2025-06-01", { name: "Cici", posyandu: "JERUK" }),
      ],
      ["A", "B", "C"].map((id) => measurement(id, "2026-06-10")),
      new Map<string, AnthropometryResult>()
    )
    expect(built.measured).toBe(3)

    const ms = ["A", "B", "C"].map((id) => measurement(id, "2026-06-10"))
    const results = new Map(
      ms.map((m) => [m.id, result({ hazCategory: "PENDEK", haz: -2.4 })])
    )
    const sorted = buildStatusLists(
      "2026-06",
      [
        child("B", "2025-06-01", { name: "Budi", posyandu: "PEPAYA" }),
        child("A", "2025-06-01", { name: "Ani", posyandu: "PEPAYA" }),
        child("C", "2025-06-01", { name: "Cici", posyandu: "JERUK" }),
      ],
      ms,
      results
    )
    expect(sorted.lists.PENDEK.map((e) => e.name)).toEqual([
      "Cici",
      "Ani",
      "Budi",
    ])
    expect(sorted.lists.PENDEK[0].posyandu).toBe("JERUK")
  })
})

describe("buildTargetLists", () => {
  // Umur kalender pada Juni 2026 = (2026−tahun)*12 + (6−bulan lahir).
  const born = (monthsAgo: number, id = `m${monthsAgo}`) => {
    const total = 2026 * 12 + 5 - monthsAgo // indeks bulan lahir (0-based)
    const year = Math.floor(total / 12)
    const month = (total % 12) + 1
    return child(id, `${year}-${String(month).padStart(2, "0")}-10`)
  }

  const ids = (list: { childId: string }[]) => list.map((e) => e.childId).sort()

  it("membagi sasaran menurut umur: biru 6–11, merah 12–60, ASI 0–6", () => {
    const children = [0, 5, 6, 11, 12, 60, 61].map((age) => born(age))
    const { lists } = buildTargetLists("2026-06", children, [])
    expect(ids(lists.VITAMIN_A_BIRU)).toEqual(["m11", "m6"])
    expect(ids(lists.VITAMIN_A_MERAH)).toEqual(["m12", "m60"])
    expect(ids(lists.ASI)).toEqual(["m0", "m5", "m6"])
  })

  it("anak yang belum lahir pada bulan itu tidak ada", () => {
    const future = child("F", "2026-07-01")
    const { lists } = buildTargetLists("2026-06", [future], [])
    expect(lists.ASI).toEqual([])
  })

  it("Vitamin A: sudah bila ada isian ya, selain itu belum tercatat (bukan tidak)", () => {
    const given = born(8, "G")
    const blank = born(9, "B")
    const no = born(10, "N")
    const { lists } = buildTargetLists(
      "2026-06",
      [given, blank, no],
      [
        measurement("G", "2026-06-10", { vitaminAStatus: true }),
        measurement("B", "2026-06-10", { vitaminAStatus: null }),
        measurement("N", "2026-06-10", { vitaminAStatus: false }),
      ]
    )
    const status = Object.fromEntries(
      lists.VITAMIN_A_BIRU.map((e) => [e.childId, e.status])
    )
    expect(status).toEqual({ G: "YES", B: "UNKNOWN", N: "UNKNOWN" })
  })

  it("Vitamin A di bulan lain tidak dihitung untuk bulan ini", () => {
    const c = born(8, "G")
    const { lists } = buildTargetLists(
      "2026-06",
      [c],
      [measurement("G", "2026-05-10", { vitaminAStatus: true })]
    )
    expect(lists.VITAMIN_A_BIRU[0].status).toBe("UNKNOWN")
  })

  it("ASI: dibaca dari isian pada umur anak; ya, tidak, atau belum diisi", () => {
    const yes = born(3, "Y")
    const no = born(4, "N")
    const blank = born(2, "B")
    const { lists } = buildTargetLists(
      "2026-06",
      [yes, no, blank],
      [
        measurement("Y", "2026-06-10", { breastfeedingByMonth: { 3: true } }),
        measurement("N", "2026-06-10", { breastfeedingByMonth: { 4: false } }),
        // Isian untuk umur lain tidak dipakai.
        measurement("B", "2026-06-10", { breastfeedingByMonth: { 1: true } }),
      ]
    )
    const status = Object.fromEntries(
      lists.ASI.map((e) => [e.childId, e.status])
    )
    expect(status).toEqual({ Y: "YES", N: "NO", B: "UNKNOWN" })
  })
})
