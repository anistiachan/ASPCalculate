import { expect, test, type Page } from "@playwright/test"
import * as XLSX from "xlsx"

import { byLabel, historyRow, importSample } from "./helpers"

async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-13T10:00:00"))
}

async function importPsg(page: Page) {
  await freezeClock(page)
  await importSample(page, "contoh-psg-valid.xlsx")
  await page.getByRole("button", { name: /^Simpan \d+ anak/ }).click()
  await expect(page.getByText("Import selesai")).toBeVisible()
}

async function openFebruary(page: Page) {
  await page.goto("/lists")
  await byLabel(page, "Bulan").selectOption({ label: "Februari" })
  await byLabel(page, "Tahun").selectOption("2026")
}

/** Meniru petugas: mengisi BB baru, TB baru, dan tanggal ukur ulang pada baris anak tertentu. */
function fillRow(
  path: string,
  outPath: string,
  name: string,
  values: { weight: number; height: number; date: string }
) {
  const book = XLSX.readFile(path)
  const sheet = book.Sheets["Perlu diukur ulang"]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
  const index = rows.findIndex((row) => row[1] === name)
  expect(index, `baris ${name} ada di berkas`).toBeGreaterThan(0)
  const excelRow = index + 1
  sheet[`L${excelRow}`] = { t: "n", v: values.weight }
  sheet[`M${excelRow}`] = { t: "n", v: values.height }
  sheet[`N${excelRow}`] = { t: "s", v: values.date }
  XLSX.writeFile(book, outPath)
}

