import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeAll, describe, expect, it } from "vitest"

import { loadWho2006References } from "@/domain/anthropometry/references/load-who-2006"
import type { ReferenceSet } from "@/domain/anthropometry/references/reference"
import type {
  StoredChild,
  StoredMeasurement,
} from "@/domain/child/stored.types"
import { detectAdapter } from "@/features/excel-import/adapters"
import { validateBatch } from "@/features/excel-import/validators/validate-batch"
import { computeListsForMonth } from "@/features/reports/services/lists-for-month"
import { readWorkbook } from "@/infrastructure/excel/workbook-reader"

/**
 * Menjaga contoh P1 sintetis di samples/ (template P1 yang diisi; dibuat `npm run samples:generate`)
 * tetap bisa diimpor dan menghasilkan hasil yang dijanjikan di samples/README.md.
 */

let refs: ReferenceSet
beforeAll(async () => {
  refs = await loadWho2006References()
})

function parseSample(fileName: string) {
  const bytes = readFileSync(join(process.cwd(), "samples", fileName))
  const workbook = readWorkbook(new Uint8Array(bytes))
  const adapter = detectAdapter(workbook)
  expect(adapter?.id).toBe("asp-karangtawar")
  return adapter!.parse(workbook, fileName)
}

describe("contoh-p1-valid.xlsx", () => {
  const batch = parseSample("contoh-p1-valid.xlsx")
  const validated = validateBatch(batch)

  it("8 anak dan 36 pengukuran, tanpa error", () => {
    expect(validated.counts.errors).toBe(0)
    expect(validated.children).toHaveLength(8)
    expect(validated.measurements).toHaveLength(36)
    expect(validated.children.map((c) => c.posyandu)).toEqual([
      "JERUK",
      "JERUK",
      "JERUK",
      "JERUK",
      "PEPAYA",
      "PEPAYA",
      "PEPAYA",
      "PEPAYA",
    ])
  })

  it("hanya peringatan bawaan format (cara ukur dan tanggal ukur sampai bulan)", () => {
    expect(validated.issues.map((i) => `${i.severity}:${i.code}`)).toEqual([
      "warning:POSITION_UNKNOWN",
      "warning:INVALID_VALUE",
    ])
  })

  it("memuat Nov/Des 2025, Vitamin A, dan ASI-E sesuai isian", () => {
    const months = new Set(
      validated.measurements
        .filter((m) => m.sourceChildName === "Anak Contoh A")
        .map((m) => m.measuredAt.slice(0, 7))
    )
    expect(months.has("2025-11")).toBe(true)
    expect(months.has("2025-12")).toBe(true)

    const feb = (name: string) =>
      validated.measurements.find(
        (m) => m.sourceChildName === name && m.measuredAt === "2026-02-14"
      )!
    expect(feb("Anak Contoh A").vitaminAStatus).toBe(true) // merah
    expect(feb("Anak Contoh B").vitaminAStatus).toBe(true) // biru
    expect(feb("Anak Contoh E").breastfeedingByMonth).toEqual({ 4: true })
  })

  it("Januari 2026: G pendek dan H sangat pendek, masuk daftar ukur ulang", () => {
    const children = batch.children.map(
      (c, i) =>
        ({
          id: `c${i}`,
          name: c.name,
          sex: c.sex,
          birthDate: c.birthDate,
          posyandu: c.posyandu,
        }) as StoredChild
    )
    const idOf = new Map(children.map((c) => [c.name, c.id]))
    const measurements = batch.measurements.map(
      (m, i) =>
        ({
          id: `m${i}`,
          childId: idOf.get(m.sourceChildName)!,
          measuredAt: m.measuredAt,
          weightKg: m.weightKg,
          rawLengthHeightCm: m.rawLengthHeightCm,
          measurementPosition: m.measurementPosition,
          rawPittingEdema: m.rawPittingEdema,
          vitaminAStatus: m.vitaminAStatus,
          breastfeedingByMonth: m.breastfeedingByMonth,
          rowNote: null,
        }) as StoredMeasurement
    )
    const lists = computeListsForMonth("2026-01", children, measurements, refs)
    expect(lists.status.lists.PENDEK.map((e) => e.name)).toEqual([
      "Anak Contoh G",
    ])
    expect(lists.status.lists.SANGAT_PENDEK.map((e) => e.name)).toEqual([
      "Anak Contoh H",
    ])
    expect(lists.recheck.map((e) => e.name)).toEqual([
      "Anak Contoh G",
      "Anak Contoh H",
    ])
  })
})

describe("contoh-p1-bermasalah.xlsx", () => {
  const validated = validateBatch(parseSample("contoh-p1-bermasalah.xlsx"))
  const errors = (code: string) =>
    validated.issues.filter((i) => i.severity === "error" && i.code === code)

  it("baris bermasalah ditolak dengan alasan yang jelas", () => {
    expect(
      errors("INVALID_VALUE")
        .map((i) => i.field)
        .sort()
    ).toEqual(["birthDate", "sex"])
    expect(
      errors("MISSING_VALUE")
        .map((i) => i.field)
        .sort()
    ).toEqual(["posyandu", "year"])
    expect(errors("NON_POSITIVE_MEASUREMENT")).toHaveLength(1)
    expect(errors("MEASURED_BEFORE_BIRTH")).toHaveLength(1)
    // Dua baris dengan kunci anak yang sama: keduanya ditolak (identitas ambigu).
    expect(errors("CHILD_DUPLICATE_KEY")).toHaveLength(2)
  })

  it("baris yang benar tetap diimpor; data ganda dan baris salah tidak ikut", () => {
    const names = [
      ...new Set(validated.measurements.map((m) => m.sourceChildName)),
    ]
    expect(names).toEqual(["Anak Valid A", "Anak Valid B", "Anak Salah Ketik"])
  })

  it("BB 105 kg dan TB 814 cm tidak ditolak tetapi diberi peringatan kewajaran", () => {
    const warnings = validated.issues.filter(
      (i) => i.severity === "warning" && i.code === "INVALID_VALUE"
    )
    expect(warnings.some((w) => w.message.includes("105 kg"))).toBe(true)
    expect(warnings.some((w) => w.message.includes("814 cm"))).toBe(true)
  })
})
