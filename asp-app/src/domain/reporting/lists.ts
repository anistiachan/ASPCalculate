import type {
  HeightForAgeCategory,
  NutritionalStatusCategory,
  NutritionCategory,
  WeightForAgeCategory,
} from "@/domain/anthropometry/classification"
import type { AnthropometryResult } from "@/domain/anthropometry/compute"
import type { Sex } from "@/domain/child/child.types"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import {
  indexMeasurementsByChild,
  isEligibleInMonth,
  monthKeyOf,
  type MonthKey,
} from "./monthly-recap"
import { calendarAgeMonths } from "./skdn"

/*
 * Daftar keluaran menu workbook ASP Karangtawar (Pendek, Sangat Pendek, BBK, BGM, Kurus,
 * Sangat Kurus, Gemuk, Calon Balita Kurus, Balita Bermasalah, serta sasaran Vitamin A dan ASI).
 *
 * Status gizi dihitung mesin WHO 2006 + Permenkes 2/2020, BUKAN tabel acuan sheet PSG (Dinkes Jatim) milik
 * workbook, sehingga anggota daftar bisa berbeda tipis dari workbook di dekat batas. Istilah
 * menu workbook dipertahankan sebagai judul, dipetakan ke kategori Permenkes (lihat
 * STATUS_LIST_DEFS). Hasil belum divalidasi tenaga kesehatan.
 */

export type StatusListId =
  | "BERMASALAH"
  | "SANGAT_PENDEK"
  | "PENDEK"
  | "BGM"
  | "BBK"
  | "SANGAT_KURUS"
  | "KURUS"
  | "GEMUK"
  | "CALON_KURUS"

export type StatusListDef = {
  id: StatusListId
  title: string
  /** Definisi yang ditampilkan kepada pengguna. */
  definition: string
}

/** Batas "calon balita kurus" pada workbook: BB/TB di antara −2 (inklusif) dan −1,8 (eksklusif). */
export const CALON_KURUS_MIN_Z = -2
export const CALON_KURUS_MAX_Z = -1.8

export const STATUS_LIST_DEFS: readonly StatusListDef[] = [
  {
    id: "BERMASALAH",
    title: "Balita bermasalah",
    definition:
      "Sangat pendek, pendek, BGM, kurus, sangat kurus, gemuk, atau calon balita kurus. Berat badan kurang (BBK) tidak termasuk, seperti pada workbook.",
  },
  {
    id: "SANGAT_PENDEK",
    title: "Sangat pendek",
    definition: "TB/U kurang dari −3 SD (sangat pendek).",
  },
  {
    id: "PENDEK",
    title: "Pendek",
    definition: "TB/U −3 SD sampai kurang dari −2 SD (pendek).",
  },
  {
    id: "BGM",
    title: "BGM",
    definition:
      "BB/U kurang dari −3 SD (berat badan sangat kurang), padanan istilah bawah garis merah.",
  },
  {
    id: "BBK",
    title: "BBK",
    definition: "BB/U −3 SD sampai kurang dari −2 SD (berat badan kurang).",
  },
  {
    id: "SANGAT_KURUS",
    title: "Sangat kurus",
    definition: "BB/PB-TB kurang dari −3 SD (gizi buruk).",
  },
  {
    id: "KURUS",
    title: "Kurus",
    definition: "BB/PB-TB −3 SD sampai kurang dari −2 SD (gizi kurang).",
  },
  {
    id: "GEMUK",
    title: "Gemuk",
    definition:
      "BB/PB-TB lebih dari +2 SD (gizi lebih dan obesitas). Berisiko gizi lebih (+1 sampai +2 SD) tidak termasuk.",
  },
  {
    id: "CALON_KURUS",
    title: "Calon balita kurus",
    definition:
      "BB/PB-TB −2 SD sampai kurang dari −1,8 SD, ambang bantu milik workbook (bukan kategori Permenkes).",
  },
]

export type ListedChild = {
  childId: string
  name: string
  sex: Sex
  /** Dipakai format PSG (kolom Tgl.Lahir); tidak ditampilkan di tabel layar. */
  birthDate: string
  posyandu: string | null
  measuredAt: string
  /** Umur dalam bulan penuh pada tanggal ukur. */
  ageMonths: number | null
  weightKg: number | null
  heightCm: number | null
  waz: number | null
  haz: number | null
  whz: number | null
  wazCategory: WeightForAgeCategory | null
  hazCategory: HeightForAgeCategory | null
  whzCategory: NutritionalStatusCategory | null
}

