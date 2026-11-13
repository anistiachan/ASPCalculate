import { expect, test, type Page } from "@playwright/test"

import { byLabel, importSample } from "./helpers"

/**
 * Format ASP Karangtawar: samples/contoh-karangtawar.xlsx (sintetis). 6 anak di Posyandu
 * JERUK (4) dan PEPAYA (2), penimbangan Januari–Maret 2026. Angka SKDN dihitung tangan di
 * src/test/samples.test.ts.
 */
async function importKarangtawar(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-13T10:00:00"))
  await importSample(page, "contoh-karangtawar.xlsx")
  await page.getByRole("button", { name: /^Simpan \d+ anak/ }).click()
  await expect(page.getByText("Import selesai")).toBeVisible()
}

const skdnTotal = async (page: Page, code: string) => {
  const row = page
    .locator("[data-slot=card]")
    .filter({ hasText: "Penimbangan dan kenaikan berat badan" })
    .getByRole("row", { name: new RegExp(`^${code} `) })
  return Number(await row.locator("td").last().innerText())
}

async function openReport(page: Page, month: string) {
  await page.goto("/reports")
  await byLabel(page, "Bulan").selectOption({ label: month })
  await byLabel(page, "Tahun").selectOption("2026")
  await expect(
    page.getByRole("heading", { name: `Rekap ${month} 2026` })
  ).toBeVisible()
}

test.describe("import ASP Karangtawar", () => {
  test("pratinjau mengenali format dan melewati sheet hitungan", async ({
    page,
  }) => {
    await importSample(page, "contoh-karangtawar.xlsx")
    await expect(
      page.getByText(/Sheet "SKDN" dilewati: Sheet hitungan.laporan workbook/)
    ).toBeVisible()
    await expect(
      page.getByText(/Sheet "P3" dilewati: Belum ada data anak/)
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Simpan 6 anak/ })
    ).toBeVisible()
  })

  test("anak tersimpan beserta Posyandu, tanpa NIK", async ({ page }) => {
    await importKarangtawar(page)
    await page.goto("/children")
    await expect(page.getByText("Menampilkan 6 dari 6 balita")).toBeVisible()
    await page
      .getByRole("link", { name: /Anak Contoh A/ })
      .first()
      .click()
    await expect(page.getByText("JERUK")).toBeVisible()
    await expect(page.getByText("Tidak diisi").first()).toBeVisible()
  })

  test("laporan Februari 2026: SKDN draf semua Posyandu", async ({ page }) => {
    await importKarangtawar(page)
    await openReport(page, "Februari")
    expect(await skdnTotal(page, "D")).toBe(5)
    expect(await skdnTotal(page, "N")).toBe(2)
    expect(await skdnTotal(page, "T")).toBe(2)
    expect(await skdnTotal(page, "B")).toBe(1)
  })

  test("saringan Posyandu mempersempit laporan dan nama berkas Excel", async ({
    page,
  }) => {
    await importKarangtawar(page)
    await openReport(page, "Februari")
    await byLabel(page, "Posyandu").selectOption("JERUK")

    expect(await skdnTotal(page, "D")).toBe(3)
    expect(await skdnTotal(page, "N")).toBe(1)
    expect(await skdnTotal(page, "T")).toBe(1)
    expect(await skdnTotal(page, "B")).toBe(1)

    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Unduh Excel" }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe("rekap-2026-02-jeruk.xlsx")
  })

  test("data tanpa Posyandu: saringan tidak ditampilkan", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-11-13T10:00:00"))
    await importSample(page)
    await page.getByRole("button", { name: /^Simpan \d+ anak/ }).click()
    await expect(page.getByText("Import selesai")).toBeVisible()
    await page.goto("/reports")
    await expect(
      page.getByRole("heading", { name: "Rekap November 2026" })
    ).toBeVisible()
    await expect(byLabel(page, "Posyandu")).toHaveCount(0)
  })
})
