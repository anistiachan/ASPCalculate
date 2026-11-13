import type { Sex } from "@/domain/child/child.types"

/**
 * Kenaikan berat badan minimal (kg) antar dua bulan berturut-turut menurut umur (bulan) dan
 * jenis kelamin. Anak dengan kenaikan di bawah angka ini "tidak naik" (T).
 *
 * SUMBER: tabel `GJ:GL` pada sheet P1 workbook ASP Karangtawar 2025, disalin apa adanya
 * (bukan dikarang). Belum dicocokkan dengan pedoman resmi kenaikan berat badan minimal;
 * lihat docs/OPENASP-MAPPING-SKDN-v0.2.md. Umur 0–60 bulan; selisih kecil seperti
 * 0,19999999999999998 pada berkas dibulatkan menjadi 0,2.
 */
const FROM_AGE_12 = 0.2

/** Kolom: [laki-laki, perempuan], indeks = umur dalam bulan (0–11). Mulai 12 bulan: 0,2. */
const UNDER_12_MONTHS: readonly (readonly [number, number])[] = [
  [0, 0], // 0
  [0.8, 0.8], // 1
  [0.9, 0.9], // 2
  [0.8, 0.8], // 3
  [0.6, 0.6], // 4
  [0.5, 0.5], // 5
  [0.4, 0.4], // 6
  [0.4, 0.3], // 7
  [0.3, 0.3], // 8
  [0.3, 0.3], // 9
  [0.3, 0.3], // 10
  [0.3, 0.2], // 11
]

/** Kenaikan minimal untuk umur (bulan, >= 0) dan jenis kelamin. */
export function minimumWeightGainKg(ageMonths: number, sex: Sex): number {
  if (ageMonths >= UNDER_12_MONTHS.length) return FROM_AGE_12
  return UNDER_12_MONTHS[Math.max(0, ageMonths)][sex === "M" ? 0 : 1]
}
