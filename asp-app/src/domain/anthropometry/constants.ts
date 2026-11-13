/**
 * Konstanta mesin antropometri. Setiap nilai mencatat sumbernya. Perilaku mengikuti
 * implementasi acuan WHO Anthro (paket `anthro` v1.1.0) kecuali dicatat lain; perbedaan
 * dengan Permenkes 2/2020 dicatat di docs/OPENASP-VALIDASI-ANTROPOMETRI.md.
 */

export const STANDARD_NAME =
  "Permenkes 2/2020 + WHO Child Growth Standards 2006"

/**
 * Apakah hasil perhitungan sudah divalidasi tenaga gizi/kesehatan yang berwenang
 * (spesifikasi antropometri bagian 12, butir 7; rencana Phase 3). Selama false, setiap
 * tampilan hasil wajib memuat peringatan bahwa hasil belum boleh dipakai untuk keputusan
 * layanan. Ubah menjadi true HANYA setelah ada tinjauan tertulis; lihat
 * docs/OPENASP-VALIDASI-ANTROPOMETRI.md.
 */
export const ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL = false

/** Versi algoritma. Naikkan setiap perilaku perhitungan berubah. */
export const ALGORITHM_VERSION = "openasp-anthro-0.1.0"

/** Rata-rata hari per bulan (365,25 / 12). Sumber: WHO Anthro (ANTHRO_DAYS_OF_MONTH). */
export const DAYS_PER_MONTH = 30.4375

/** Z-score hanya dihitung bila umur dalam bulan (hari / 30,4375) kurang dari ini. Sumber: WHO Anthro. */
export const MAX_AGE_MONTHS_EXCLUSIVE = 60

/** Umur terbesar (hari) yang ada di tabel referensi WHO. */
export const MAX_TABLE_AGE_DAYS = 1856

/**
 * Di bawah umur ini (hari) dipakai panjang badan telentang dan tabel BB/PB; mulai umur ini
 * dipakai tinggi badan berdiri dan tabel BB/TB. Sumber: WHO Anthro (731 hari).
 * Catatan: Permenkes menulis "0 sampai 24 bulan"; selisih batasnya perlu ditinjau tenaga gizi.
 */
export const LENGTH_HEIGHT_SWITCH_DAYS = 731

/** Koreksi posisi ukur (cm). Sumber: Permenkes 2/2020 dan WHO Anthro. */
export const POSITION_CORRECTION_CM = 0.7

/** Berdiri pada bayi di bawah umur ini (bulan) dianggap posisi tidak wajar. Sumber: WHO Anthro. */
export const STANDING_IMPLAUSIBLE_UNDER_MONTHS = 9

/** Rentang panjang/tinggi (cm) yang tercakup tabel BB/PB dan BB/TB. Sumber: WHO Anthro. */
export const WFL_RANGE_CM = { min: 45, max: 110 } as const
export const WFH_RANGE_CM = { min: 65, max: 120 } as const

/**
 * Z-score di luar rentang ini ditandai "tidak wajar secara biologis" untuk diperiksa ulang;
 * nilainya tidak dihapus. Sumber: WHO Anthro (flag fwei, flen, fwfl, fbmi).
 */
export const IMPLAUSIBLE_RANGES = {
  waz: { min: -6, max: 5 },
  haz: { min: -6, max: 6 },
  whz: { min: -5, max: 5 },
  baz: { min: -5, max: 5 },
} as const
