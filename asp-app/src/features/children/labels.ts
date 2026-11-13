import type { MeasurementPosition, Sex } from "@/domain/child/child.types"
import type { AnthropometryFlag } from "@/domain/anthropometry/compute"

export const SEX_LABELS: Record<Sex, string> = {
  M: "Laki-laki",
  F: "Perempuan",
}

export const POSITION_LABELS: Record<MeasurementPosition, string> = {
  STANDING: "Berdiri",
  RECUMBENT: "Terlentang",
  UNKNOWN: "Tidak diketahui",
}

/** Penjelasan untuk pengguna atas setiap catatan hasil perhitungan antropometri. */
export const FLAG_LABELS: Record<AnthropometryFlag, string> = {
  AGE_INVALID: "Tanggal ukur lebih awal dari tanggal lahir.",
  AGE_OUT_OF_RANGE:
    "Umur 60 bulan atau lebih: di luar cakupan standar (0–59 bulan), status gizi tidak dihitung.",
  WEIGHT_MISSING: "Berat belum diisi.",
  HEIGHT_MISSING: "Panjang/tinggi belum diisi.",
  POSITION_UNKNOWN:
    "Cara ukur tidak diketahui: panjang/tinggi tidak dikoreksi. Hasil bisa meleset sekitar 0,7 cm.",
  POSITION_CORRECTED_UP:
    "Diukur berdiri pada umur di bawah 24 bulan: panjang ditambah 0,7 cm.",
  POSITION_CORRECTED_DOWN:
    "Diukur telentang pada umur 24 bulan atau lebih: tinggi dikurangi 0,7 cm.",
  STANDING_UNDER_9_MONTHS:
    "Bayi di bawah 9 bulan diukur berdiri: posisi tidak wajar, nilai tidak dikoreksi. Periksa kembali pengukurannya.",
  WFH_OUT_OF_RANGE:
    "Panjang/tinggi di luar rentang tabel BB/PB-TB: status BB/PB-TB tidak dihitung.",
  IMPLAUSIBLE_WAZ:
    "Z-score BB/U tidak wajar secara biologis: periksa kembali berat dan tanggal lahir.",
  IMPLAUSIBLE_HAZ:
    "Z-score TB/U tidak wajar secara biologis: periksa kembali panjang/tinggi dan tanggal lahir.",
  IMPLAUSIBLE_WHZ:
    "Z-score BB/PB-TB tidak wajar secara biologis: periksa kembali berat dan panjang/tinggi.",
  IMPLAUSIBLE_BAZ:
    "Z-score IMT/U tidak wajar secara biologis: periksa kembali berat dan panjang/tinggi.",
  PITTING_EDEMA_PRESENT:
    "Edema pitting: z-score berbasis berat tidak dihitung.",
  PITTING_EDEMA_UNMAPPED:
    "Ada isian edema pitting yang belum bisa ditafsirkan (kamus kode belum dikonfirmasi). Hasil berbasis berat perlu diperiksa.",
}
