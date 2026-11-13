import type { NutritionCategory } from "@/domain/anthropometry/classification"

/** Indikator status gizi yang direkap. */
export type StatusIndicator = "waz" | "haz" | "whz" | "baz"

export const STATUS_INDICATORS: readonly StatusIndicator[] = [
  "waz",
  "haz",
  "whz",
  "baz",
]

export const INDICATOR_NAMES: Record<
  StatusIndicator,
  { short: string; full: string }
> = {
  waz: { short: "BB/U", full: "Berat badan menurut umur" },
  haz: { short: "TB/U", full: "Panjang/tinggi badan menurut umur" },
  whz: { short: "BB/PB-TB", full: "Berat badan menurut panjang/tinggi badan" },
  baz: { short: "IMT/U", full: "Indeks massa tubuh menurut umur" },
}

/**
 * Kategori tiap indikator, berurutan dari kekurangan ke kelebihan. Urutan ini dipakai
 * untuk baris tabel dan segmen batang, sehingga posisi menunjukkan arah.
 */
export const INDICATOR_CATEGORIES: Record<
  StatusIndicator,
  readonly NutritionCategory[]
> = {
  waz: ["BB_SANGAT_KURANG", "BB_KURANG", "BB_NORMAL", "BB_RISIKO_LEBIH"],
  haz: ["SANGAT_PENDEK", "PENDEK", "TB_NORMAL", "TINGGI"],
  whz: [
    "GIZI_BURUK",
    "GIZI_KURANG",
    "GIZI_BAIK",
    "BERISIKO_GIZI_LEBIH",
    "GIZI_LEBIH",
    "OBESITAS",
  ],
  baz: [
    "GIZI_BURUK",
    "GIZI_KURANG",
    "GIZI_BAIK",
    "BERISIKO_GIZI_LEBIH",
    "GIZI_LEBIH",
    "OBESITAS",
  ],
}

/**
 * Letak kategori pada skala berpolaritas: di bawah normal, normal, atau di atas normal.
 * Dipakai untuk batang diverging (biru ← abu-abu → oranye). Polaritas dipilih, bukan
 * "baik/buruk", karena warna hijau-kuning-merah gagal uji buta warna (lihat skill dataviz).
 */
export type StatusGroup = "UNDER" | "NORMAL" | "OVER"

export const GROUP_OF: Record<NutritionCategory, StatusGroup> = {
  BB_SANGAT_KURANG: "UNDER",
  BB_KURANG: "UNDER",
  BB_NORMAL: "NORMAL",
  BB_RISIKO_LEBIH: "OVER",
  SANGAT_PENDEK: "UNDER",
  PENDEK: "UNDER",
  TB_NORMAL: "NORMAL",
  TINGGI: "OVER",
  GIZI_BURUK: "UNDER",
  GIZI_KURANG: "UNDER",
  GIZI_BAIK: "NORMAL",
  BERISIKO_GIZI_LEBIH: "OVER",
  GIZI_LEBIH: "OVER",
  OBESITAS: "OVER",
}

export const GROUP_ORDER: readonly StatusGroup[] = ["UNDER", "NORMAL", "OVER"]

/** Nama kelompok per indikator, memakai istilah yang lazim di lapangan. */
export const GROUP_LABELS: Record<
  StatusIndicator,
  Record<StatusGroup, string>
> = {
  waz: { UNDER: "Kurang", NORMAL: "Normal", OVER: "Risiko lebih" },
  haz: { UNDER: "Pendek", NORMAL: "Normal", OVER: "Tinggi" },
  whz: { UNDER: "Kurang", NORMAL: "Baik", OVER: "Lebih" },
  baz: { UNDER: "Kurang", NORMAL: "Baik", OVER: "Lebih" },
}
