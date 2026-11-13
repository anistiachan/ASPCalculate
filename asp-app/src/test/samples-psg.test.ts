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
 * Menjaga contoh PSG sintetis di samples/ (dibuat `npm run samples:generate`) tetap bisa diimpor
 * dan menghasilkan hasil yang dijanjikan di samples/README.md.
 */

let refs: ReferenceSet
beforeAll(async () => {
  refs = await loadWho2006References()
})

function parseSample(fileName: string) {
  const bytes = readFileSync(join(process.cwd(), "samples", fileName))
  const workbook = readWorkbook(new Uint8Array(bytes))
  const adapter = detectAdapter(workbook)
  expect(adapter?.id).toBe("asp-psg")
  return adapter!.parse(workbook, fileName)
}

describe("contoh-psg-valid.xlsx", () => {
  const FILE = "contoh-psg-valid.xlsx"

  it("dikenali sebagai sheet PSG: 4 anak, 4 pengukuran Februari 2026, tanpa error", () => {
    const batch = parseSample(FILE)
    expect(batch.issues.filter((i) => i.severity === "error")).toEqual([])
    expect(batch.children.map((c) => c.name)).toEqual([
      "Anak PSG A",
      "Anak PSG B",
      "Anak PSG C",
      "Anak PSG D",
    ])
    expect(batch.measurements.map((m) => m.measuredAt)).toEqual(
      Array(4).fill("2026-02-14")
    )
  })

  it("lolos validasi: tanpa error, hanya peringatan cara ukur", () => {
    const validated = validateBatch(parseSample(FILE))
    expect(validated.counts.errors).toBe(0)
    expect(validated.issues.map((i) => i.code)).toEqual(["POSITION_UNKNOWN"])
  })

  it("status TB/U: B pendek, C sangat pendek, A dan D normal", () => {
    const batch = parseSample(FILE)
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
    const measurements = batch.measurements.map(
      (m, i) =>
        ({
          id: `m${i}`,
          childId: `c${i}`,
          measuredAt: m.measuredAt,
          weightKg: m.weightKg,
          rawLengthHeightCm: m.rawLengthHeightCm,
          measurementPosition: m.measurementPosition,
          rawPittingEdema: m.rawPittingEdema,
          vitaminAStatus: null,
          breastfeedingByMonth: {},
          rowNote: null,
        }) as StoredMeasurement
    )
    const lists = computeListsForMonth("2026-02", children, measurements, refs)

    expect(lists.status.lists.PENDEK.map((e) => e.name)).toEqual(["Anak PSG B"])
    expect(lists.status.lists.SANGAT_PENDEK.map((e) => e.name)).toEqual([
      "Anak PSG C",
    ])
    // Anak pendek dan sangat pendek masuk daftar verifikasi ukur ulang; A dan D tidak.
    expect(lists.recheck.map((e) => e.name)).toEqual([
      "Anak PSG B",
      "Anak PSG C",
    ])
  })
})

describe("contoh-psg-bermasalah.xlsx", () => {
  const validated = validateBatch(parseSample("contoh-psg-bermasalah.xlsx"))
  const errorsAt = (code: string) =>
    validated.issues.filter((i) => i.severity === "error" && i.code === code)

  it("baris bermasalah ditolak dengan alasan yang jelas, baris benar tetap lolos", () => {
    expect(
      errorsAt("INVALID_VALUE")
        .map((i) => i.field)
        .sort()
    ).toEqual(["birthDate", "measuredAt", "sex"])
    expect(errorsAt("MISSING_VALUE").map((i) => i.field)).toEqual(["posyandu"])
    expect(errorsAt("MEASURED_BEFORE_BIRTH")).toHaveLength(1)
    // Dua baris dengan kunci anak yang sama: keduanya ditolak (identitas ambigu).
    expect(errorsAt("CHILD_DUPLICATE_KEY")).toHaveLength(2)
  })

  it("anak yang benar tetap diimpor, dan data ganda tidak ikut", () => {
    const names = validated.measurements.map((m) => m.sourceChildName)
    expect(names).toEqual([
      "Anak Valid A",
      "Anak Valid B",
      "Anak Salah Ketik TB",
    ])
    expect(validated.measurements.map((m) => m.sourceChildName)).not.toContain(
      "Anak Data Ganda"
    )
  })

  it("TB 814 cm tidak ditolak tetapi diberi peringatan kewajaran", () => {
    const warning = validated.issues.find(
      (i) => i.severity === "warning" && i.field === "heightCm"
    )
    expect(warning?.message).toContain("814 cm di luar rentang wajar")
    const typo = validated.measurements.find(
      (m) => m.sourceChildName === "Anak Salah Ketik TB"
    )
    expect(typo?.rawLengthHeightCm).toBe(814)
  })
})
