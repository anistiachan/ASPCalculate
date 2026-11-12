/**
 * Pemeriksaan kewajaran input pengukuran balita. Ini pemeriksaan kualitas data,
 * BUKAN diagnosis: nilai di luar rentang hanya memunculkan peringatan agar
 * pengukuran diperiksa ulang, dan tidak pernah memblokir penyimpanan atau
 * dihapus otomatis (spesifikasi antropometri, bagian 8).
 *
 * Rentang di bawah sengaja longgar dan bersifat sementara; angka finalnya perlu
 * dikonfirmasi tenaga gizi bersama algoritma flag nilai implausibel WHO (Phase 3).
 */
export const PLAUSIBLE_RANGES = {
  weightKg: { min: 1, max: 30, label: "Berat", unit: "kg" },
  heightCm: { min: 35, max: 130, label: "Panjang/tinggi", unit: "cm" },
  lilaCm: { min: 5, max: 25, label: "LILA", unit: "cm" },
  headCm: { min: 25, max: 60, label: "Lingkar kepala", unit: "cm" },
} as const

export type PlausibilityField = keyof typeof PLAUSIBLE_RANGES

export type PlausibilityWarning = {
  field: PlausibilityField
  message: string
}

export type PlausibilityInput = Partial<
  Record<PlausibilityField, number | null>
>

export function checkPlausibility(
  values: PlausibilityInput
): PlausibilityWarning[] {
  const warnings: PlausibilityWarning[] = []

  for (const field of Object.keys(PLAUSIBLE_RANGES) as PlausibilityField[]) {
    const value = values[field]
    if (value === null || value === undefined) continue

    const { min, max, label, unit } = PLAUSIBLE_RANGES[field]
    if (value < min || value > max) {
      warnings.push({
        field,
        message: `${label} ${value} ${unit} di luar rentang wajar balita (${min}–${max} ${unit}). Periksa kembali pengukurannya.`,
      })
    }
  }
  return warnings
}
