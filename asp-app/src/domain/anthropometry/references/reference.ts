import type { Sex } from "@/domain/child/child.types"

import type { Lms } from "../lms"

export type LmsColumns = { l: number[]; m: number[]; s: number[] }

/** Satu tabel indikator (kedua jenis kelamin) seperti dihasilkan scripts/import-who-tables.mjs. */
export type LmsTable = {
  indicator: string
  /** Kolom kunci: umur dalam hari (`ageDays`) atau panjang/tinggi dalam cm. */
  keyName: "ageDays" | "lengthCm" | "heightCm"
  start: number
  step: number
  count: number
  male: LmsColumns
  female: LmsColumns
}

export type ReferenceSource = {
  indicator: string
  sex: "male" | "female"
  url: string
  sha256: string
  bytes: number
}

export type ReferenceMetadata = {
  standard: string
  retrievedAt: string
  sources: ReferenceSource[]
}

/** Seluruh tabel yang dibutuhkan mesin: BB/U, TB/U, IMT/U, BB/PB, BB/TB. */
export type ReferenceSet = {
  wfa: LmsTable
  lhfa: LmsTable
  bfa: LmsTable
  wfl: LmsTable
  wfh: LmsTable
  metadata: ReferenceMetadata
}

function rowAt(table: LmsTable, sex: Sex, index: number): Lms | null {
  if (!Number.isInteger(index) || index < 0 || index >= table.count) return null
  const columns = sex === "M" ? table.male : table.female
  return { l: columns.l[index], m: columns.m[index], s: columns.s[index] }
}

/** Parameter LMS pada umur (hari bulat). Null jika di luar tabel. */
export function lookupByAgeDays(
  table: LmsTable,
  sex: Sex,
  ageDays: number
): Lms | null {
  return rowAt(table, sex, ageDays - table.start)
}

/**
 * Parameter LMS menurut panjang/tinggi (cm) dengan interpolasi linear antar baris 0,1 cm,
 * mengikuti perilaku WHO Anthro:
 *   bawah = trunc(h * 10) / 10,  atas = trunc(h * 10 + 1) / 10,  bobot = (h - bawah) / 0,1.
 * Bila bobot > 0, L, M, dan S masing-masing diinterpolasi. Null jika baris yang dibutuhkan
 * tidak ada di tabel.
 */
export function lookupByLengthHeight(
  table: LmsTable,
  sex: Sex,
  cm: number
): Lms | null {
  const low = Math.trunc(cm * 10) / 10
  const upp = Math.trunc(cm * 10 + 1) / 10
  const weight = (cm - low) / 0.1

  const indexOf = (value: number) =>
    Math.round((value - table.start) / table.step)
  const lower = rowAt(table, sex, indexOf(low))
  if (!lower) return null
  if (!(weight > 0)) return lower

  const upper = rowAt(table, sex, indexOf(upp))
  if (!upper) return null
  return {
    l: lower.l + weight * (upper.l - lower.l),
    m: lower.m + weight * (upper.m - lower.m),
    s: lower.s + weight * (upper.s - lower.s),
  }
}

export function describeReferenceVersion(metadata: ReferenceMetadata): string {
  return `WHO-2006 expanded tables (diunduh ${metadata.retrievedAt})`
}