test.describe("PSG → status → ukur ulang → rekap P1", () => {
  test("impor PSG langsung menampilkan anak pendek dan sangat pendek", async ({
    page,
  }) => {
    await importPsg(page)
    await openFebruary(page)

    await expect(
      page.getByRole("button", { name: /^Pendek \(1\)$/ })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Sangat pendek \(1\)$/ })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /^Perlu diukur ulang · Februari 2026/ })
    ).toContainText("(2)")
  })

  test("setelah Simpan, halaman Import langsung menampilkan hasil pemeriksaan dan unduhan PSG", async ({
    page,
  }, testInfo) => {
    await importPsg(page)

    await expect(
      page.getByRole("heading", { name: "Hasil pemeriksaan · Februari 2026" })
    ).toBeVisible()
    await expect(
      page.getByText(/4 anak diperiksa, 2 perlu perhatian/)
    ).toBeVisible()
    // Hanya anak yang perlu perhatian yang dicantumkan: B pendek, C sangat pendek.
    await expect(page.getByRole("link", { name: "Anak PSG B" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Anak PSG C" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Anak PSG A" })).toHaveCount(0)

    const download = page.waitForEvent("download")
    await page
      .getByRole("button", { name: /^Unduh hasil PSG dengan z-score/ })
      .click()
    const file = await download
    expect(file.suggestedFilename()).toBe("psg-hasil-2026-02.xlsx")
    const path = testInfo.outputPath("psg-hasil.xlsx")
    await file.saveAs(path)

    const sheet = XLSX.readFile(path).Sheets["PSG"]
    expect(sheet["C9"].v).toBe("Anak PSG A")
    expect(sheet["Q9"].v).toBe("Normal")
    expect(typeof sheet["N9"].v).toBe("number")
    expect(sheet["C10"].v).toBe("Anak PSG B")
    expect(sheet["Q10"].v).toBe("Pendek")
    expect(sheet["U10"].v).toBe("YA")
    expect(sheet["Q11"].v).toBe("Sangat pendek")
  })

  test("hasil pemeriksaan memberi tahu data yang dicurigai salah (TB 814 cm)", async ({
    page,
  }) => {
    await freezeClock(page)
    await importSample(page, "contoh-psg-bermasalah.xlsx")
    await page.getByRole("button", { name: /^Simpan \d+ anak/ }).click()
    await expect(page.getByText("Import selesai")).toBeVisible()

    await expect(
      page.getByText(/3 anak diperiksa, 2 perlu perhatian/)
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Anak Salah Ketik TB" })
    ).toBeVisible()
    await expect(page.getByText(/814 cm di luar rentang wajar/)).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Unduh daftar ukur ulang/ })
    ).toBeEnabled()
  })

  test("semua yang diukur tampil dengan z-score dan status, termasuk yang normal", async ({
    page,
  }) => {
    await importPsg(page)
    await openFebruary(page)
    await page
      .getByRole("button", { name: /^Semua yang diukur \(4\)$/ })
      .click()
    await expect(
      page.getByRole("heading", { name: "Semua yang diukur · Februari 2026" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Anak PSG A" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Anak PSG D" })).toBeVisible()
  })

  test("unduhan format PSG berisi z-score, status, dan penanda perlu dicek", async ({
    page,
  }, testInfo) => {
    await importPsg(page)
    await openFebruary(page)

    const download = page.waitForEvent("download")
    await page
      .getByRole("button", { name: /^Unduh format PSG dengan z-score/ })
      .click()
    const file = await download
    expect(file.suggestedFilename()).toBe("psg-2026-02.xlsx")
    const path = testInfo.outputPath("psg.xlsx")
    await file.saveAs(path)

    const sheet = XLSX.readFile(path).Sheets["PSG"]
    // Urutan: JERUK (A, B) lalu PEPAYA (C, D), mulai baris 9.
    expect(sheet["C9"].v).toBe("Anak PSG A")
    expect(sheet["Q9"].v).toBe("Normal")
    expect(sheet["U9"]).toBeUndefined()

    expect(sheet["C10"].v).toBe("Anak PSG B")
    expect(sheet["Q10"].v).toBe("Pendek")
    expect(typeof sheet["N10"].v).toBe("number")
    expect(sheet["U10"].v).toBe("YA")
    expect(sheet["AI10"].v).toContain("TB/U: Pendek")

    expect(sheet["C11"].v).toBe("Anak PSG C")
    expect(sheet["Q11"].v).toBe("Sangat pendek")
    expect(sheet["U11"].v).toBe("YA")
  })

  test("daftar ukur ulang diunduh, diisi petugas, diimpor lagi, lalu masuk rekap P1", async ({
    page,
  }, testInfo) => {
    await importPsg(page)
    await openFebruary(page)

    // 1. Unduh daftar tindak lanjut.
    const recheckDownload = page.waitForEvent("download")
    await page
      .getByRole("button", {
        name: "Unduh daftar ukur ulang (memuat nama anak)",
      })
      .click()
    const downloaded = await recheckDownload
    expect(downloaded.suggestedFilename()).toBe("ukur-ulang-2026-02.xlsx")
    const original = testInfo.outputPath("ukur-ulang.xlsx")
    await downloaded.saveAs(original)

    // 2. Petugas mengisi hasil ukur ulang: B wajar, C berubah drastis (perlu konfirmasi).
    const filled = testInfo.outputPath("ukur-ulang-terisi.xlsx")
    fillRow(original, filled, "Anak PSG B", {
      weight: 10.4,
      height: 80.6,
      date: "2026-02-24",
    })
    const stage = testInfo.outputPath("ukur-ulang-terisi-2.xlsx")
    fillRow(filled, stage, "Anak PSG C", {
      weight: 9,
      height: 76,
      date: "2026-02-25",
    })

    // 3. Impor kembali: pratinjau menampilkan status semula dan hasil ukur ulang.
    await byLabel(page, "Berkas hasil ukur ulang").setInputFiles(stage)
    await expect(page.getByText("2 baris siap disimpan")).toBeVisible()
    await expect(page.getByText("TB/U semula")).toBeVisible()
    await expect(page.getByText("TB/U hasil ukur ulang")).toBeVisible()

    // Baris C berubah jauh: wajib dikonfirmasi, sehingga awalnya hanya 1 yang bisa disimpan.
    await expect(
      page.getByRole("button", { name: "Simpan 1 hasil ukur ulang" })
    ).toBeVisible()
    await page.getByRole("checkbox", { name: /Saya sudah memastikan/ }).check()
    await page
      .getByRole("button", { name: "Simpan 2 hasil ukur ulang" })
      .click()
    await expect(page.getByText("2 pengukuran baru tersimpan.")).toBeVisible()

    // 4. Ukuran lama tidak hilang: riwayat anak B memuat dua pengukuran.
    await page.goto("/children")
    await page.getByRole("link", { name: "Anak PSG B" }).first().click()
    await expect(historyRow(page, /14 Feb 2026/)).toBeVisible()
    await expect(historyRow(page, /24 Feb 2026/)).toBeVisible()

    // 5. Rekap P1 memuat angka hasil ukur ulang (pengukuran terakhir bulan itu).
    await openFebruary(page)
    const p1Download = page.waitForEvent("download")
    await page
      .getByRole("button", {
        name: "Unduh rekap P1 (memuat nama dan tanggal lahir)",
      })
      .click()
    const p1 = await p1Download
    expect(p1.suggestedFilename()).toBe("rekap-p1-2026.xlsx")
    const p1Path = testInfo.outputPath("rekap-p1.xlsx")
    await p1.saveAs(p1Path)
    const book = XLSX.readFile(p1Path)
    expect(book.SheetNames).toEqual(["P1", "P2", "Catatan"])
    // JERUK: A di baris 9, B di baris 10. BB/TB Februari ada di kolom AH/AI.
    expect(book.Sheets["P1"]["N10"].v).toBe("Anak PSG B")
    expect(book.Sheets["P1"]["AH10"].v).toBe(10.4)
    expect(book.Sheets["P1"]["AI10"].v).toBe(80.6)
    expect(book.Sheets["P1"]["AH10"].c?.[0].t).toContain("Ukuran semula")
  })

  test("berkas ukur ulang tanpa tanggal ditolak per baris, tanpa menyimpan apa pun", async ({
    page,
  }, testInfo) => {
    await importPsg(page)
    await openFebruary(page)

    const download = page.waitForEvent("download")
    await page
      .getByRole("button", {
        name: "Unduh daftar ukur ulang (memuat nama anak)",
      })
      .click()
    const original = testInfo.outputPath("ukur-ulang.xlsx")
    await (await download).saveAs(original)

    // Petugas mengisi angka tetapi lupa tanggal.
    const book = XLSX.readFile(original)
    const sheet = book.Sheets["Perlu diukur ulang"]
    sheet["L2"] = { t: "n", v: 10.4 }
    sheet["M2"] = { t: "n", v: 80.6 }
    const bad = testInfo.outputPath("tanpa-tanggal.xlsx")
    XLSX.writeFile(book, bad)

    await byLabel(page, "Berkas hasil ukur ulang").setInputFiles(bad)
    await expect(page.getByText("0 baris siap disimpan")).toBeVisible()
    await expect(page.getByText("Tgl ukur ulang wajib diisi")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Simpan 0 hasil ukur ulang" })
    ).toBeDisabled()
  })

  test("template PSG diunduh, diisi petugas, lalu diimpor", async ({
    page,
  }, testInfo) => {
    await freezeClock(page)
    await page.goto("/import")

    const download = page.waitForEvent("download")
    await page
      .getByRole("button", { name: "Unduh template PSG bulanan" })
      .click()
    const file = await download
    expect(file.suggestedFilename()).toBe("template-psg.xlsx")
    const template = testInfo.outputPath("template-psg.xlsx")
    await file.saveAs(template)

    const book = XLSX.readFile(template)
    const sheet = book.Sheets["PSG"]
    const cells: Record<string, string | number> = {
      C9: "Anak Template",
      D9: 1,
      E9: 14,
      F9: 2,
      G9: 26,
      H9: 10,
      I9: 2,
      J9: 24,
      L9: 10,
      M9: 79,
      AG9: "JERUK",
    }
    for (const [address, value] of Object.entries(cells)) {
      sheet[address] =
        typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value }
    }
    sheet["!ref"] = "A1:AG9"
    const filled = testInfo.outputPath("template-psg-terisi.xlsx")
    XLSX.writeFile(book, filled)

    await byLabel(page, "File Excel").setInputFiles(filled)
    await expect(
      page.getByText("Pratinjau: template-psg-terisi.xlsx")
    ).toBeVisible()
    await page.getByRole("button", { name: /^Simpan 1 anak/ }).click()
    await expect(page.getByText("Import selesai")).toBeVisible()
  })

  test("contoh PSG bermasalah: pratinjau menampilkan error per baris dan peringatan TB 814", async ({
    page,
  }) => {
    await freezeClock(page)
    await importSample(page, "contoh-psg-bermasalah.xlsx")
    await expect(
      page.getByText("Ada baris yang tidak bisa diimpor")
    ).toBeVisible()
    await expect(page.getByText("Nama Posyandu kosong.")).toBeVisible()
    await expect(
      page.getByText(/Jenis kelamin: harus 1 \(laki-laki\) atau 2/)
    ).toBeVisible()
    await expect(page.getByText(/814 cm di luar rentang wajar/)).toBeVisible()
  })

  test("template sheet Posyandu (P1) tersedia untuk diunduh", async ({
    page,
  }, testInfo) => {
    await page.goto("/import")
    const download = page.waitForEvent("download")
    await page
      .getByRole("button", { name: "Unduh template sheet Posyandu (P1)" })
      .click()
    const file = await download
    expect(file.suggestedFilename()).toBe("template-posyandu-p1.xlsx")
    const path = testInfo.outputPath("template-p1.xlsx")
    await file.saveAs(path)
    expect(XLSX.readFile(path).SheetNames).toEqual(["P1", "Petunjuk"])
  })

  test("berkas yang bukan daftar ukur ulang ditolak dengan pesan jelas", async ({
    page,
  }) => {
    await importPsg(page)
    await openFebruary(page)
    await byLabel(page, "Berkas hasil ukur ulang").setInputFiles(
      "samples/contoh-karangtawar.xlsx"
    )
    await expect(
      page.getByText('Sheet "Perlu diukur ulang" tidak ditemukan')
    ).toBeVisible()
  })
})
