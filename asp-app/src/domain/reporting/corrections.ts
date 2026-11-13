import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { checkPlausibility } from "@/domain/measurement/plausibility"
import { parseDate } from "@/lib/date/parse-date"
import { parseDecimal } from "@/lib/number/parse-decimal"
import { isBlank } from "@/lib/result/parse-result"

/*
 * Perencanaan impor HASIL UKUR ULANG dari berkas daftar "perlu diukur ulang".
 *
 * Prinsipnya: angka baru hanya masuk sebagai PENGUKURAN BARU pada tanggal ukur ulang yang
 * sebenarnya. Pengukuran lama tidak pernah ditimpa atau dihapus, jadi koreksi bisa ditelusuri.
 * Berkas ditolak per baris bila tanggal ukur ulang kosong, BB atau TB tidak lengkap, nilai di
 * luar rentang wajar, atau tanggalnya tidak mungkin. Selisih yang besar dari ukuran semula
 * (lonjakan) tidak ditolak, tetapi wajib dikonfirmasi petugas sebelum disimpan.
 */

/** Awal catatan baris pada pengukuran hasil ukur ulang; dipakai juga untuk menandainya di ekspor. */
export const REMEASURED_NOTE_PREFIX = "Ukur ulang dari berkas koreksi"

/** Selisih TB (cm) dari ukuran semula di atas ini perlu dikonfirmasi petugas. */
export const JUMP_HEIGHT_CM = 3
/** Selisih BB (kg) dari ukuran semula di atas ini perlu dikonfirmasi petugas. */
export const JUMP_WEIGHT_KG = 2

/** Satu baris mentah dari berkas, sebelum divalidasi. */
export type CorrectionRow = {
  /** Nomor baris Excel (mulai 1). */
  rowNumber: number
  code: string
  rawWeight: unknown
  rawHeight: unknown
  rawDate: unknown
}

export type CorrectionItem = {
  rowNumber: number
  childId: string
  name: string
  posyandu: string | null
  originalMeasurementId: string
  original: {
    measuredAt: string
    weightKg: number | null
    heightCm: number | null
  }
  next: { measuredAt: string; weightKg: number; heightCm: number }
  /** Sama persis dengan ukuran semula: ukur ulang menguatkan angka lama. */
  unchanged: boolean
  /** Selisih besar dari ukuran semula; harus dikonfirmasi sebelum disimpan. */
  jumps: string[]
}

export type CorrectionRejection = {
  rowNumber: number
  name: string | null
  message: string
}

export type CorrectionPlan = {
  items: CorrectionItem[]
  rejected: CorrectionRejection[]
  /** Baris yang dibiarkan kosong oleh petugas; tidak diubah. */
  untouched: number
}

export function planCorrections(
  rows: readonly CorrectionRow[],
  children: readonly StoredChild[],
  measurements: readonly StoredMeasurement[],
  /** Tanggal hari ini (YYYY-MM-DD); tanggal ukur ulang tidak boleh melewatinya. */
  today: string
): CorrectionPlan {
  const childById = new Map(children.map((child) => [child.id, child]))
  const measurementById = new Map(measurements.map((m) => [m.id, m]))
  const takenDates = new Set(
    measurements.map((m) => `${m.childId}|${m.measuredAt}`)
  )
  const seenCodes = new Set<string>()

  const items: CorrectionItem[] = []
  const rejected: CorrectionRejection[] = []
  let untouched = 0

  for (const row of rows) {
    if (
      isBlank(row.rawWeight) &&
      isBlank(row.rawHeight) &&
      isBlank(row.rawDate)
    ) {
      untouched++
      continue
    }

    const code = String(row.code ?? "").trim()
    const original = measurementById.get(code)
    const child = original ? childById.get(original.childId) : undefined
    const name = child?.name ?? null
    const reject = (message: string) =>
      rejected.push({ rowNumber: row.rowNumber, name, message })

    if (!original || !child) {
      reject(
        "Kode pengukuran tidak dikenal. Kolom Kode tidak boleh diubah, dan berkas harus dari daftar yang diunduh di perangkat ini."
      )
      continue
    }
    if (seenCodes.has(code)) {
      reject("Kode yang sama muncul lebih dari sekali pada berkas.")
      continue
    }
    seenCodes.add(code)

    const weight = parseDecimal(row.rawWeight)
    const height = parseDecimal(row.rawHeight)
    const date = parseDate(row.rawDate)

    if (!weight.ok || !height.ok || !date.ok) {
      reject(
        "Ada nilai yang tidak bisa dibaca (BB, TB, atau tanggal). Periksa kembali isian baris ini."
      )
      continue
    }
    if (date.value === null) {
      reject(
        "Tgl ukur ulang wajib diisi dengan tanggal pengukuran yang sebenarnya."
      )
      continue
    }
    if (weight.value === null || height.value === null) {
      reject(
        "Isi BB baru dan TB baru keduanya dengan hasil ukur nyata. Angka yang tidak diukur tidak boleh dikosongkan sebagian atau diperkirakan."
      )
      continue
    }
    if (weight.value <= 0 || height.value <= 0) {
      reject("BB dan TB harus lebih dari nol.")
      continue
    }

    const measuredAt = date.value
    if (measuredAt > today) {
      reject("Tgl ukur ulang tidak boleh di masa depan.")
      continue
    }
    if (measuredAt < child.birthDate) {
      reject("Tgl ukur ulang lebih awal dari tanggal lahir anak.")
      continue
    }
    if (measuredAt <= original.measuredAt) {
      reject(
        "Tgl ukur ulang harus setelah tanggal ukuran semula. Isi dengan hari pengukuran ulang yang sebenarnya."
      )
      continue
    }
    const dateKey = `${child.id}|${measuredAt}`
    if (takenDates.has(dateKey)) {
      reject("Anak ini sudah punya pengukuran pada tanggal itu.")
      continue
    }

    const warnings = checkPlausibility({
      weightKg: weight.value,
      heightCm: height.value,
    })
    if (warnings.length > 0) {
      reject(warnings.map((w) => w.message).join(" "))
      continue
    }

    takenDates.add(dateKey)

    const jumps: string[] = []
    if (
      original.rawLengthHeightCm !== null &&
      Math.abs(height.value - original.rawLengthHeightCm) > JUMP_HEIGHT_CM
    ) {
      jumps.push(
        `TB berubah dari ${original.rawLengthHeightCm} cm menjadi ${height.value} cm.`
      )
    }
    if (
      original.weightKg !== null &&
      Math.abs(weight.value - original.weightKg) > JUMP_WEIGHT_KG
    ) {
      jumps.push(
        `BB berubah dari ${original.weightKg} kg menjadi ${weight.value} kg.`
      )
    }

    items.push({
      rowNumber: row.rowNumber,
      childId: child.id,
      name: child.name,
      posyandu: child.posyandu ?? null,
      originalMeasurementId: original.id,
      original: {
        measuredAt: original.measuredAt,
        weightKg: original.weightKg,
        heightCm: original.rawLengthHeightCm,
      },
      next: { measuredAt, weightKg: weight.value, heightCm: height.value },
      unchanged:
        original.weightKg === weight.value &&
        original.rawLengthHeightCm === height.value,
      jumps,
    })
  }

  return { items, rejected, untouched }
}
