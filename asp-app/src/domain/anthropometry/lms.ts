/**
 * Perhitungan z-score metode LMS (Box-Cox) WHO.
 *
 *   Z = ((y / M)^L - 1) / (L * S)        untuk L != 0
 *   Z = ln(y / M) / S                    untuk L == 0
 *
 * Untuk indikator berbasis berat (BB/U, IMT/U, BB/PB-TB), WHO memakai penyesuaian di luar
 * ±3 SD: z-score diekstrapolasi linear dengan jarak SD3–SD2 agar tidak terlalu ekstrem.
 * TB/U memakai rumus biasa sampai ujung. Rujukan: WHO Child Growth Standards, Methods and
 * Development (2006), Bab 7; perilaku dipastikan terhadap tabel WHO yang menerbitkan kolom
 * SD±4 dengan metode ini (lihat scripts/import-who-tables.mjs).
 */

export type Lms = { l: number; m: number; s: number }

/** Nilai pengukuran pada z-score tertentu menurut rumus LMS biasa (tanpa penyesuaian). */
export function valueAtZ(lms: Lms, z: number): number {
  const { l, m, s } = lms
  return l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l)
}

/** Z-score menurut rumus LMS biasa. */
export function lmsZScore(y: number, lms: Lms): number {
  const { l, m, s } = lms
  return l === 0 ? Math.log(y / m) / s : (Math.pow(y / m, l) - 1) / (s * l)
}

/** Z-score dengan penyesuaian WHO di luar ±3 SD (untuk indikator berbasis berat). */
export function lmsZScoreAdjusted(y: number, lms: Lms): number {
  const z = lmsZScore(y, lms)
  if (z > 3) {
    const sd3 = valueAtZ(lms, 3)
    return 3 + (y - sd3) / (sd3 - valueAtZ(lms, 2))
  }
  if (z < -3) {
    const sd3 = valueAtZ(lms, -3)
    return -3 + (y - sd3) / (valueAtZ(lms, -2) - sd3)
  }
  return z
}

/**
 * Pembulatan 2 desimal seperti keluaran WHO Anthro. Klasifikasi dan flag memakai nilai
 * yang sudah dibulatkan ini, sama seperti perangkat lunak acuan.
 */
export function roundZScore(z: number): number {
  // `+ 0` mengubah nol negatif (-0) menjadi 0; tanpa ini z-score di median bisa tampil "-0".
  return Math.round(z * 100) / 100 + 0
}
