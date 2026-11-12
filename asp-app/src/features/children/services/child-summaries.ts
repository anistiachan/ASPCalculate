import type { Sex } from "@/domain/child/child.types"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { completedMonths } from "@/lib/date/completed-months"

/** Satu baris pada daftar balita. NIK tidak dibawa; hanya 4 digit terakhir. */
export type ChildSummary = {
  id: string
  name: string
  sex: Sex
  birthDate: string
  /** Bulan penuh per hari ini, hanya untuk tampilan. */
  ageMonths: number | null
  /** 4 digit terakhir NIK untuk membedakan nama yang sama; null jika tanpa NIK. */
  nikLast4: string | null
  lastMeasuredAt: string | null
  measurementCount: number
}

export function buildChildSummaries(
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[],
  today: string
): ChildSummary[] {
  const stats = new Map<string, { last: string; count: number }>()
  for (const measurement of measurements) {
    const current = stats.get(measurement.childId)
    if (!current) {
      stats.set(measurement.childId, { last: measurement.measuredAt, count: 1 })
    } else {
      current.count++
      if (measurement.measuredAt > current.last) {
        current.last = measurement.measuredAt
      }
    }
  }

  return children
    .map((child) => {
      const stat = stats.get(child.id)
      return {
        id: child.id,
        name: child.name,
        sex: child.sex,
        birthDate: child.birthDate,
        ageMonths: completedMonths(child.birthDate, today),
        nikLast4: child.sourceKey ? child.sourceKey.slice(-4) : null,
        lastMeasuredAt: stat?.last ?? null,
        measurementCount: stat?.count ?? 0,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, "id"))
}

// --- Pencarian dan filter ----------------------------------------------------

export type SexFilter = "all" | Sex

/** Kelompok umur untuk filter. "outside" = di luar 0–59 bulan atau umur tidak diketahui. */
export type AgeGroup = "all" | "0-5" | "6-11" | "12-23" | "24-59" | "outside"

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  all: "Semua umur",
  "0-5": "0–5 bln",
  "6-11": "6–11 bln",
  "12-23": "12–23 bln",
  "24-59": "24–59 bln",
  outside: "Di luar 0–59 bln",
}

export function matchesAgeGroup(
  ageMonths: number | null,
  group: AgeGroup
): boolean {
  if (group === "all") return true
  if (ageMonths === null || ageMonths < 0 || ageMonths > 59) {
    return group === "outside"
  }
  switch (group) {
    case "0-5":
      return ageMonths <= 5
    case "6-11":
      return ageMonths >= 6 && ageMonths <= 11
    case "12-23":
      return ageMonths >= 12 && ageMonths <= 23
    case "24-59":
      return ageMonths >= 24
    case "outside":
      return false
  }
}

/** Huruf kecil dan tanpa tanda diakritik, agar "Siti" dan "síti" dianggap sama. */
function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

export type ChildFilter = {
  query: string
  sex: SexFilter
  ageGroup: AgeGroup
}

/**
 * Pencarian: potongan nama (tanpa peka huruf besar/kecil dan diakritik), atau tepat
 * 4 digit terakhir NIK. NIK penuh tidak pernah dicari atau ditampilkan di daftar.
 */
export function filterChildren(
  rows: readonly ChildSummary[],
  filter: ChildFilter
): ChildSummary[] {
  const query = normalizeText(filter.query)
  const isNikSuffix = /^\d{4}$/.test(query)

  return rows.filter((row) => {
    if (filter.sex !== "all" && row.sex !== filter.sex) return false
    if (!matchesAgeGroup(row.ageMonths, filter.ageGroup)) return false
    if (query === "") return true
    if (isNikSuffix && row.nikLast4 === query) return true
    return normalizeText(row.name).includes(query)
  })
}
