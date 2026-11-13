import type { NutritionCategory } from "@/domain/anthropometry/classification"
import type { AnthropometryResult } from "@/domain/anthropometry/compute"
import type { Sex } from "@/domain/child/child.types"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { completedMonths } from "@/lib/date/completed-months"

import { STATUS_INDICATORS, type StatusIndicator } from "./status-groups"

/**
 * Rekap bulanan. Definisi di bawah adalah ASUMSI kerja yang bisa dijelaskan, BUKAN
 * definisi SKDN resmi: definisi S, K, D, N dan indikator program lain belum dikonfirmasi
 * pemilik program (docs/OPENASP-DEFINISI-LAPORAN.md). Karena itu istilah SKDN sengaja
 * tidak dipakai di sini.
 */

/** `YYYY-MM`. */
export type MonthKey = string

export type SexGroup = Sex | "ALL"
export const SEX_GROUPS: readonly SexGroup[] = ["M", "F", "ALL"]

export type SexCounts = Record<SexGroup, number>

export const emptyCounts = (): SexCounts => ({ M: 0, F: 0, ALL: 0 })

export function bump(counts: SexCounts, sex: Sex): void {
  counts[sex]++
  counts.ALL++
}

// --- Bulan -------------------------------------------------------------------

export const monthKeyOf = (iso: string): MonthKey => iso.slice(0, 7)

export const firstDayOfMonth = (month: MonthKey): string => `${month}-01`

export function lastDayOfMonth(month: MonthKey): string {
  const [year, monthNumber] = month.split("-").map(Number)
  // Hari ke-0 bulan berikutnya = hari terakhir bulan ini.
  const day = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return `${month}-${String(day).padStart(2, "0")}`
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [year, monthNumber] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

/** `count` bulan berturut-turut, urut naik, berakhir di `endMonth`. */
export function recentMonths(endMonth: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) =>
    addMonths(endMonth, i - (count - 1))
  )
}

// --- Kelayakan dan indeks ----------------------------------------------------

/** Umur (bulan penuh) saat anak dianggap sudah keluar dari cakupan balita 0–59 bulan. */
const MAX_ELIGIBLE_AGE_MONTHS = 60

/**
 * "Balita terdata" pada suatu bulan: sudah lahir paling lambat di hari terakhir bulan itu,
 * dan pada hari pertama bulan itu belum berumur 60 bulan penuh. Anak yang berulang tahun
 * ke-5 di tengah bulan tetap terhitung bulan itu, sehingga yang ditimbang tidak melebihi
 * yang terdata.
 */
export function isEligibleInMonth(
  child: Pick<StoredChild, "birthDate">,
  month: MonthKey
): boolean {
  if (child.birthDate > lastDayOfMonth(month)) return false
  const age = completedMonths(child.birthDate, firstDayOfMonth(month))
  return age === null || age < MAX_ELIGIBLE_AGE_MONTHS
}

export function indexMeasurementsByChild(
  measurements: readonly StoredMeasurement[]
): Map<string, StoredMeasurement[]> {
  const index = new Map<string, StoredMeasurement[]>()
  for (const measurement of measurements) {
    const list = index.get(measurement.childId)
    if (list) list.push(measurement)
    else index.set(measurement.childId, [measurement])
  }
  return index
}

const inMonth = (measurement: StoredMeasurement, month: MonthKey) =>
  monthKeyOf(measurement.measuredAt) === month

const hasWeight = (m: StoredMeasurement) => m.weightKg !== null
const hasHeight = (m: StoredMeasurement) => m.rawLengthHeightCm !== null

// --- Cakupan penimbangan -----------------------------------------------------

export type MonthlyCoverage = {
  month: MonthKey
  /** Balita terdata (lihat `isEligibleInMonth`). */
  eligible: SexCounts
  /** Balita terdata yang punya minimal satu pengukuran berat pada bulan itu. */
  weighed: SexCounts
  /** Balita terdata yang punya minimal satu pengukuran panjang/tinggi pada bulan itu. */
  heightMeasured: SexCounts
}

export function buildCoverage(
  month: MonthKey,
  children: readonly StoredChild[],
  byChild: ReadonlyMap<string, StoredMeasurement[]>
): MonthlyCoverage {
  const eligible = emptyCounts()
  const weighed = emptyCounts()
  const heightMeasured = emptyCounts()

  for (const child of children) {
    if (!isEligibleInMonth(child, month)) continue
    bump(eligible, child.sex)

    const rows = (byChild.get(child.id) ?? []).filter((m) => inMonth(m, month))
    if (rows.some(hasWeight)) bump(weighed, child.sex)
    if (rows.some(hasHeight)) bump(heightMeasured, child.sex)
  }

  return { month, eligible, weighed, heightMeasured }
}

// --- Rekap lengkap -----------------------------------------------------------

export type IndicatorBreakdown = {
  counts: Partial<Record<NutritionCategory, number>>
  /** Anak yang z-score indikator ini berhasil dihitung. */
  assessed: number
  /** Anak yang diukur tetapi z-score indikator ini tidak dapat dihitung. */
  notAssessed: number
}

