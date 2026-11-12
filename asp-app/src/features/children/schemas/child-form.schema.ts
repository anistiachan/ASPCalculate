import { z } from "zod"

import type { Sex } from "@/domain/child/child.types"
import type { ChildInput } from "@/infrastructure/storage/repositories/child-repository"
import { parseDate } from "@/lib/date/parse-date"

const NIK_PATTERN = /^\d{16}$/

/**
 * Skema formulir balita. Semua field berupa teks (sesuai isi input HTML); hasil
 * parsing berupa tipe yang sudah rapi. `today` (YYYY-MM-DD) disuntikkan agar
 * aturan "tidak boleh di masa depan" bisa diuji.
 */
export function createChildFormSchema(today: string) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, "Nama wajib diisi.")
      .max(100, "Nama maksimal 100 karakter."),

    birthDate: z
      .string()
      .refine((value) => value !== "", "Tanggal lahir wajib diisi.")
      .refine(
        (value) => value === "" || parseDate(value).ok,
        "Tanggal lahir tidak valid."
      )
      .refine(
        (value) => value === "" || !parseDate(value).ok || value <= today,
        "Tanggal lahir tidak boleh di masa depan."
      ),

    sex: z
      .string()
      .refine((value) => value === "M" || value === "F", "Pilih jenis kelamin.")
      .transform((value) => value as Sex),

    // Opsional. Spasi dibuang; jika diisi harus tepat 16 digit.
    nik: z
      .string()
      .transform((value) => value.replace(/\s+/g, ""))
      .refine(
        (value) => value === "" || NIK_PATTERN.test(value),
        "NIK harus 16 digit angka."
      ),
  })
}

export type ChildFormInput = z.input<ReturnType<typeof createChildFormSchema>>
export type ChildFormValues = z.output<ReturnType<typeof createChildFormSchema>>

export function toChildInput(values: ChildFormValues): ChildInput {
  return {
    name: values.name,
    birthDate: values.birthDate,
    sex: values.sex,
    nik: values.nik === "" ? null : values.nik,
  }
}
