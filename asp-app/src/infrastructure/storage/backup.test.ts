import "fake-indexeddb/auto"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  applyRestore,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  exportBackup,
  parseBackup,
  previewRestore,
  serializeBackup,
} from "./backup"
import { OpenAspDatabase } from "./db"
import {
  createChild,
  createMeasurement,
  listAllMeasurements,
  listChildren,
} from "./repositories/child-repository"

let source: OpenAspDatabase
let target: OpenAspDatabase
let counter = 0

beforeEach(() => {
  counter++
  source = new OpenAspDatabase(`openasp-backup-source-${counter}`)
  target = new OpenAspDatabase(`openasp-backup-target-${counter}`)
})

afterEach(async () => {
  source.close()
  target.close()
  await source.delete()
  await target.delete()
})

async function seed(db: OpenAspDatabase) {
  const a = await createChild(db, {
    name: "Anak Contoh A",
    birthDate: "2025-01-05",
    sex: "F",
    nik: "3300000000000001",
  })
  const b = await createChild(db, {
    name: "Anak Contoh B",
    birthDate: "2024-02-10",
    sex: "M",
    nik: null,
  })
  for (const [child, date, weight] of [
    [a, "2026-01-14", 9.8],
    [a, "2026-02-14", 10.1],
    [b, "2026-01-14", 10],
  ] as const) {
    await createMeasurement(db, child.id, {
      measuredAt: date,
      weightKg: weight,
      rawLengthHeightCm: 75,
      measurementPosition: "UNKNOWN",
      lilaCm: null,
      headCircumferenceCm: null,
      rowNote: null,
    })
  }
  return { a, b }
}

const text = async (db: OpenAspDatabase) =>
  new TextDecoder().decode(serializeBackup(await exportBackup(db)))

describe("exportBackup dan serializeBackup", () => {
  it("memuat format, versi, dan seluruh data", async () => {
    await seed(source)
    const backup = await exportBackup(source, () => "2026-11-13T10:00:00.000Z")
    expect(backup).toMatchObject({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: "2026-11-13T10:00:00.000Z",
    })
    expect(backup.data.children).toHaveLength(2)
    expect(backup.data.measurements).toHaveLength(3)
  })

  it("database kosong menghasilkan cadangan kosong yang sah", async () => {
    const parsed = parseBackup(await text(source))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(parsed.backup.data.children).toEqual([])
  })
})

describe("parseBackup", () => {
  it("menolak teks yang bukan JSON dan JSON yang bukan cadangan OpenASP", () => {
    expect(parseBackup("bukan json")).toMatchObject({ ok: false })
    expect(parseBackup(JSON.stringify({ hello: 1 }))).toMatchObject({
      ok: false,
      message: expect.stringContaining("bukan berkas cadangan OpenASP"),
    })
  })

  it("menolak cadangan dari versi yang lebih baru", () => {
    const future = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION + 1,
      exportedAt: "2026-01-01",
      data: { children: [], measurements: [] },
    }
    expect(parseBackup(JSON.stringify(future))).toMatchObject({
      ok: false,
      message: expect.stringContaining("versi OpenASP yang lebih baru"),
    })
  })

  it("catatan yang bentuknya rusak dilewati dan dihitung, bukan menggagalkan berkas", async () => {
    await seed(source)
    const backup = JSON.parse(await text(source))
    backup.data.children.push({ id: "x", name: "Rusak" }) // tanpa tanggal lahir dan sex
    backup.data.measurements.push({
      id: "m",
      childId: "x",
      measuredAt: "bukan",
    })
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.invalidRecords).toBe(2)
      expect(parsed.backup.data.children).toHaveLength(2)
    }
  })

  it("kolom tambahan dari versi lain dibawa apa adanya", async () => {
    await seed(source)
    const backup = JSON.parse(await text(source))
    backup.data.children[0].kolomBaru = "dipertahankan"
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok && parsed.backup.data.children[0]).toMatchObject({
      kolomBaru: "dipertahankan",
    })
  })
})

describe("pemulihan", () => {
  it("putaran penuh: data dari cadangan sama persis dengan aslinya di database kosong", async () => {
    await seed(source)
    const result = await previewRestore(target, await text(source))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plan.summary).toMatchObject({
      childrenNew: 2,
      measurementsNew: 3,
      childrenExisting: 0,
      childrenConflict: 0,
      measurementsExisting: 0,
      measurementsOrphan: 0,
    })
    await applyRestore(target, result.plan)

    const byName = (list: { name: string }[]) =>
      [...list].sort((x, y) => x.name.localeCompare(y.name))
    expect(byName(await listChildren(target))).toEqual(
      byName(await listChildren(source))
    )
    const sortById = <T extends { id: string }>(list: T[]) =>
      [...list].sort((x, y) => x.id.localeCompare(y.id))
    expect(sortById(await listAllMeasurements(target))).toEqual(
      sortById(await listAllMeasurements(source))
    )
  })

  it("memulihkan dua kali tidak menggandakan apa pun", async () => {
    await seed(source)
    const backupText = await text(source)
    const first = await previewRestore(target, backupText)
    if (!first.ok) throw new Error("harus ok")
    await applyRestore(target, first.plan)

    const second = await previewRestore(target, backupText)
    if (!second.ok) throw new Error("harus ok")
    expect(second.plan.summary).toMatchObject({
      childrenNew: 0,
      childrenExisting: 2,
      measurementsNew: 0,
      measurementsExisting: 3,
    })
    await applyRestore(target, second.plan)
    expect(await listChildren(target)).toHaveLength(2)
    expect(await listAllMeasurements(target)).toHaveLength(3)
  })

  it("tidak menimpa data yang sudah ada: anak dengan NIK sama tetapi ID berbeda dilewati", async () => {
    await seed(source)
    const existing = await createChild(target, {
      name: "Nama Lain di Perangkat Ini",
      birthDate: "2025-01-05",
      sex: "F",
      nik: "3300000000000001", // NIK sama dengan Anak Contoh A di cadangan
    })
    const result = await previewRestore(target, await text(source))
    if (!result.ok) throw new Error("harus ok")
    expect(result.plan.summary.childrenConflict).toBe(1)
    // Pengukuran anak yang bentrok tidak bisa dipulihkan (anaknya tidak masuk).
    expect(result.plan.summary.measurementsOrphan).toBe(2)
    await applyRestore(target, result.plan)

    const children = await listChildren(target)
    expect(children.map((c) => c.name).sort()).toEqual([
      "Anak Contoh B",
      "Nama Lain di Perangkat Ini",
    ])
    expect(children.find((c) => c.id === existing.id)?.name).toBe(
      "Nama Lain di Perangkat Ini"
    )
  })

  it("pengukuran pada tanggal yang sama untuk anak yang sama dilewati", async () => {
    const { b } = await seed(source)
    // Perangkat tujuan sudah punya anak yang sama (ID sama) dengan satu pengukuran di tanggal itu.
    await target.children.add((await source.children.get(b.id))!)
    await target.measurements.add({
      ...(await source.measurements.where("childId").equals(b.id).first())!,
      id: "pengukuran-lain",
    })
    const result = await previewRestore(target, await text(source))
    if (!result.ok) throw new Error("harus ok")
    expect(result.plan.summary.measurementsExisting).toBe(1)
  })
})
