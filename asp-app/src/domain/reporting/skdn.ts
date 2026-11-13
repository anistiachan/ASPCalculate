import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"

import {
  addMonths,
  bump,
  emptyCounts,
  monthKeyOf,
  type MonthKey,
  type SexCounts,
} from "./monthly-recap"
import { minimumWeightGainKg } from "./skdn-thresholds"

/*
 * SKDN DRAF. Aturan di bawah meniru rumus per anak pada sheet P1 workbook ASP Karangtawar
 * 2025 (lihat docs/OPENASP-MAPPING-SKDN-v0.2.md), BUKAN pedoman resmi, dan belum disetujui
 * pemilik proses/Bidan. Semua angka harus ditampilkan sebagai draf.
 *
 * S (sasaran) tidak ada dalam rumus yang dibaca, jadi sengaja tidak dihitung dan tidak
 * disamakan dengan K. Rekap per Posyandu belum ada karena data belum memuat Posyandu.
 */

/**
 * Anak dihitung dalam K selama umur (selisih bulan KALENDER dari bulan lahir) kurang dari
 * angka ini. Rumus workbook memakai `< 61` walau labelnya "0–59 bln"; dipakai apa adanya agar
 * hasilnya sebanding dengan workbook. Perlu dikonfirmasi ke Bidan.
 */
export const SKDN_MAX_AGE_EXCLUSIVE = 61

/** Batas umur baduta: D2 = 0–23 bulan, D25 = 24–59 bulan (label workbook). */
export const SKDN_BADUTA_MAX_AGE = 23

export type SkdnCode = "K" | "D2" | "D25" | "D" | "N" | "T" | "O" | "B" | "T2"

export const SKDN_CODES: readonly SkdnCode[] = [
  "K",
  "D2",
  "D25",
  "D",
  "N",
  "T",
  "O",
  "B",
  "T2",
]

/** Label tampilan; kode `T2` ditulis "2T" di workbook. */
export const SKDN_LABELS: Record<SkdnCode, { code: string; label: string }> = {
  K: { code: "K", label: "Balita yang sudah pernah ditimbang (0–59 bulan)" },
  D2: { code: "D2", label: "Baduta (0–23 bulan) yang ditimbang" },
  D25: { code: "D25", label: "Balita (24–59 bulan) yang ditimbang" },
  D: { code: "D", label: "Balita yang ditimbang" },
  N: { code: "N", label: "Balita yang naik berat badannya" },
  T: { code: "T", label: "Balita yang tidak naik berat badannya" },
  O: { code: "O", label: "Balita yang bulan lalu tidak menimbang" },
  B: { code: "B", label: "Balita yang baru pertama kali ditimbang" },
  T2: { code: "2T", label: "Balita yang 2 kali berturut-turut tidak naik" },
}

export type SkdnMonthly = {
  month: MonthKey
  counts: Record<SkdnCode, SexCounts>
}

/** Umur dalam bulan KALENDER pada bulan laporan (workbook: selisih bulan, bukan bulan penuh). */
export function calendarAgeMonths(birthDate: string, month: MonthKey): number {
  const [by, bm] = birthDate.slice(0, 7).split("-").map(Number)
  const [y, m] = month.split("-").map(Number)
  return (y - by) * 12 + (m - bm)
}

/** Pembulatan 1 desimal seperti ROUND Excel (setengah menjauhi nol). */
const round1 = (value: number): number =>
  (Math.sign(value) * Math.round(Math.abs(value) * 10 + 1e-9)) / 10

/** Berat per bulan: pengukuran terakhir bulan itu yang berisi berat. */
function weightsByMonth(
  measurements: readonly StoredMeasurement[]
): Map<MonthKey, number> {
  const latest = new Map<MonthKey, { at: string; kg: number }>()
  for (const m of measurements) {
    if (m.weightKg === null) continue
    const month = monthKeyOf(m.measuredAt)
    const current = latest.get(month)
    if (!current || m.measuredAt >= current.at) {
      latest.set(month, { at: m.measuredAt, kg: m.weightKg })
    }
  }
  return new Map([...latest].map(([month, v]) => [month, v.kg]))
}

