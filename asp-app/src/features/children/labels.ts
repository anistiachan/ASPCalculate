import type { MeasurementPosition, Sex } from "@/domain/child/child.types"

export const SEX_LABELS: Record<Sex, string> = {
  M: "Laki-laki",
  F: "Perempuan",
}

export const POSITION_LABELS: Record<MeasurementPosition, string> = {
  STANDING: "Berdiri",
  RECUMBENT: "Terlentang",
  UNKNOWN: "Tidak diketahui",
}
