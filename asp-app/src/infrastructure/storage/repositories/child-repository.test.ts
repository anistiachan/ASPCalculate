import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { OpenAspDatabase } from "../db"
import {
  BirthDateConflictError,
  ChildNotFoundError,
  createChild,
  createMeasurement,
  deleteChild,
  deleteMeasurement,
  DuplicateMeasurementDateError,
  DuplicateNikError,
  getChild,
  listChildren,
  listMeasurementsForChild,
  MeasurementBeforeBirthError,
  MeasurementNotFoundError,
  updateChild,
  updateMeasurement,
  type ChildInput,
  type MeasurementInput,
} from "./child-repository"

let db: OpenAspDatabase
let counter = 0
let idCounter = 0

beforeEach(() => {
  db = new OpenAspDatabase(`openasp-child-test-${++counter}`)
})

afterEach(async () => {
  db.close()
  await db.delete()
})

const deps = {
  newId: () => `id-${++idCounter}`,
  now: () => "2026-01-01T00:00:00.000Z",
}

const childInput = (overrides: Partial<ChildInput> = {}): ChildInput => ({
  name: "Anak Uji",
  birthDate: "2025-03-15",
  sex: "M",
  nik: null,
  ...overrides,
})

const measurementInput = (
  overrides: Partial<MeasurementInput> = {}
): MeasurementInput => ({
  measuredAt: "2025-06-20",
  weightKg: 6.5,
  rawLengthHeightCm: 63,
  measurementPosition: "RECUMBENT",
  lilaCm: null,
  headCircumferenceCm: null,
  rowNote: null,
  ...overrides,
})

describe("createChild", () => {
  it("menyimpan anak tanpa NIK dan menandainya dibuat manual", async () => {
    const child = await createChild(db, childInput(), deps)
    expect(child).toMatchObject({
      name: "Anak Uji",
      sourceKey: null,
      importBatchId: null,
    })
    expect(await getChild(db, child.id)).toEqual(child)
  })

  it("mengizinkan banyak anak tanpa NIK (indeks unik tidak bentrok pada null)", async () => {
    await createChild(db, childInput({ name: "A" }), deps)
    await createChild(db, childInput({ name: "B" }), deps)
    await createChild(db, childInput({ name: "C" }), deps)
    expect(await listChildren(db)).toHaveLength(3)
  })

  it("menolak NIK yang sudah dipakai anak lain", async () => {
    await createChild(db, childInput({ nik: "3200000000000001" }), deps)
    await expect(
      createChild(
        db,
        childInput({ name: "Lain", nik: "3200000000000001" }),
        deps
      )
    ).rejects.toBeInstanceOf(DuplicateNikError)
    expect(await listChildren(db)).toHaveLength(1)
  })

  it("pesan error tidak memuat NIK", async () => {
    await createChild(db, childInput({ nik: "3200000000000001" }), deps)
    const error = await createChild(
      db,
      childInput({ nik: "3200000000000001" }),
      deps
    ).catch((e: Error) => e)
    expect((error as Error).message).not.toContain("3200")
  })
})

