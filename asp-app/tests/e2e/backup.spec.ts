import { expect, test, type Page } from "@playwright/test"

import { byLabel, importSample } from "./helpers"

async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-13T10:00:00"))
}

test.describe("cadangkan dan pulihkan data", () => {
  test("data dicadangkan di satu browser lalu dipulihkan di browser kosong", async ({
    page,
    browser,
  }, testInfo) => {
    // 1. Browser A: impor data, lalu unduh cadangan.
    await freezeClock(page)
    await importSample(page, "contoh-psg-valid.xlsx")
    await page.getByRole("button", { name: /^Simpan \d+ anak/ }).click()
    await expect(page.getByText("Import selesai")).toBeVisible()

    await page.goto("/settings")
    await expect(
      page.getByText(/Berisi 4 anak dan 4 pengukuran\./)
    ).toBeVisible()
    const download = page.waitForEvent("download")
    await page.getByRole("button", { name: /^Unduh cadangan data/ }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe("openasp-cadangan-2026-11-13.json")
    const backupPath = testInfo.outputPath("cadangan.json")
    await file.saveAs(backupPath)

    // 2. Browser B (kosong, seperti setelah data situs dihapus): pulihkan.
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      locale: "id-ID",
    })
    try {
      const fresh = await context.newPage()
      await freezeClock(fresh)
      await fresh.goto("/settings")
      await expect(
        fresh.getByText("Belum ada data untuk dicadangkan.")
      ).toBeVisible()

      await byLabel(fresh, "Berkas cadangan").setInputFiles(backupPath)
      await expect(
        fresh.getByText(/Akan ditambahkan: 4 anak dan 4 pengukuran/)
      ).toBeVisible()
      await fresh
        .getByRole("button", { name: "Pulihkan 4 anak dan 4 pengukuran" })
        .click()
      await expect(fresh.getByText("Pemulihan selesai")).toBeVisible()

      await fresh.goto("/children")
      await expect(fresh.getByText("Menampilkan 4 dari 4 balita")).toBeVisible()
      await expect(
        fresh.getByRole("link", { name: "Anak PSG B" }).first()
      ).toBeVisible()

      // 3. Memulihkan berkas yang sama lagi tidak menggandakan apa pun.
      await fresh.goto("/settings")
      await byLabel(fresh, "Berkas cadangan").setInputFiles(backupPath)
      await expect(
        fresh.getByText(/Tidak ada data baru untuk dipulihkan/)
      ).toBeVisible()
      await expect(
        fresh.getByRole("button", { name: "Pulihkan 0 anak dan 0 pengukuran" })
      ).toBeDisabled()
      await expect(fresh.getByText("4 anak sudah ada")).toBeVisible()
    } finally {
      await context.close()
    }
  })

  test("berkas yang bukan cadangan ditolak dengan pesan jelas", async ({
    page,
  }) => {
    await page.goto("/settings")
    await byLabel(page, "Berkas cadangan").setInputFiles(
      "samples/contoh-psg-valid.xlsx"
    )
    await expect(page.getByText("Berkas bukan JSON yang valid.")).toBeVisible()
  })
})
