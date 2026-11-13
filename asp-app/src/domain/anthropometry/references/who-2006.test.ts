import { beforeAll, describe, expect, it } from "vitest"

import { lmsZScore, lmsZScoreAdjusted } from "../lms"
import { loadWho2006References } from "./load-who-2006"
import {
  lookupByAgeDays,
  lookupByLengthHeight,
  type ReferenceSet,
} from "./reference"

let refs: ReferenceSet
beforeAll(async () => {
  refs = await loadWho2006References()
})

/**
 * Baris yang dikutip dari tabel "expanded tables" resmi WHO (cdn.who.int), termasuk kolom
 * SD yang diterbitkan WHO. Dipakai sebagai kebenaran independen untuk data dan rumus:
 * nilai pengukuran yang sama dengan SD ke-k harus menghasilkan z-score k.
 */
type PublishedRow = {
  label: string
  table: "wfa" | "lhfa" | "bfa" | "wfl" | "wfh"
  sex: "M" | "F"
  key: number
  lms: [l: number, m: number, s: number]
  /** SD-4 … SD+4 sebagaimana diterbitkan WHO. */
  sd: number[]
}

const PUBLISHED: PublishedRow[] = [
  {
    label: "BB/U laki-laki hari 0",
    table: "wfa",
    sex: "M",
    key: 0,
    lms: [0.3487, 3.3464, 0.14602],
    sd: [1.701, 2.08, 2.459, 2.881, 3.346, 3.859, 4.419, 5.031, 5.642],
  },
  {
    label: "BB/U laki-laki hari 1",
    table: "wfa",
    sex: "M",
    key: 1,
    lms: [0.3127, 3.3174, 0.14693],
    sd: [1.692, 2.065, 2.437, 2.854, 3.317, 3.83, 4.394, 5.013, 5.633],
  },
  {
    label: "BB/U laki-laki hari 1856",
    table: "wfa",
    sex: "M",
    key: 1856,
    lms: [-0.1534, 18.4968, 0.1358],
    sd: [
      10.742, 12.459, 14.175, 16.171, 18.497, 21.218, 24.411, 28.171, 31.931,
    ],
  },
  {
    label: "BB/U perempuan hari 0",
    table: "wfa",
    sex: "F",
    key: 0,
    lms: [0.3809, 3.2322, 0.14171],
    sd: [1.671, 2.033, 2.395, 2.794, 3.232, 3.711, 4.23, 4.793, 5.356],
  },
  {
    label: "TB/U laki-laki hari 0",
    table: "lhfa",
    sex: "M",
    key: 0,
    lms: [1, 49.8842, 0.03795],
    sd: [42.312, 44.205, 46.098, 47.991, 49.884, 51.777, 53.67, 55.564, 57.457],
  },
  {
    label: "TB/U perempuan hari 1856",
    table: "lhfa",
    sex: "F",
    key: 1856,
    lms: [1, 109.9352, 0.04358],
    sd: [
      90.771, 95.562, 100.353, 105.144, 109.935, 114.726, 119.517, 124.308,
      129.099,
    ],
  },
  {
    label: "IMT/U laki-laki hari 0",
    table: "bfa",
    sex: "M",
    key: 0,
    lms: [-0.3053, 13.4069, 0.0956],
    sd: [9.235, 10.184, 11.133, 12.201, 13.407, 14.773, 16.326, 18.1, 19.874],
  },
  {
    label: "IMT/U perempuan hari 1856",
    table: "bfa",
    sex: "F",
    key: 1856,
    lms: [-0.5684, 15.2798, 0.09825],
    sd: [10.587, 11.635, 12.683, 13.887, 15.28, 16.905, 18.82, 21.097, 23.374],
  },
  {
    label: "BB/PB laki-laki 45 cm",
    table: "wfl",
    sex: "M",
    key: 45,
    lms: [-0.3521, 2.441, 0.09182],
    sd: [1.71, 1.877, 2.043, 2.23, 2.441, 2.68, 2.951, 3.261, 3.571],
  },
  {
    label: "BB/PB perempuan 110 cm",
    table: "wfl",
    sex: "F",
    key: 110,
    lms: [-0.3833, 18.3324, 0.09401],
    sd: [
      12.762, 14.025, 15.289, 16.715, 18.332, 20.174, 22.283, 24.708, 27.134,
    ],
  },
  {
    label: "BB/TB laki-laki 65 cm",
    table: "wfh",
    sex: "M",
    key: 65,
    lms: [-0.3521, 7.4327, 0.08217],
    sd: [5.401, 5.868, 6.335, 6.854, 7.433, 8.079, 8.804, 9.619, 10.435],
  },
  {
    label: "BB/TB perempuan 120 cm",
    table: "wfh",
    sex: "F",
    key: 120,
    lms: [-0.3833, 22.8173, 0.09828],
    sd: [
      15.634, 17.256, 18.878, 20.719, 22.817, 25.222, 27.991, 31.199, 34.407,
    ],
  },
]