export type StatusLists = {
  month: MonthKey
  /** Balita terdata yang punya pengukuran bulan itu. */
  measured: number
  /** Semua anak yang diukur bulan itu dan statusnya terhitung (dasar format PSG). */
  all: ListedChild[]
  lists: Record<StatusListId, ListedChild[]>
}

/** Kategori yang dianggap normal; selain ini (dan bukan kosong) diberi tahu sebagai tidak normal. */
export const NORMAL_CATEGORIES: ReadonlySet<NutritionCategory> = new Set([
  "TB_NORMAL",
  "BB_NORMAL",
  "GIZI_BAIK",
])

/** Ada setidaknya satu status (TB/U, BB/U, BB/TB) yang bukan normal. */
export function hasAbnormalStatus(
  entry: Pick<ListedChild, "hazCategory" | "wazCategory" | "whzCategory">
): boolean {
  return [entry.hazCategory, entry.wazCategory, entry.whzCategory].some(
    (category) => category !== null && !NORMAL_CATEGORIES.has(category)
  )
}

/** Penanda status satu anak, satu per kolom PDK/S.PDK/BGM/KRS/S.KRS/GMK/CALON/BBK/MSL workbook. */
export type StatusFlags = Record<
  Exclude<StatusListId, "BERMASALAH">,
  boolean
> & {
  BERMASALAH: boolean
}

export function statusFlagsOf(
  entry: Pick<
    ListedChild,
    "hazCategory" | "wazCategory" | "whzCategory" | "whz"
  >
): StatusFlags {
  const flags = {
    SANGAT_PENDEK: entry.hazCategory === "SANGAT_PENDEK",
    PENDEK: entry.hazCategory === "PENDEK",
    BGM: entry.wazCategory === "BB_SANGAT_KURANG",
    BBK: entry.wazCategory === "BB_KURANG",
    SANGAT_KURUS: entry.whzCategory === "GIZI_BURUK",
    KURUS: entry.whzCategory === "GIZI_KURANG",
    GEMUK:
      entry.whzCategory === "GIZI_LEBIH" || entry.whzCategory === "OBESITAS",
    CALON_KURUS:
      entry.whz !== null &&
      entry.whz >= CALON_KURUS_MIN_Z &&
      entry.whz < CALON_KURUS_MAX_Z,
  }
  // BBK tidak termasuk "bermasalah", seperti rumus workbook.
  const BERMASALAH =
    flags.SANGAT_PENDEK ||
    flags.PENDEK ||
    flags.BGM ||
    flags.SANGAT_KURUS ||
    flags.KURUS ||
    flags.GEMUK ||
    flags.CALON_KURUS
  return { ...flags, BERMASALAH }
}

const byPosyanduThenName = (
  a: { posyandu: string | null; name: string },
  b: { posyandu: string | null; name: string }
) =>
  (a.posyandu ?? "").localeCompare(b.posyandu ?? "", "id") ||
  a.name.localeCompare(b.name, "id")

/** Daftar status gizi satu bulan. Seorang anak dihitung sekali (pengukuran terakhir bulan itu). */
export function buildStatusLists(
  month: MonthKey,
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[],
  resultsByMeasurementId: ReadonlyMap<string, AnthropometryResult>
): StatusLists {
  const byChild = indexMeasurementsByChild(measurements)
  const lists = Object.fromEntries(
    STATUS_LIST_DEFS.map((def) => [def.id, [] as ListedChild[]])
  ) as Record<StatusListId, ListedChild[]>
  const all: ListedChild[] = []
  let measured = 0

  for (const child of children) {
    if (!isEligibleInMonth(child, month)) continue
    const chosen = (byChild.get(child.id) ?? [])
      .filter(
        (m) =>
          monthKeyOf(m.measuredAt) === month &&
          (m.weightKg !== null || m.rawLengthHeightCm !== null)
      )
      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0]
    if (!chosen) continue
    measured++

    const result = resultsByMeasurementId.get(chosen.id)
    if (!result) continue

    const entry: ListedChild = {
      childId: child.id,
      name: child.name,
      sex: child.sex,
      birthDate: child.birthDate,
      posyandu: child.posyandu ?? null,
      measuredAt: chosen.measuredAt,
      ageMonths:
        result.ageInMonthsExact === null
          ? null
          : Math.floor(result.ageInMonthsExact),
      weightKg: result.weightKg,
      heightCm: result.correctedLengthHeightCm ?? result.rawLengthHeightCm,
      waz: result.waz,
      haz: result.haz,
      whz: result.whz,
      wazCategory: result.wazCategory,
      hazCategory: result.hazCategory,
      whzCategory: result.whzCategory,
    }

    all.push(entry)
    const flags = statusFlagsOf(entry)
    for (const def of STATUS_LIST_DEFS) {
      if (flags[def.id]) lists[def.id].push(entry)
    }
  }

  for (const list of Object.values(lists)) list.sort(byPosyanduThenName)
  all.sort(byPosyanduThenName)
  return { month, measured, all, lists }
}

