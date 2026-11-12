import { z } from "zod"

import type { MeasurementPosition } from "@/domain/child/child.types"
import type { MeasurementInput } from "@/infrastructure/storage/repositories/child-repository"
import { parseDate } from "@/lib/date/parse-date"
import { parseDecimal } from "@/lib/number/parse-decimal"

const POSITIONS = ["STANDING", "RECUMBENT", "UNKNOWN"] as const

/** Angka desimal opsional (titik atau koma) yang bila diisi harus lebih dari nol. */
function optionalPositiveNumber(label: string) {
  return z
    .string()
    .superRefine((raw, ctx) => {
      const result = parseDecimal(raw)
      if (!result.ok) {
        ctx.addIssue({
          code: "custom",
          message: `${label} harus berupa angka (boleh memakai koma).`,
        })
      } else if (result.value !== null && result.value <= 0) {
        ctx.addIssue({
          code: "custom",
          message: `${label} harus lebih dari nol.`,
        })
      }
    })
    .transform((raw) => {
      const result = parseDecimal(raw)
      return result.ok ? result.value : null
    })
}

/**
 * Skema formulir pengukuran untuk satu anak. `birthDate` dan `today` disuntikkan
 * karena aturan tanggal bergantung pada anak dan hari ini.
 */
export function createMeasurementFormSchema(context: {
  birthDate: string
  today: string
}) {
  return z
    .object({
      measuredAt: z
        .string()
        .refine((value) => value !== "", "Tanggal ukur wajib diisi.")
        .refine(
          (value) => value === "" || parseDate(value).ok,
          "Tanggal ukur tidak valid."
        )
        .refine(
          (value) =>
            value === "" || !parseDate(value).ok || value >= context.birthDate,
          "Tanggal ukur tidak boleh lebih awal dari tanggal lahir."
        )
        .refine(
          (value) =>
            value === "" || !parseDate(value).ok || value <= context.today,
          "Tanggal ukur tidak boleh di masa depan."
        ),

      weightKg: optionalPositiveNumber("Berat"),
      heightCm: optionalPositiveNumber("Panjang/tinggi"),

      // Kosong = belum dipilih. Dicek bersama tinggi di bawah.
      position: z
        .string()
        .refine(
          (value) =>
            value === "" || (POSITIONS as readonly string[]).includes(value),
          "Cara ukur tidak dikenal."
        ),

      lilaCm: optionalPositiveNumber("LILA"),
      headCm: optionalPositiveNumber("Lingkar kepala"),
      note: z.string().trim().max(200, "Catatan maksimal 200 karakter."),
    })
    .superRefine((values, ctx) => {
      if (values.weightKg === null && values.heightCm === null) {
        ctx.addIssue({
          code: "custom",
          path: ["weightKg"],
          message: "Isi berat atau panjang/tinggi.",
        })
      }
      // Posisi menentukan koreksi panjang/tinggi, jadi wajib dipilih (boleh
      // "Tidak diketahui") bila tinggi diisi, bukan diisi diam-diam.
      if (values.heightCm !== null && values.position === "") {
        ctx.addIssue({
          code: "custom",
          path: ["position"],
          message: "Pilih cara ukur, atau 'Tidak diketahui'.",
        })
      }
    })
}

export type MeasurementFormInput = z.input<
  ReturnType<typeof createMeasurementFormSchema>
>
export type MeasurementFormValues = z.output<
  ReturnType<typeof createMeasurementFormSchema>
>

export function toMeasurementInput(
  values: MeasurementFormValues
): MeasurementInput {
  return {
    measuredAt: values.measuredAt,
    weightKg: values.weightKg,
    rawLengthHeightCm: values.heightCm,
    measurementPosition: (values.position || "UNKNOWN") as MeasurementPosition,
    lilaCm: values.lilaCm,
    headCircumferenceCm: values.headCm,
    rowNote: values.note === "" ? null : values.note,
  }
}