const SD_LEVELS = [-4, -3, -2, -1, 0, 1, 2, 3, 4]

function lookup(row: PublishedRow) {
  return row.table === "wfl" || row.table === "wfh"
    ? lookupByLengthHeight(refs[row.table], row.sex, row.key)
    : lookupByAgeDays(refs[row.table], row.sex, row.key)
}

describe("tabel referensi WHO 2006 — integritas", () => {
  it("memuat lima tabel dengan jumlah baris yang tepat", () => {
    expect(refs.wfa.count).toBe(1857)
    expect(refs.lhfa.count).toBe(1857)
    expect(refs.bfa.count).toBe(1857)
    expect(refs.wfl.count).toBe(651)
    expect(refs.wfh.count).toBe(551)
  })

  it("panjang kolom sama dengan jumlah baris, untuk kedua jenis kelamin", () => {
    for (const table of [refs.wfa, refs.lhfa, refs.bfa, refs.wfl, refs.wfh]) {
      for (const sex of [table.male, table.female]) {
        expect(sex.l).toHaveLength(table.count)
        expect(sex.m).toHaveLength(table.count)
        expect(sex.s).toHaveLength(table.count)
      }
    }
  })

  it("semua nilai berupa angka berhingga; M dan S positif", () => {
    for (const table of [refs.wfa, refs.lhfa, refs.bfa, refs.wfl, refs.wfh]) {
      for (const sex of [table.male, table.female]) {
        for (let i = 0; i < table.count; i++) {
          expect(Number.isFinite(sex.l[i])).toBe(true)
          expect(sex.m[i]).toBeGreaterThan(0)
          expect(sex.s[i]).toBeGreaterThan(0)
        }
      }
    }
  })

  it("median panjang/tinggi naik terhadap umur/tinggi (tidak ada baris tertukar)", () => {
    // BB/U sengaja tidak diperiksa: median berat lahir WHO memang turun beberapa hari
    // pertama (hari 0: 3,3464 kg; hari 1: 3,3174 kg).
    for (const table of [refs.lhfa, refs.wfl, refs.wfh]) {
      for (const sex of [table.male, table.female]) {
        for (let i = 1; i < table.count; i++) {
          // TB/U turun tepat di hari 731 (lihat tes berikutnya); selebihnya selalu naik.
          if (table === refs.lhfa && i === 731) continue
          expect(sex.m[i]).toBeGreaterThanOrEqual(sex.m[i - 1])
        }
      }
    }
  })

  it("L = 1 di seluruh tabel TB/U, sehingga rumus biasa dan penyesuaian WHO identik untuk TB/U", () => {
    // Dengan L = 1, kurva SD bersifat linear dalam z, jadi ekstrapolasi di luar ±3 SD sama
    // persis dengan rumus biasa. Itu sebabnya WHO memakai rumus biasa untuk TB/U tanpa
    // kehilangan apa pun, dan menukarnya tidak mengubah hasil.
    for (const sex of [refs.lhfa.male, refs.lhfa.female]) {
      expect(sex.l.every((l) => l === 1)).toBe(true)
    }
  })

  it("TB/U turun sekitar 0,7 cm di hari 731: pergantian kurva panjang → tinggi", () => {
    // WHO beralih dari panjang telentang ke tinggi berdiri pada umur 2 tahun. Selisih ini
    // adalah alasan koreksi ±0,7 cm dan batas 731 hari pada mesin antropometri.
    for (const sex of [refs.lhfa.male, refs.lhfa.female]) {
      const drop = sex.m[730] - sex.m[731]
      expect(drop).toBeGreaterThan(0.5)
      expect(drop).toBeLessThan(0.9)
    }
  })

  it("median BB/U dan IMT/U pada 5 tahun jauh di atas saat lahir (arah umum benar)", () => {
    for (const table of [refs.wfa, refs.bfa]) {
      for (const sex of [table.male, table.female]) {
        expect(sex.m[1856]).toBeGreaterThan(sex.m[0])
      }
    }
  })

  it("rentang kunci sesuai dokumentasi WHO", () => {
    expect([refs.wfa.start, refs.wfa.count - 1]).toEqual([0, 1856])
    expect([
      refs.wfl.start,
      refs.wfl.start + (refs.wfl.count - 1) * refs.wfl.step,
    ]).toEqual([45, 110])
    expect(refs.wfh.start + (refs.wfh.count - 1) * refs.wfh.step).toBeCloseTo(
      120,
      9
    )
    expect(refs.wfh.start).toBe(65)
  })

  it("metadata mencatat sumber resmi, hash, dan tanggal unduh untuk 10 berkas", () => {
    const { sources, retrievedAt, standard } = refs.metadata
    expect(standard).toBe("WHO Child Growth Standards 2006")
    expect(retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(sources).toHaveLength(10)
    for (const source of sources) {
      expect(source.url).toMatch(
        /^https:\/\/cdn\.who\.int\/media\/docs\/default-source\/child-growth\//
      )
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(source.bytes).toBeGreaterThan(10_000)
    }
    expect(new Set(sources.map((s) => `${s.indicator}-${s.sex}`)).size).toBe(10)
  })
})

describe("tabel referensi WHO 2006 — cocok dengan baris yang diterbitkan WHO", () => {
  it.each(PUBLISHED.map((row) => [row.label, row] as const))(
    "%s",
    (_label, row) => {
      const found = lookup(row)
      expect(found).not.toBeNull()
      expect(found!.l).toBeCloseTo(row.lms[0], 10)
      expect(found!.m).toBeCloseTo(row.lms[1], 10)
      expect(found!.s).toBeCloseTo(row.lms[2], 10)
    }
  )

  it("TB/U laki-laki umur 44 hari = L 1, M 56,4833, S 0,03492 (nilai uji WHO Anthro)", () => {
    expect(lookupByAgeDays(refs.lhfa, "M", 44)).toEqual({
      l: 1,
      m: 56.4833,
      s: 0.03492,
    })
  })
})

describe("rumus + tabel menghasilkan z-score yang sama dengan SD yang diterbitkan WHO", () => {
  const isWeightBased = (table: PublishedRow["table"]) => table !== "lhfa"

  it.each(PUBLISHED.map((row) => [row.label, row] as const))(
    "%s",
    (_label, row) => {
      const lms = lookup(row)!
      SD_LEVELS.forEach((k, i) => {
        const y = row.sd[i]
        // Indikator berbasis berat memakai penyesuaian di luar ±3 SD; TB/U memakai rumus biasa.
        const z = isWeightBased(row.table)
          ? lmsZScoreAdjusted(y, lms)
          : lmsZScore(y, lms)
        // SD diterbitkan dengan 3 desimal, sehingga z-score akurat sampai sekitar 0,005.
        expect(z, `${row.label}: SD${k}`).toBeCloseTo(k, 2)
      })
    }
  )

  it("penyesuaian ±4 SD memang diperlukan: rumus biasa meleset jauh di SD+4 BB/U", () => {
    const row = PUBLISHED[0]
    const lms = lookup(row)!
    const y = row.sd[8]
    expect(Math.abs(lmsZScore(y, lms) - 4)).toBeGreaterThan(0.05)
    expect(Math.abs(lmsZScoreAdjusted(y, lms) - 4)).toBeLessThan(0.01)
  })
})

describe("interpolasi menurut panjang/tinggi (BB/PB dan BB/TB)", () => {
  const rowAt = (cm: number) => lookupByLengthHeight(refs.wfh, "M", cm)!

  it("tepat pada tinggi tabel memberi baris tabel itu sendiri", () => {
    expect(rowAt(65)).toEqual({ l: -0.3521, m: 7.4327, s: 0.08217 })
    expect(rowAt(65.1)).toEqual({ l: -0.3521, m: 7.4563, s: 0.08216 })
  })

  it("di antara dua baris diinterpolasi linear", () => {
    const low = rowAt(65)
    const upp = rowAt(65.1)
    const mid = rowAt(65.05)
    expect(mid.m).toBeCloseTo((low.m + upp.m) / 2, 6)
    expect(mid.s).toBeCloseTo((low.s + upp.s) / 2, 8)
  })

  it("interpolasi seperempat jalan memberi bobot 0,25", () => {
    const low = rowAt(65)
    const upp = rowAt(65.1)
    expect(rowAt(65.025).m).toBeCloseTo(low.m + 0.25 * (upp.m - low.m), 6)
  })

  it("di luar tabel tidak menghasilkan nilai", () => {
    expect(lookupByLengthHeight(refs.wfh, "M", 64.9)).toBeNull()
    expect(lookupByLengthHeight(refs.wfh, "M", 120.1)).toBeNull()
    expect(lookupByLengthHeight(refs.wfl, "F", 44.9)).toBeNull()
  })

  it("batas atas tabel (tinggi tepat 120 cm) tidak butuh baris di atasnya", () => {
    expect(lookupByLengthHeight(refs.wfh, "F", 120)).not.toBeNull()
  })
})

describe("lookupByAgeDays", () => {
  it("menolak umur di luar tabel dan umur non-bulat", () => {
    expect(lookupByAgeDays(refs.wfa, "M", -1)).toBeNull()
    expect(lookupByAgeDays(refs.wfa, "M", 1857)).toBeNull()
    expect(lookupByAgeDays(refs.wfa, "M", 10.5)).toBeNull()
    expect(lookupByAgeDays(refs.wfa, "M", 0)).not.toBeNull()
    expect(lookupByAgeDays(refs.wfa, "M", 1856)).not.toBeNull()
  })

  it("memisahkan laki-laki dan perempuan", () => {
    expect(lookupByAgeDays(refs.wfa, "M", 0)!.m).not.toBe(
      lookupByAgeDays(refs.wfa, "F", 0)!.m
    )
  })
})