describe("updateChild", () => {
  it("mengubah data dan mencatat waktu ubah", async () => {
    const child = await createChild(db, childInput(), deps)
    const updated = await updateChild(
      db,
      child.id,
      childInput({ name: "Nama Baru", sex: "F" }),
      { now: () => "2026-02-02T00:00:00.000Z" }
    )
    expect(updated).toMatchObject({
      name: "Nama Baru",
      sex: "F",
      updatedAt: "2026-02-02T00:00:00.000Z",
      createdAt: child.createdAt,
    })
  })

  it("mengizinkan menyimpan NIK sendiri tanpa dianggap ganda", async () => {
    const child = await createChild(
      db,
      childInput({ nik: "3200000000000001" }),
      deps
    )
    await expect(
      updateChild(
        db,
        child.id,
        childInput({ name: "X", nik: "3200000000000001" }),
        deps
      )
    ).resolves.toMatchObject({ name: "X" })
  })

  it("menolak NIK milik anak lain", async () => {
    await createChild(db, childInput({ nik: "3200000000000001" }), deps)
    const second = await createChild(db, childInput({ name: "Dua" }), deps)
    await expect(
      updateChild(db, second.id, childInput({ nik: "3200000000000001" }), deps)
    ).rejects.toBeInstanceOf(DuplicateNikError)
  })

  it("menolak tanggal lahir yang lebih akhir dari pengukuran yang ada", async () => {
    const child = await createChild(db, childInput(), deps)
    await createMeasurement(
      db,
      child.id,
      measurementInput({ measuredAt: "2025-04-01" }),
      deps
    )
    await createMeasurement(
      db,
      child.id,
      measurementInput({ measuredAt: "2025-08-01" }),
      deps
    )

    const error = await updateChild(
      db,
      child.id,
      childInput({ birthDate: "2025-05-01" }),
      deps
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(BirthDateConflictError)
    expect((error as BirthDateConflictError).conflictingMeasurements).toBe(1)
    expect((await getChild(db, child.id))?.birthDate).toBe("2025-03-15")
  })

  it("mengizinkan tanggal lahir lebih awal", async () => {
    const child = await createChild(db, childInput(), deps)
    await createMeasurement(db, child.id, measurementInput(), deps)
    await expect(
      updateChild(db, child.id, childInput({ birthDate: "2025-01-01" }), deps)
    ).resolves.toMatchObject({ birthDate: "2025-01-01" })
  })

  it("error jika anak tidak ada", async () => {
    await expect(
      updateChild(db, "tidak-ada", childInput(), deps)
    ).rejects.toBeInstanceOf(ChildNotFoundError)
  })
})

describe("deleteChild", () => {
  it("menghapus anak beserta semua pengukurannya, dan tidak menyentuh anak lain", async () => {
    const a = await createChild(db, childInput({ name: "A" }), deps)
    const b = await createChild(db, childInput({ name: "B" }), deps)
    await createMeasurement(
      db,
      a.id,
      measurementInput({ measuredAt: "2025-05-01" }),
      deps
    )
    await createMeasurement(
      db,
      a.id,
      measurementInput({ measuredAt: "2025-06-01" }),
      deps
    )
    await createMeasurement(
      db,
      b.id,
      measurementInput({ measuredAt: "2025-05-01" }),
      deps
    )

    await deleteChild(db, a.id)

    expect(await getChild(db, a.id)).toBeNull()
    expect(await listMeasurementsForChild(db, a.id)).toEqual([])
    expect(await listMeasurementsForChild(db, b.id)).toHaveLength(1)
  })

  it("error jika anak tidak ada", async () => {
    await expect(deleteChild(db, "tidak-ada")).rejects.toBeInstanceOf(
      ChildNotFoundError
    )
  })
})

describe("createMeasurement", () => {
  it("menyimpan pengukuran manual dan menandai asalnya", async () => {
    const child = await createChild(db, childInput(), deps)
    const m = await createMeasurement(
      db,
      child.id,
      measurementInput({ rowNote: "catatan" }),
      deps
    )
    expect(m).toMatchObject({
      childId: child.id,
      weightKg: 6.5,
      rawLengthHeightCm: 63,
      measurementPosition: "RECUMBENT",
      rowNote: "catatan",
      sourceSheet: null,
      importBatchId: null,
    })
  })

  it("menolak tanggal ukur yang sama untuk anak yang sama", async () => {
    const child = await createChild(db, childInput(), deps)
    await createMeasurement(db, child.id, measurementInput(), deps)
    await expect(
      createMeasurement(db, child.id, measurementInput({ weightKg: 9 }), deps)
    ).rejects.toBeInstanceOf(DuplicateMeasurementDateError)
    expect(await listMeasurementsForChild(db, child.id)).toHaveLength(1)
  })

  it("mengizinkan tanggal ukur yang sama untuk anak berbeda", async () => {
    const a = await createChild(db, childInput({ name: "A" }), deps)
    const b = await createChild(db, childInput({ name: "B" }), deps)
    await createMeasurement(db, a.id, measurementInput(), deps)
    await expect(
      createMeasurement(db, b.id, measurementInput(), deps)
    ).resolves.toBeDefined()
  })

  it("menolak tanggal ukur sebelum tanggal lahir, tetapi menerima tepat pada hari lahir", async () => {
    const child = await createChild(db, childInput(), deps)
    await expect(
      createMeasurement(
        db,
        child.id,
        measurementInput({ measuredAt: "2025-03-14" }),
        deps
      )
    ).rejects.toBeInstanceOf(MeasurementBeforeBirthError)
    await expect(
      createMeasurement(
        db,
        child.id,
        measurementInput({ measuredAt: "2025-03-15" }),
        deps
      )
    ).resolves.toBeDefined()
  })

  it("error jika anak tidak ada", async () => {
    await expect(
      createMeasurement(db, "tidak-ada", measurementInput(), deps)
    ).rejects.toBeInstanceOf(ChildNotFoundError)
  })
})

describe("listMeasurementsForChild", () => {
  it("mengurutkan dari yang terbaru", async () => {
    const child = await createChild(db, childInput(), deps)
    for (const date of ["2025-05-01", "2025-09-01", "2025-07-01"]) {
      await createMeasurement(
        db,
        child.id,
        measurementInput({ measuredAt: date }),
        deps
      )
    }
    const dates = (await listMeasurementsForChild(db, child.id)).map(
      (m) => m.measuredAt
    )
    expect(dates).toEqual(["2025-09-01", "2025-07-01", "2025-05-01"])
  })
})

describe("updateMeasurement", () => {
  it("mengubah nilai dan mempertahankan data hasil import", async () => {
    const child = await createChild(db, childInput(), deps)
    const created = await createMeasurement(
      db,
      child.id,
      measurementInput(),
      deps
    )
    // Simulasikan baris hasil import yang punya indikator tambahan.
    await db.measurements.update(created.id, {
      vitaminAStatus: true,
      breastfeedingByMonth: { 0: true },
      sourceSheet: "JUNI",
      sourceRow: 5,
    })

    const updated = await updateMeasurement(
      db,
      created.id,
      measurementInput({ weightKg: 7.1 }),
      { now: () => "2026-03-03T00:00:00.000Z" }
    )
    expect(updated).toMatchObject({
      weightKg: 7.1,
      vitaminAStatus: true,
      breastfeedingByMonth: { 0: true },
      sourceSheet: "JUNI",
      sourceRow: 5,
      updatedAt: "2026-03-03T00:00:00.000Z",
    })
  })

  it("menolak memindahkan ke tanggal yang sudah punya pengukuran", async () => {
    const child = await createChild(db, childInput(), deps)
    await createMeasurement(
      db,
      child.id,
      measurementInput({ measuredAt: "2025-05-01" }),
      deps
    )
    const second = await createMeasurement(
      db,
      child.id,
      measurementInput({ measuredAt: "2025-06-01" }),
      deps
    )
    await expect(
      updateMeasurement(
        db,
        second.id,
        measurementInput({ measuredAt: "2025-05-01" }),
        deps
      )
    ).rejects.toBeInstanceOf(DuplicateMeasurementDateError)
  })

  it("mengizinkan menyimpan tanpa mengubah tanggal", async () => {
    const child = await createChild(db, childInput(), deps)
    const m = await createMeasurement(db, child.id, measurementInput(), deps)
    await expect(
      updateMeasurement(db, m.id, measurementInput({ weightKg: 8 }), deps)
    ).resolves.toMatchObject({ weightKg: 8 })
  })

  it("menolak tanggal sebelum lahir", async () => {
    const child = await createChild(db, childInput(), deps)
    const m = await createMeasurement(db, child.id, measurementInput(), deps)
    await expect(
      updateMeasurement(
        db,
        m.id,
        measurementInput({ measuredAt: "2024-01-01" }),
        deps
      )
    ).rejects.toBeInstanceOf(MeasurementBeforeBirthError)
  })

  it("error jika pengukuran tidak ada", async () => {
    await expect(
      updateMeasurement(db, "tidak-ada", measurementInput(), deps)
    ).rejects.toBeInstanceOf(MeasurementNotFoundError)
  })
})

describe("deleteMeasurement", () => {
  it("menghapus satu pengukuran saja", async () => {
    const child = await createChild(db, childInput(), deps)
    const a = await createMeasurement(
      db,
      child.id,
      measurementInput({ measuredAt: "2025-05-01" }),
      deps
    )
    await createMeasurement(
      db,
      child.id,
      measurementInput({ measuredAt: "2025-06-01" }),
      deps
    )
    await deleteMeasurement(db, a.id)
    expect(await listMeasurementsForChild(db, child.id)).toHaveLength(1)
  })

  it("error jika pengukuran tidak ada", async () => {
    await expect(deleteMeasurement(db, "tidak-ada")).rejects.toBeInstanceOf(
      MeasurementNotFoundError
    )
  })
})