// --- Sasaran Vitamin A dan ASI eksklusif ------------------------------------

export type TargetListId = "VITAMIN_A_BIRU" | "VITAMIN_A_MERAH" | "ASI"

export type TargetListDef = {
  id: TargetListId
  title: string
  definition: string
}

/** Rentang umur sasaran (bulan kalender), dari rumus sheet Sasaran workbook. */
export const VITAMIN_A_BLUE_AGE = { min: 6, max: 11 } as const
export const VITAMIN_A_RED_AGE = { min: 12, max: 60 } as const
export const ASI_MAX_AGE = 6

export const TARGET_LIST_DEFS: readonly TargetListDef[] = [
  {
    id: "VITAMIN_A_BIRU",
    title: "Sasaran Vitamin A biru",
    definition:
      "Anak berumur 6–11 bulan. Status: sudah menerima atau belum tercatat.",
  },
  {
    id: "VITAMIN_A_MERAH",
    title: "Sasaran Vitamin A merah",
    definition:
      "Anak berumur 12–60 bulan. Status: sudah menerima atau belum tercatat.",
  },
  {
    id: "ASI",
    title: "Sasaran ASI eksklusif",
    definition:
      "Anak berumur 0–6 bulan. Status: ASI eksklusif ya, tidak, atau belum diisi.",
  },
]

export type TargetStatus = "YES" | "NO" | "UNKNOWN"

export type TargetChild = {
  childId: string
  name: string
  sex: Sex
  posyandu: string | null
  ageMonths: number
  status: TargetStatus
}

export type TargetLists = {
  month: MonthKey
  lists: Record<TargetListId, TargetChild[]>
}

/**
 * Sasaran Vitamin A dan ASI untuk satu bulan. Umur memakai selisih bulan kalender (seperti
 * workbook). Vitamin A: "sudah" bila ada isian ya pada bulan itu; selain itu "belum tercatat"
 * (kosong tidak dianggap "tidak"). ASI: dibaca dari isian pada umur anak (0–6 bulan).
 */
export function buildTargetLists(
  month: MonthKey,
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[]
): TargetLists {
  const byChild = indexMeasurementsByChild(measurements)
  const lists: Record<TargetListId, TargetChild[]> = {
    VITAMIN_A_BIRU: [],
    VITAMIN_A_MERAH: [],
    ASI: [],
  }

  for (const child of children) {
    const age = calendarAgeMonths(child.birthDate, month)
    if (age < 0 || age > VITAMIN_A_RED_AGE.max) continue
    const rows = (byChild.get(child.id) ?? []).filter(
      (m) => monthKeyOf(m.measuredAt) === month
    )
    const base = {
      childId: child.id,
      name: child.name,
      sex: child.sex,
      posyandu: child.posyandu ?? null,
      ageMonths: age,
    }

    const vitaminA: TargetStatus = rows.some((m) => m.vitaminAStatus === true)
      ? "YES"
      : "UNKNOWN"
    if (age >= VITAMIN_A_BLUE_AGE.min && age <= VITAMIN_A_BLUE_AGE.max) {
      lists.VITAMIN_A_BIRU.push({ ...base, status: vitaminA })
    } else if (age >= VITAMIN_A_RED_AGE.min) {
      lists.VITAMIN_A_MERAH.push({ ...base, status: vitaminA })
    }

    if (age <= ASI_MAX_AGE) {
      const values = rows.map((m) => m.breastfeedingByMonth[age] ?? null)
      const asi: TargetStatus = values.includes(true)
        ? "YES"
        : values.includes(false)
          ? "NO"
          : "UNKNOWN"
      lists.ASI.push({ ...base, status: asi })
    }
  }

  for (const list of Object.values(lists)) list.sort(byPosyanduThenName)
  return { month, lists }
}