export type VitaminACounts = { yes: number; no: number; unknown: number }

export type MonthlyRecap = MonthlyCoverage & {
  /** Balita terdata yang punya pengukuran berat atau panjang/tinggi pada bulan itu. */
  measured: SexCounts
  status: Record<StatusIndicator, Record<SexGroup, IndicatorBreakdown>>
  /** Dari balita terdata yang punya baris pengukuran pada bulan itu. */
  vitaminA: Record<SexGroup, VitaminACounts>
}

const CATEGORY_KEY = {
  waz: "wazCategory",
  haz: "hazCategory",
  whz: "whzCategory",
  baz: "bazCategory",
} as const satisfies Record<StatusIndicator, keyof AnthropometryResult>

function emptyBreakdowns(): Record<SexGroup, IndicatorBreakdown> {
  const make = (): IndicatorBreakdown => ({
    counts: {},
    assessed: 0,
    notAssessed: 0,
  })
  return { M: make(), F: make(), ALL: make() }
}

function emptyVitaminA(): Record<SexGroup, VitaminACounts> {
  const make = (): VitaminACounts => ({ yes: 0, no: 0, unknown: 0 })
  return { M: make(), F: make(), ALL: make() }
}

/**
 * Rekap satu bulan.
 *
 * Asumsi (dapat diubah bila pemilik program menetapkan lain):
 * - Seorang anak dihitung SEKALI per bulan. Bila diukur beberapa kali, status memakai
 *   pengukuran TERAKHIR bulan itu yang berisi berat atau panjang/tinggi.
 * - Hanya balita terdata (`isEligibleInMonth`) yang dihitung.
 * - Vitamin A: "ya" bila ada baris bulan itu bertanda ya; "tidak" bila ada yang bertanda
 *   tidak dan tidak ada yang ya; selain itu "tidak diisi". Arti kolom `vita` di sumber
 *   (jenis kapsul, dosis) belum dikonfirmasi, jadi ini hanya hitungan isian.
 */
export function buildMonthlyRecap(
  month: MonthKey,
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[],
  resultsByMeasurementId: ReadonlyMap<string, AnthropometryResult>
): MonthlyRecap {
  const byChild = indexMeasurementsByChild(measurements)
  const coverage = buildCoverage(month, children, byChild)

  const measured = emptyCounts()
  const vitaminA = emptyVitaminA()
  const status = Object.fromEntries(
    STATUS_INDICATORS.map((indicator) => [indicator, emptyBreakdowns()])
  ) as MonthlyRecap["status"]

  for (const child of children) {
    if (!isEligibleInMonth(child, month)) continue

    const rows = (byChild.get(child.id) ?? []).filter((m) => inMonth(m, month))
    if (rows.length === 0) continue

    // Vitamin A: dari seluruh baris bulan itu.
    const anyYes = rows.some((m) => m.vitaminAStatus === true)
    const anyNo = rows.some((m) => m.vitaminAStatus === false)
    const vita: keyof VitaminACounts = anyYes ? "yes" : anyNo ? "no" : "unknown"
    vitaminA[child.sex][vita]++
    vitaminA.ALL[vita]++

    // Status: pengukuran terakhir yang berisi angka.
    const chosen = rows
      .filter((m) => hasWeight(m) || hasHeight(m))
      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0]
    if (!chosen) continue

    bump(measured, child.sex)
    const result = resultsByMeasurementId.get(chosen.id)

    for (const indicator of STATUS_INDICATORS) {
      const category = result?.[CATEGORY_KEY[indicator]] as
        NutritionCategory | null | undefined

      for (const group of [child.sex, "ALL"] as const) {
        const breakdown = status[indicator][group]
        if (category) {
          breakdown.assessed++
          breakdown.counts[category] = (breakdown.counts[category] ?? 0) + 1
        } else {
          breakdown.notAssessed++
        }
      }
    }
  }

  return { ...coverage, measured, status, vitaminA }
}

// --- Ringkasan dashboard -----------------------------------------------------

export type Overview = {
  totalChildren: number
  /** Balita terdata pada bulan acuan. */
  eligibleThisMonth: number
  weighedThisMonth: number
  /** Anak yang belum punya satu pun pengukuran. */
  neverMeasured: number
}

export function buildOverview(
  month: MonthKey,
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[]
): Overview {
  const byChild = indexMeasurementsByChild(measurements)
  const coverage = buildCoverage(month, children, byChild)
  return {
    totalChildren: children.length,
    eligibleThisMonth: coverage.eligible.ALL,
    weighedThisMonth: coverage.weighed.ALL,
    neverMeasured: children.filter(
      (child) => (byChild.get(child.id)?.length ?? 0) === 0
    ).length,
  }
}

/** Bagian dari keseluruhan (0–1), atau null bila penyebut nol (bukan 0%). */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator
}

/** Seri cakupan beberapa bulan untuk grafik tren (tanpa perlu menghitung status gizi). */
export function buildCoverageSeries(
  months: readonly MonthKey[],
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[]
): MonthlyCoverage[] {
  const byChild = indexMeasurementsByChild(measurements)
  return months.map((month) => buildCoverage(month, children, byChild))
}
