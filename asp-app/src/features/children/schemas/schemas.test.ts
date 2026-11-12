import { describe, expect, it } from "vitest"

import {
  createChildFormSchema,
  toChildInput,
  type ChildFormInput,
} from "./child-form.schema"
import {
  createMeasurementFormSchema,
  toMeasurementInput,
  type MeasurementFormInput,
} from "./measurement-form.schema"

const TODAY = "2026-11-12"

describe("createChildFormSchema", () => {
  const schema = createChildFormSchema(TODAY)
  const valid: ChildFormInput = {
    name: "  Anak Uji  ",
    birthDate: "2025-03-15",
    sex: "F",
    nik: "",
  }
  const messages = (input: ChildFormInput) => {
    const result = schema.safeParse(input)
    return result.success ? [] : result.error.issues.map((i) => i.message)
  }

  it("menerima data valid, merapikan nama, dan NIK kosong menjadi null", () => {
    const parsed = schema.parse(valid)
    expect(parsed).toMatchObject({ name: "Anak Uji", sex: "F", nik: "" })
    expect(toChildInput(parsed)).toEqual({
      name: "Anak Uji",
      birthDate: "2025-03-15",
      sex: "F",
      nik: null,
    })
  })

  it("menerima NIK 16 digit dan membuang spasi", () => {
    const parsed = schema.parse({ ...valid, nik: "3200 0000 0000 0001" })
    expect(toChildInput(parsed).nik).toBe("3200000000000001")
  })

  it("menolak NIK yang bukan 16 digit", () => {
    expect(messages({ ...valid, nik: "123" })).toContain(
      "NIK harus 16 digit angka."
    )
    expect(messages({ ...valid, nik: "32000000000000AB" })).toContain(
      "NIK harus 16 digit angka."
    )
  })

  it("menolak nama kosong atau terlalu panjang", () => {
    expect(messages({ ...valid, name: "   " })).toContain("Nama wajib diisi.")
    expect(messages({ ...valid, name: "x".repeat(101) })).toContain(
      "Nama maksimal 100 karakter."
    )
  })

  it("menolak jenis kelamin yang belum dipilih", () => {
    expect(messages({ ...valid, sex: "" })).toContain("Pilih jenis kelamin.")
    expect(messages({ ...valid, sex: "X" })).toContain("Pilih jenis kelamin.")
  })

  it("menolak tanggal lahir kosong, tidak ada di kalender, atau di masa depan", () => {
    expect(messages({ ...valid, birthDate: "" })).toContain(
      "Tanggal lahir wajib diisi."
    )
    expect(messages({ ...valid, birthDate: "2025-02-31" })).toContain(
      "Tanggal lahir tidak valid."
    )
    expect(messages({ ...valid, birthDate: "2026-11-13" })).toContain(
      "Tanggal lahir tidak boleh di masa depan."
    )
  })

  it("menerima tanggal lahir hari ini", () => {
    expect(messages({ ...valid, birthDate: TODAY })).toEqual([])
  })
})

