import { expect, test, type Page } from "@playwright/test"

import { byLabel, importAndSaveValidSample, importSample } from "./helpers"

async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-13T10:00:00"))
}

async function selectMonth(page: Page, month: string) {
  await byLabel(page, "Bulan").selectOption({ label: month })
  await byLabel(page, "Tahun").selectOption("2026")
}

async function importKarangtawar(page: Page) {
  await freezeClock(page)
  await importSample(page, "contoh-karangtawar.xlsx")
  await page.getByRole("button", { name: /^Simpan \d+ anak/ }).click()
  await expect(page.getByText("Import selesai")).toBeVisible()
}

const listButton = (page: Page, title: string) =>
  page.getByRole("button", { name: new RegExp(`^${title} \\(\\d+\\)$`) })

/** Baris data pada kartu daftar (tanpa baris judul). */
const dataRows = (page: Page) =>
  page
    .locator("[data-slot=card]")
    .filter({ has: page.getByRole("heading", { level: 2 }) })
    .first()
    .getByRole("row")

test.describe("daftar balita (menu workbook)", () => {
  test("tanpa data: mengajak menambah atau mengimpor", async ({ page }) => {
    await freezeClock(page)
    await page.goto("/lists")
    await expect(page.getByText("Belum ada data balita")).toBeVisible()
  })

  test("Juni 2026 (data Bu Bidan): jumlah tiap daftar sesuai status gizi", async ({
    page,
  }) => {
    await freezeClock(page)
    await importAndSaveValidSample(page)
    await page.goto("/lists")
    await selectMonth(page, "Juni")

    await expect(page.getByText("Hasil masih dalam tahap uji")).toBeVisible()
    // Rekap Juni: TB/U 2 sangat pendek dan 7 pendek, tidak ada BGM maupun gemuk.
    await expect(listButton(page, "Sangat pendek")).toContainText("(2)")
    await expect(listButton(page, "Pendek")).toContainText("(7)")
    await expect(listButton(page, "BGM")).toContainText("(0)")
    await expect(listButton(page, "Gemuk")).toContainText("(0)")
    await expect(listButton(page, "Balita bermasalah")).toContainText("(9)")
  })

  test("memilih daftar menampilkan anggota beserta tautan ke detail", async ({
    page,
  }) => {
    await freezeClock(page)
    await importAndSaveValidSample(page)
    await page.goto("/lists")
    await selectMonth(page, "Juni")

    await listButton(page, "Sangat pendek").click()
    await expect(listButton(page, "Sangat pendek")).toHaveAttribute(
      "aria-pressed",
      "true"
    )
    await expect(
      page.getByRole("heading", { name: "Sangat pendek · Juni 2026" })
    ).toBeVisible()
    // 1 baris judul + 2 anak.
    await expect(dataRows(page)).toHaveCount(3)

    await dataRows(page).nth(1).getByRole("link").click()
    await expect(page).toHaveURL(/\/children\/[^/]+$/)
  })

  test("daftar kosong dijelaskan dengan kalimat, bukan tabel kosong", async ({
    page,
  }) => {
    await freezeClock(page)
    await importAndSaveValidSample(page)
    await page.goto("/lists")
    await selectMonth(page, "Juni")
    await listButton(page, "BGM").click()
    await expect(
      page.getByText(
        "Tidak ada balita pada daftar ini untuk bulan yang dipilih."
      )
    ).toBeVisible()
  })

  test("unduh Excel: nama berkas dan peringatan memuat nama anak", async ({
    page,
  }) => {
    await freezeClock(page)
    await importAndSaveValidSample(page)
    await page.goto("/lists")
    await selectMonth(page, "Juni")

    const downloadPromise = page.waitForEvent("download")
    await page
      .getByRole("button", { name: "Unduh Excel (memuat nama anak)" })
      .click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe("daftar-2026-06.xlsx")
  })
})

test.describe("sasaran Vitamin A dan ASI (data Karangtawar)", () => {
  test("Februari 2026: sasaran biru, merah, dan ASI sesuai umur dan isian", async ({
    page,
  }) => {
    await importKarangtawar(page)
    await page.goto("/lists")
    await selectMonth(page, "Februari")

    // Umur Februari 2026: B 8 bln (biru); A, C, D, F berumur 12 bulan atau lebih (merah);
    // E 4 bln (ASI).
    await expect(listButton(page, "Sasaran Vitamin A biru")).toContainText(
      "(1)"
    )
    await expect(listButton(page, "Sasaran Vitamin A merah")).toContainText(
      "(4)"
    )
    await expect(listButton(page, "Sasaran ASI eksklusif")).toContainText("(1)")

    await listButton(page, "Sasaran Vitamin A merah").click()
    // A sudah menerima; C, D, F belum tercatat.
    await expect(page.getByRole("cell", { name: "Sudah" })).toHaveCount(1)
    await expect(
      page.getByRole("cell", { name: "Belum tercatat" })
    ).toHaveCount(3)

    await listButton(page, "Sasaran ASI eksklusif").click()
    await expect(
      page.getByRole("cell", { name: "Ya", exact: true })
    ).toHaveCount(1)
  })

  test("saringan Posyandu mempersempit daftar sasaran", async ({ page }) => {
    await importKarangtawar(page)
    await page.goto("/lists")
    await selectMonth(page, "Februari")
    await byLabel(page, "Posyandu").selectOption("JERUK")

    // JERUK: A, C, D (merah) dan B (biru); tidak ada anak ASI (E ada di PEPAYA).
    await expect(listButton(page, "Sasaran Vitamin A biru")).toContainText(
      "(1)"
    )
    await expect(listButton(page, "Sasaran Vitamin A merah")).toContainText(
      "(3)"
    )
    await expect(listButton(page, "Sasaran ASI eksklusif")).toContainText("(0)")

    const downloadPromise = page.waitForEvent("download")
    await page
      .getByRole("button", { name: "Unduh Excel (memuat nama anak)" })
      .click()
    expect((await downloadPromise).suggestedFilename()).toBe(
      "daftar-2026-02-jeruk.xlsx"
    )
  })
})

test.describe("tata letak di layar HP", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  test("/lists: halaman tidak bergulir ke samping", async ({ page }) => {
    await freezeClock(page)
    await importAndSaveValidSample(page)
    await page.goto("/lists")
    await selectMonth(page, "Juni")
    await listButton(page, "Pendek").click()
    await expect(
      page.getByRole("heading", { name: "Pendek · Juni 2026" })
    ).toBeVisible()
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)
  })
})
