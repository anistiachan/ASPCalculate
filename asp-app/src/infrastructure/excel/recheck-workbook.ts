import * as XLSX from "xlsx"

import type { RecheckEntry } from "@/domain/reporting/recheck"
import { formatMonth } from "@/lib/format/format"

export type RecheckWorkbookMeta = {
  generatedOn: string
  /** Nama Posyandu bila disaring; kosong = semua. */
  scope?: string
}

type Row = (string | number | null)[]

/** Judul kolom yang diisi petugas; dipakai juga saat berkas dibaca kembali (impor koreksi). */
export const RECHECK_HEADERS = {
  code: "Kode",
  newWeight: "BB baru (kg)",
  newHeight: "TB baru (cm)",
  remeasuredOn: "Tgl ukur ulang",
} as const

/**
 * Daftar "perlu diukur ulang". Berkas ini untuk petugas membawa ke lapangan: tiap baris adalah
 * ukuran yang dicurigai salah ukur atau salah catat. Kolom "BB baru" dan "TB baru" dibiarkan
 * kosong untuk diisi HANYA dengan hasil ukur ulang nyata. Kolom "Kode" mengenali pengukuran
 * dan tidak boleh diubah. Berkas memuat NAMA anak (data pribadi), tanpa NIK atau tanggal lahir.
 */
export function buildRecheckWorkbook(
  month: string,
  entries: readonly RecheckEntry[],
  meta: RecheckWorkbookMeta
): Uint8Array {
  const book = XLSX.utils.book_new()

  const instructions: Row[] = [
    ["Daftar ukuran yang perlu diukur ulang"],
    ["Periode", formatMonth(month)],
    ["Posyandu", meta.scope ?? "Semua Posyandu"],
    ["Dibuat pada", meta.generatedOn],
    [],
    [
      "PERHATIAN: berkas ini memuat nama anak. Simpan dan bagikan hanya kepada petugas yang berkepentingan.",
    ],
    [],
    ["Cara memakai"],
    [
      "1. Ukur ulang anak pada daftar, lalu isi kolom BB baru, TB baru, dan Tgl ukur ulang dengan HASIL UKUR NYATA.",
    ],
    [
      "2. Tgl ukur ulang wajib diisi (format 2026-06-24) pada setiap baris yang diubah.",
    ],
    [
      "3. Biarkan kolom kosong bila anak tidak diukur ulang atau ukuran semula ternyata benar.",
    ],
    [
      "4. Jangan mengisi angka perkiraan atau angka yang disesuaikan agar status berubah. Status pendek yang benar harus tetap tercatat.",
    ],
    ["5. Jangan mengubah kolom Kode."],
  ]
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructions)
  instructionSheet["!cols"] = [{ wch: 120 }]
  XLSX.utils.book_append_sheet(book, instructionSheet, "Petunjuk")

  const rows: Row[] = [
    [
      RECHECK_HEADERS.code,
      "Nama",
      "Posyandu",
      "L/P",
      "Tg. ukur",
      "BB (kg)",
      "TB (cm)",
      "Ukur sebelumnya",
      "BB sebelumnya",
      "TB sebelumnya",
      "Alasan perlu dicek",
      RECHECK_HEADERS.newWeight,
      RECHECK_HEADERS.newHeight,
      RECHECK_HEADERS.remeasuredOn,
    ],
    ...entries.map((entry): Row => [
      entry.measurementId,
      entry.name,
      entry.posyandu,
      entry.sex === "M" ? "L" : "P",
      entry.measuredAt,
      entry.weightKg,
      entry.heightCm,
      entry.previousMeasuredAt,
      entry.previousWeightKg,
      entry.previousHeightCm,
      entry.reasons.map((reason) => reason.message).join(" "),
      null,
      null,
      null,
    ]),
  ]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet["!cols"] = [38, 28, 12, 5, 12, 8, 8, 14, 12, 12, 90, 14, 14, 18].map(
    (wch) => ({ wch })
  )
  XLSX.utils.book_append_sheet(book, sheet, "Perlu diukur ulang")

  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }))
}
