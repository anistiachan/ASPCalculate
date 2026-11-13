import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import type { ReportData } from "../hooks/use-report-data"

/** Nilai pilihan "semua Posyandu". */
/** Nama Posyandu sebagai potongan nama berkas (huruf kecil, tanpa simbol); "" bila semua. */
export const posyanduSlug = (posyandu: string | null): string =>
  posyandu
    ? `-${posyandu
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`
    : ""

export const ALL_POSYANDU = "ALL"

/** Daftar Posyandu yang ada pada data, urut abjad. Kosong bila data tidak memuat Posyandu. */
export function posyanduOptions(children: readonly StoredChild[]): string[] {
  const names = new Set<string>()
  for (const child of children) {
    if (child.posyandu) names.add(child.posyandu)
  }
  return [...names].sort((a, b) => a.localeCompare(b, "id"))
}

/**
 * Menyaring data ke satu Posyandu. Anak tanpa Posyandu (dicatat manual) tidak masuk saringan
 * Posyandu tertentu, tetapi tetap ada pada "semua Posyandu".
 */
export function filterByPosyandu(
  data: ReportData,
  posyandu: string
): ReportData {
  if (posyandu === ALL_POSYANDU) return data
  const children = data.children.filter((child) => child.posyandu === posyandu)
  const ids = new Set(children.map((child) => child.id))
  const measurements: StoredMeasurement[] = data.measurements.filter((m) =>
    ids.has(m.childId)
  )
  return { children, measurements }
}