describe("createMeasurementFormSchema", () => {
  const schema = createMeasurementFormSchema({
    birthDate: "2025-03-15",
    today: TODAY,
  })
  const valid: MeasurementFormInput = {
    measuredAt: "2026-06-12",
    weightKg: "12,4",
    heightCm: "88.5",
    position: "STANDING",
    lilaCm: "",
    headCm: "",
    note: "",
  }
  const issues = (input: MeasurementFormInput) => {
    const result = schema.safeParse(input)
    return result.success
      ? []
      : result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }))
  }

  it("menerima data valid dengan koma atau titik desimal", () => {
    const parsed = schema.parse(valid)
    expect(toMeasurementInput(parsed)).toEqual({
      measuredAt: "2026-06-12",
      weightKg: 12.4,
      rawLengthHeightCm: 88.5,
      measurementPosition: "STANDING",
      lilaCm: null,
      headCircumferenceCm: null,
      rowNote: null,
    })
  })

  it("kolom opsional kosong menjadi null, bukan nol", () => {
    const parsed = schema.parse({ ...valid, lilaCm: "  ", headCm: "" })
    expect(parsed.lilaCm).toBeNull()
    expect(parsed.headCm).toBeNull()
  })

  it("membawa catatan yang sudah dirapikan", () => {
    const parsed = schema.parse({ ...valid, note: "  anak rewel  " })
    expect(toMeasurementInput(parsed).rowNote).toBe("anak rewel")
  })

  it("menolak tanggal sebelum lahir, di masa depan, kosong, dan tidak valid", () => {
    expect(issues({ ...valid, measuredAt: "2025-03-14" })).toContainEqual({
      path: "measuredAt",
      message: "Tanggal ukur tidak boleh lebih awal dari tanggal lahir.",
    })
    expect(issues({ ...valid, measuredAt: "2026-11-13" })).toContainEqual({
      path: "measuredAt",
      message: "Tanggal ukur tidak boleh di masa depan.",
    })
    expect(issues({ ...valid, measuredAt: "" })).toContainEqual({
      path: "measuredAt",
      message: "Tanggal ukur wajib diisi.",
    })
    expect(issues({ ...valid, measuredAt: "2026-02-30" })).toContainEqual({
      path: "measuredAt",
      message: "Tanggal ukur tidak valid.",
    })
  })

  it("menerima tanggal ukur tepat pada tanggal lahir dan hari ini", () => {
    expect(issues({ ...valid, measuredAt: "2025-03-15" })).toEqual([])
    expect(issues({ ...valid, measuredAt: TODAY })).toEqual([])
  })

  it("menolak angka yang bukan angka, nol, dan negatif", () => {
    expect(issues({ ...valid, weightKg: "abc" })[0]).toMatchObject({
      path: "weightKg",
    })
    expect(issues({ ...valid, weightKg: "0" })).toContainEqual({
      path: "weightKg",
      message: "Berat harus lebih dari nol.",
    })
    expect(issues({ ...valid, heightCm: "-5" })).toContainEqual({
      path: "heightCm",
      message: "Panjang/tinggi harus lebih dari nol.",
    })
    expect(issues({ ...valid, weightKg: "1,234.5" })[0]).toMatchObject({
      path: "weightKg",
    })
  })

  it("mewajibkan berat atau tinggi (minimal salah satu)", () => {
    expect(issues({ ...valid, weightKg: "", heightCm: "" })).toContainEqual({
      path: "weightKg",
      message: "Isi berat atau panjang/tinggi.",
    })
    expect(
      issues({ ...valid, weightKg: "", heightCm: "", position: "" })
    ).not.toContainEqual(expect.objectContaining({ path: "position" }))
  })

  it("hanya berat tanpa tinggi diterima dan tidak butuh cara ukur", () => {
    const parsed = schema.parse({
      ...valid,
      heightCm: "",
      position: "",
    })
    expect(toMeasurementInput(parsed)).toMatchObject({
      weightKg: 12.4,
      rawLengthHeightCm: null,
      measurementPosition: "UNKNOWN",
    })
  })

  it("mewajibkan cara ukur bila tinggi diisi, tetapi 'Tidak diketahui' diterima", () => {
    expect(issues({ ...valid, position: "" })).toContainEqual({
      path: "position",
      message: "Pilih cara ukur, atau 'Tidak diketahui'.",
    })
    expect(issues({ ...valid, position: "UNKNOWN" })).toEqual([])
  })

  it("menolak cara ukur di luar pilihan dan catatan terlalu panjang", () => {
    expect(issues({ ...valid, position: "SITTING" })[0]).toMatchObject({
      path: "position",
    })
    expect(issues({ ...valid, note: "x".repeat(201) })).toContainEqual({
      path: "note",
      message: "Catatan maksimal 200 karakter.",
    })
  })
})
