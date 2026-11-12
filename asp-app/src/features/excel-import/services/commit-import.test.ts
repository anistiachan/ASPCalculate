import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { OpenAspDatabase } from "@/infrastructure/storage/db"
import {
  buildValidWorkbook,
  CHILD_A_ROW,
  childrenSheet,
  monthSheet,
  NIK_A,
} from "@/test/fixtures/bu-bidan-workbook"

import { buBidanAdapter } from "../adapters/bu-bidan/bu-bidan-adapter"
import type { WorkbookData } from "../types"
import { validateBatch } from "../validators/validate-batch"
import { commitImport } from "./commit-import"

let db: OpenAspDatabase
let dbCounter = 0

beforeEach(() => {
  db = new OpenAspDatabase(`openasp-test-${++dbCounter}`)
})

afterEach(async () => {
  db.close()
  await db.delete()
})

const validate = (workbook: WorkbookData) =>
  validateBatch(buBidanAdapter.parse(workbook, "uji.xlsx"))

let idCounter = 0
const deps = { newId: () => `id-${++idCounter}` }

const counts = async () => ({
  children: await db.children.count(),
  measurements: await db.measurements.count(),
  batches: await db.importBatches.count(),
})

describe("commitImport", () => {
  it("menyimpan anak dan pengukuran yang valid beserta riwayat import", async () => {
    const plan = await commitImport(db, validate(buildValidWorkbook()), deps)

    expect(plan.summary).toMatchObject({
      childrenNew: 2,
      measurementsNew: 4,
      childrenConflict: 0,
      measurementsConflict: 0,
    })
    expect(await counts()).toEqual({ children: 2, measurements: 4, batches: 1 })

    const child = await db.children.where("sourceKey").equals(NIK_A).first()
    expect(child).toMatchObject({ birthDate: "2023-03-15", sex: "M" })
    const batch = await db.importBatches.get(plan.batchId)
    expect(batch).toMatchObject({
      fileName: "uji.xlsx",
      adapterId: "bu-bidan",
      childrenAdded: 2,
      measurementsAdded: 4,
    })
  })

  it("mengimpor file yang sama dua kali tidak menggandakan data", async () => {
    await commitImport(db, validate(buildValidWorkbook()), deps)
    const second = await commitImport(db, validate(buildValidWorkbook()), deps)

    expect(second.summary).toMatchObject({
      childrenNew: 0,
      childrenUnchanged: 2,
      measurementsNew: 0,
      measurementsDuplicate: 4,
      childrenConflict: 0,
      measurementsConflict: 0,
    })
    expect(second.issues).toEqual([])
    expect(await counts()).toEqual({ children: 2, measurements: 4, batches: 2 })
  })

  it("menambahkan hanya pengukuran baru pada import berikutnya", async () => {
    await commitImport(db, validate(buildValidWorkbook()), deps)

    const next: WorkbookData = {
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JULI", [
          {
            NIK: NIK_A,
            TANGGALUKUR: "2025-07-12",
            BERAT: 12.8,
            TINGGI: 89,
            CARAUKUR: "Berdiri",
          },
        ]),
      ],
    }
    const plan = await commitImport(db, validate(next), deps)

    expect(plan.summary).toMatchObject({
      childrenNew: 0,
      childrenUnchanged: 1,
      measurementsNew: 1,
    })
    expect(await counts()).toMatchObject({ children: 2, measurements: 5 })
  })

  it("tidak menimpa anak dengan NIK sama tetapi data berbeda", async () => {
    await commitImport(db, validate(buildValidWorkbook()), deps)

    const changed: WorkbookData = {
      sheets: [
        childrenSheet([{ ...CHILD_A_ROW, tgl_lahir: "2022-01-01" }]),
        monthSheet("JULI", [
          {
            NIK: NIK_A,
            TANGGALUKUR: "2025-07-12",
            BERAT: 12.8,
            TINGGI: 89,
            CARAUKUR: "Berdiri",
          },
        ]),
      ],
    }
    const plan = await commitImport(db, validate(changed), deps)

    expect(plan.summary).toMatchObject({
      childrenConflict: 1,
      measurementsSkippedChildConflict: 1,
      measurementsNew: 0,
    })
    expect(plan.issues.map((issue) => issue.code)).toEqual([
      "CHILD_CONFLICT",
      "CHILD_CONFLICT",
    ])
    const child = await db.children.where("sourceKey").equals(NIK_A).first()
    expect(child?.birthDate).toBe("2023-03-15")
    expect(await counts()).toMatchObject({ children: 2, measurements: 4 })
  })

  it("tidak menimpa pengukuran pada tanggal yang sama dengan nilai berbeda", async () => {
    await commitImport(db, validate(buildValidWorkbook()), deps)

    const changed: WorkbookData = {
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            TANGGALUKUR: "2025-01-20",
            BERAT: 99,
            TINGGI: 82.5,
            CARAUKUR: "Terlentang",
          },
        ]),
      ],
    }
    const plan = await commitImport(db, validate(changed), deps)

    expect(plan.summary.measurementsConflict).toBe(1)
    expect(plan.issues).toEqual([
      expect.objectContaining({ code: "MEASUREMENT_CONFLICT", row: 2 }),
    ])
    const stored = await db.measurements
      .where("measuredAt")
      .equals("2025-01-20")
      .toArray()
    const weights = stored.map((m) => m.weightKg ?? 0).sort((a, b) => a - b)
    expect(weights).toEqual([9.8, 11.2])
  })

  it("hanya menyimpan baris tanpa error dan tetap menyimpan yang valid", async () => {
    const workbook: WorkbookData = {
      sheets: [
        childrenSheet([CHILD_A_ROW]),
        monthSheet("JANUARI", [
          {
            NIK: NIK_A,
            TANGGALUKUR: "2025-01-20",
            BERAT: 11,
            TINGGI: 80,
            CARAUKUR: "Berdiri",
          },
          { NIK: NIK_A, TANGGALUKUR: "2025-01-21", BERAT: "abc", TINGGI: 80 },
        ]),
      ],
    }
    const plan = await commitImport(db, validate(workbook), deps)
    expect(plan.summary.measurementsNew).toBe(1)
    expect(await counts()).toMatchObject({ children: 1, measurements: 1 })
  })

  it("indeks unik database menolak pengukuran ganda sebagai jaring pengaman", async () => {
    await commitImport(db, validate(buildValidWorkbook()), deps)
    const existing = (await db.measurements.toArray())[0]

    await expect(
      db.measurements.add({ ...existing, id: "id-ganda" })
    ).rejects.toThrow()
    expect((await counts()).measurements).toBe(4)
  })

  it("membatalkan seluruh penulisan jika terjadi kegagalan di tengah", async () => {
    const validated = validate(buildValidWorkbook())
    // ID yang sama untuk semua rekaman memicu pelanggaran kunci utama saat bulkAdd.
    await expect(
      commitImport(db, validated, { newId: () => "id-sama" })
    ).rejects.toThrow()
    expect(await counts()).toEqual({ children: 0, measurements: 0, batches: 0 })
  })
})
