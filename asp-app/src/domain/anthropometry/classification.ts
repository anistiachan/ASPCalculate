/**
 * Klasifikasi status gizi anak 0–60 bulan menurut Permenkes RI No. 2 Tahun 2020
 * tentang Standar Antropometri Anak (docs/OPENASP-SPESIFIKASI-ANTROPOMETRI-v0.1.md, bagian 6).
 *
 * Masukan adalah z-score yang sudah dibulatkan 2 desimal (seperti keluaran WHO Anthro).
 * Batas: "sampai dengan" bersifat inklusif, "lebih dari" eksklusif, sehingga tidak ada celah
 * maupun tumpang tindih. Label lama workbook ASP ("S.Pendek", "BB Lbh", dst.) sengaja tidak
 * dipakai karena batasnya berbeda dari Permenkes.
 */

export type WeightForAgeCategory =
  "BB_SANGAT_KURANG" | "BB_KURANG" | "BB_NORMAL" | "BB_RISIKO_LEBIH"

export type HeightForAgeCategory =
  "SANGAT_PENDEK" | "PENDEK" | "TB_NORMAL" | "TINGGI"

/** Dipakai bersama oleh BB/PB-TB dan IMT/U. */
export type NutritionalStatusCategory =
  | "GIZI_BURUK"
  | "GIZI_KURANG"
  | "GIZI_BAIK"
  | "BERISIKO_GIZI_LEBIH"
  | "GIZI_LEBIH"
  | "OBESITAS"

export type NutritionCategory =
  WeightForAgeCategory | HeightForAgeCategory | NutritionalStatusCategory

/** BB/U: < -3 sangat kurang; -3..<-2 kurang; -2..+1 normal; > +1 risiko berat badan lebih. */
export function classifyWeightForAge(z: number): WeightForAgeCategory {
  if (z < -3) return "BB_SANGAT_KURANG"
  if (z < -2) return "BB_KURANG"
  if (z <= 1) return "BB_NORMAL"
  return "BB_RISIKO_LEBIH"
}

/** TB/U atau PB/U: < -3 sangat pendek; -3..<-2 pendek; -2..+3 normal; > +3 tinggi. */
export function classifyHeightForAge(z: number): HeightForAgeCategory {
  if (z < -3) return "SANGAT_PENDEK"
  if (z < -2) return "PENDEK"
  if (z <= 3) return "TB_NORMAL"
  return "TINGGI"
}

/**
 * BB/PB atau BB/TB, dan IMT/U: < -3 gizi buruk; -3..<-2 gizi kurang; -2..+1 gizi baik;
 * >+1..+2 berisiko gizi lebih; >+2..+3 gizi lebih; > +3 obesitas.
 */
export function classifyNutritionalStatus(
  z: number
): NutritionalStatusCategory {
  if (z < -3) return "GIZI_BURUK"
  if (z < -2) return "GIZI_KURANG"
  if (z <= 1) return "GIZI_BAIK"
  if (z <= 2) return "BERISIKO_GIZI_LEBIH"
  if (z <= 3) return "GIZI_LEBIH"
  return "OBESITAS"
}

/** Istilah resmi Permenkes untuk tampilan. */
export const CATEGORY_LABELS: Record<NutritionCategory, string> = {
  BB_SANGAT_KURANG: "Berat badan sangat kurang",
  BB_KURANG: "Berat badan kurang",
  BB_NORMAL: "Berat badan normal",
  BB_RISIKO_LEBIH: "Risiko berat badan lebih",
  SANGAT_PENDEK: "Sangat pendek",
  PENDEK: "Pendek",
  TB_NORMAL: "Normal",
  TINGGI: "Tinggi",
  GIZI_BURUK: "Gizi buruk",
  GIZI_KURANG: "Gizi kurang",
  GIZI_BAIK: "Gizi baik",
  BERISIKO_GIZI_LEBIH: "Berisiko gizi lebih",
  GIZI_LEBIH: "Gizi lebih",
  OBESITAS: "Obesitas",
}

/** Tingkat perhatian untuk pewarnaan; makna selalu ikut di label teks. */
export type CategorySeverity = "ok" | "watch" | "alert"

export const CATEGORY_SEVERITY: Record<NutritionCategory, CategorySeverity> = {
  BB_SANGAT_KURANG: "alert",
  BB_KURANG: "watch",
  BB_NORMAL: "ok",
  BB_RISIKO_LEBIH: "watch",
  SANGAT_PENDEK: "alert",
  PENDEK: "watch",
  TB_NORMAL: "ok",
  // Setinggi ini hampir selalu layak diperiksa ulang pengukurannya.
  TINGGI: "watch",
  GIZI_BURUK: "alert",
  GIZI_KURANG: "watch",
  GIZI_BAIK: "ok",
  BERISIKO_GIZI_LEBIH: "watch",
  GIZI_LEBIH: "watch",
  OBESITAS: "alert",
}