type Timeline = {
  weights: Map<MonthKey, number>
  firstWeighed: MonthKey | null
}

function timelineOf(measurements: readonly StoredMeasurement[]): Timeline {
  const weights = weightsByMonth(measurements)
  const months = [...weights.keys()].sort()
  return { weights, firstWeighed: months[0] ?? null }
}

/** N: ditimbang bulan ini dan bulan lalu, umur < batas, kenaikan >= minimal menurut umur. */
function isGained(
  child: StoredChild,
  line: Timeline,
  month: MonthKey
): boolean {
  const current = line.weights.get(month)
  const previous = line.weights.get(addMonths(month, -1))
  if (current === undefined || previous === undefined) return false
  const age = calendarAgeMonths(child.birthDate, month)
  if (age >= SKDN_MAX_AGE_EXCLUSIVE) return false
  return round1(current - previous) >= minimumWeightGainKg(age, child.sex)
}

/** T: ditimbang bulan ini dan bulan lalu, tetapi tidak N. */
function isNotGained(
  child: StoredChild,
  line: Timeline,
  month: MonthKey
): boolean {
  return (
    line.weights.has(month) &&
    line.weights.has(addMonths(month, -1)) &&
    !isGained(child, line, month)
  )
}

export type SkdnChildFlags = Record<SkdnCode, boolean>

export type SkdnOptions = {
  /**
   * Mode kesetaraan dengan workbook ASP Karangtawar untuk PEMBANDINGAN. Di workbook,
   * kolom isian "Bulan Pertama Timbang" (Z) kosong, sehingga: K menghitung setiap anak yang
   * pernah punya berat badan (kapan pun) selama umur < batas, B selalu 0, dan O mencakup anak
   * yang pertama kali ditimbang. Bawaan (false) memakai bulan pertama ditimbang dari riwayat,
   * yaitu maksud kolom itu.
   */
  workbookParity?: boolean
}

/** Klasifikasi satu anak pada satu bulan. Dipisah agar tiap aturan bisa diuji dan ditelusuri. */
export function classifyChild(
  child: StoredChild,
  measurements: readonly StoredMeasurement[],
  month: MonthKey,
  options: SkdnOptions = {}
): SkdnChildFlags {
  const line = timelineOf(measurements)
  const age = calendarAgeMonths(child.birthDate, month)
  const weighed = line.weights.has(month)
  const weighedLastMonth = line.weights.has(addMonths(month, -1))
  const isFirst = line.firstWeighed === month
  const inScope = age >= 0 && age < SKDN_MAX_AGE_EXCLUSIVE
  const parity = options.workbookParity === true

  const k = parity
    ? age < SKDN_MAX_AGE_EXCLUSIVE && line.weights.size > 0
    : inScope && line.firstWeighed !== null && line.firstWeighed <= month
  // D tidak dibatasi umur di workbook (hanya N yang berhenti pada batas umur).
  const d = weighed
  const t = d && isNotGained(child, line, month)

  return {
    K: k,
    D: d,
    D2: d && age <= SKDN_BADUTA_MAX_AGE,
    D25: d && age > SKDN_BADUTA_MAX_AGE,
    N: d && isGained(child, line, month),
    T: t,
    B: !parity && inScope && isFirst,
    // Ditimbang bulan ini, bukan bulan pertama, dan bulan lalu tidak ditimbang.
    O: d && (parity || !isFirst) && !weighedLastMonth,
    T2: t && isNotGained(child, line, addMonths(month, -1)),
  }
}

export function buildSkdn(
  month: MonthKey,
  children: readonly StoredChild[],
  byChild: ReadonlyMap<string, StoredMeasurement[]>,
  options: SkdnOptions = {}
): SkdnMonthly {
  const counts = Object.fromEntries(
    SKDN_CODES.map((code) => [code, emptyCounts()])
  ) as Record<SkdnCode, SexCounts>

  for (const child of children) {
    const flags = classifyChild(
      child,
      byChild.get(child.id) ?? [],
      month,
      options
    )
    for (const code of SKDN_CODES) {
      if (flags[code]) bump(counts[code], child.sex)
    }
  }
  return { month, counts }
}
