import { expect, test, type Page } from "@playwright/test"
import * as XLSX from "xlsx"

import { byLabel, importAndSaveValidSample } from "./helpers"

/**
 * Data contoh (samples/contoh-bu-bidan-valid.xlsx) bertanggal Januari, Juni, dan September
 * 2026. Jam browser dibekukan agar "bulan ini" tetap November 2026 dan tes tidak rapuh
 * terhadap tanggal sebenarnya.
 */
async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-13T10:00:00"))
}

async function openWithSampleData(page: Page, path: string) {
  await freezeClock(page)
  await importAndSaveValidSample(page)
  await page.goto(path)
}

const card = (page: Page, text: string | RegExp) =>
  page.locator("[data-slot=card]").filter({ hasText: text })

test.describe("dashboard", () => {
  test("tanpa data: mengajak menambah atau mengimpor", async ({ page }) => {
    await freezeClock(page)
    await page.goto("/dashboard")
    await expect(page.getByText("Belum ada data balita")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Tambah balita" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Import Excel" }).last()
    ).toBeVisible()
  })

  test("kartu angka menghitung dari data tersimpan", async ({ page }) => {
    await openWithSampleData(page, "/dashboard")

    // Kartu angka dikenali dari awal teksnya: frasa yang sama juga muncul di kartu lain.
    const stat = (label: string) =>
      page
        .locator("[data-slot=card][data-size=sm]")
        .filter({ hasText: new RegExp(`^${label}`) })

    // 10 anak; November 2026: 8 berumur < 60 bulan pada awal bulan; belum ada yang ditimbang.
    await expect(stat("Balita terdata")).toContainText("10")
    await expect(stat("Balita 0–59 bulan")).toContainText("8")
    await expect(stat("Ditimbang bulan ini")).toContainText("0%")
    await expect(stat("Belum pernah diukur")).toContainText("0")
  })

  test("grafik menyajikan angka per bulan lewat label, tabel, dan fokus keyboard", async ({
    page,
  }) => {
    await openWithSampleData(page, "/dashboard")

    // Setiap bulan punya nama aksesibel yang memuat nilainya (bukan hanya tooltip).
    await expect(
      page.getByRole("img", {
        name: "Juni 2026: 9 balita ditimbang dari 9 terdata",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("img", {
        name: "September 2026: 8 balita ditimbang dari 8 terdata",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("img", {
        name: "Oktober 2026: 0 balita ditimbang dari 8 terdata",
      })
    ).toBeVisible()
    // Deret 12 bulan: Desember 2025 sampai November 2026.
    await expect(
      page.getByRole("img", { name: /^Desember 2025:/ })
    ).toBeVisible()
    await expect(
      page.getByRole("img", { name: /^November 2026:/ })
    ).toBeVisible()
    await expect(
      page.getByRole("img", { name: /^November 2025:/ })
    ).toHaveCount(0)

    // Tooltip muncul saat fokus keyboard (sama seperti hover).
    await page.getByRole("img", { name: /^Juni 2026:/ }).focus()
    await expect(
      page.getByText("9 balita ditimbang", { exact: true })
    ).toBeVisible()
    await expect(page.getByText(/dari 9 terdata · 100%/)).toBeVisible()

    // Tabel pendamping memuat semua nilai.
    await page.getByText("Lihat data sebagai tabel").click()
    const june = page.getByRole("row", { name: /^Juni 2026/ })
    await expect(june).toContainText("9")
    await expect(june).toContainText("100%")
  })

  test("status gizi bulan ini kosong dijelaskan, bukan angka nol palsu", async ({
    page,
  }) => {
    await openWithSampleData(page, "/dashboard")
    await expect(
      page.getByRole("heading", { name: "Status gizi November 2026" })
    ).toBeVisible()
    await expect(page.getByText("Belum ada anak yang dinilai.")).toHaveCount(4)
    await expect(page.getByText("Hasil masih dalam tahap uji")).toBeVisible()
  })

  test("tautan ke laporan lengkap", async ({ page }) => {
    await openWithSampleData(page, "/dashboard")
    await page.getByRole("link", { name: "Lihat laporan lengkap" }).click()
    await expect(page).toHaveURL(/\/reports$/)
    await expect(
      page.getByRole("heading", { level: 1, name: "Laporan" })
    ).toBeVisible()
  })
})

test.describe("laporan bulanan", () => {
  async function selectMonth(page: Page, month: string, year: string) {
    await byLabel(page, "Bulan").selectOption({ label: month })
    await byLabel(page, "Tahun").selectOption(year)
  }

  test("tanpa data: mengajak menambah atau mengimpor", async ({ page }) => {
    await freezeClock(page)
    await page.goto("/reports")
    await expect(
      page.getByText("Belum ada data untuk dilaporkan")
    ).toBeVisible()
  })

  test("bulan berjalan menjadi pilihan awal, dengan pilihan cepat bulan ini dan bulan lalu", async ({
    page,
  }) => {
    await openWithSampleData(page, "/reports")
    await expect(
      page.getByRole("heading", { name: "Rekap November 2026" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Bulan ini" })
    ).toHaveAttribute("aria-pressed", "true")

    await page.getByRole("button", { name: "Bulan lalu" }).click()
    await expect(
      page.getByRole("heading", { name: "Rekap Oktober 2026" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Bulan lalu" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  test("Juni 2026: cakupan menurut jenis kelamin sesuai data contoh", async ({
    page,
  }) => {
    await openWithSampleData(page, "/reports")
    await selectMonth(page, "Juni", "2026")
    await expect(
      page.getByRole("heading", { name: "Rekap Juni 2026" })
    ).toBeVisible()

    // Anak 2–10 terdata (anak 1 sudah di atas 60 bulan): 4 laki-laki, 5 perempuan.
    await expect(
      page.getByRole("row", { name: /^Balita terdata\s+4\s+5\s+9$/ })
    ).toBeVisible()
    await expect(
      page.getByRole("row", { name: /^Ditimbang \(ada berat\)\s+4\s+5\s+9$/ })
    ).toBeVisible()
    await expect(
      page.getByRole("row", { name: /^Persen ditimbang.*100%\s+100%\s+100%$/ })
    ).toBeVisible()
  })

  test("Juni 2026: status gizi dinilai dari pengukuran, dan Vitamin A kosong tidak dianggap 'tidak'", async ({
    page,
  }) => {
    await openWithSampleData(page, "/reports")
    await selectMonth(page, "Juni", "2026")

    await expect(card(page, "BB/U").getByText("9 anak dinilai.")).toBeVisible()
    await expect(card(page, "TB/U").getByText("9 anak dinilai.")).toBeVisible()
    // Setiap indikator menampilkan jumlah yang dinilai di tabelnya.
    await expect(
      card(page, "BB/U").getByRole("row", { name: /^Dinilai\s+4\s+5\s+9/ })
    ).toBeVisible()

    // Sheet Juni contoh tidak mengisi Vitamin A: semuanya "tidak diisi".
    const vitamin = card(page, "Vitamin A")
    await expect(
      vitamin.getByRole("row", { name: /^Tidak diisi\s+4\s+5\s+9$/ })
    ).toBeVisible()
    await expect(
      vitamin.getByRole("row", { name: /^Tercatat tidak\s+0\s+0\s+0$/ })
    ).toBeVisible()
  })

  test("SKDN draf: berlabel draf, S tidak dihitung, D = D2 + D25", async ({
    page,
  }) => {
    await openWithSampleData(page, "/reports")
    await selectMonth(page, "Juni", "2026")
    await expect(
      page.getByRole("heading", { name: "SKDN (draf)" })
    ).toBeVisible()
    await expect(
      page.getByText("SKDN: draf, belum disetujui Bidan")
    ).toBeVisible()

    const skdn = card(page, "Penimbangan dan kenaikan berat badan")
    await expect(
      skdn.getByRole("row", { name: /^S Sasaran: sumbernya belum ditemukan/ })
    ).toContainText("–")

    const total = async (code: string) => {
      const row = skdn.getByRole("row", { name: new RegExp(`^${code} `) })
      return Number(await row.locator("td").last().innerText())
    }
    const d = await total("D")
    expect(d).toBe(9) // 9 anak ditimbang pada Juni 2026
    expect((await total("D2")) + (await total("D25"))).toBe(d)
    // Penimbangan sebelumnya Januari: tidak ada pembanding bulan lalu → tidak ada N atau T.
    expect(await total("N")).toBe(0)
    expect(await total("T")).toBe(0)
    expect(await total("O")).toBeGreaterThan(0)
  })

  test("menjelaskan cara membaca laporan dan apa yang belum tersedia, tanpa menebak SKDN", async ({
    page,
  }) => {
    await openWithSampleData(page, "/reports")
    await expect(page.getByText("Cara membaca laporan ini")).toBeVisible()
    await expect(
      page.getByText(/SKDN resmi: S \(sasaran\) belum ada sumbernya/)
    ).toBeVisible()
    await expect(
      page.getByText(/Rekap per Posyandu: data belum memuat nama Posyandu/)
    ).toBeVisible()
    await expect(page.getByText("Hasil masih dalam tahap uji")).toBeVisible()
  })

  test("unduh Excel: nama berkas, isi agregat benar, dan tanpa data pribadi", async ({
    page,
  }) => {
    await openWithSampleData(page, "/reports")
    await selectMonth(page, "Juni", "2026")
    await expect(
      page.getByRole("heading", { name: "Rekap Juni 2026" })
    ).toBeVisible()

    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Unduh Excel" }).click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe("rekap-2026-06.xlsx")
    const path = await download.path()
    const book = XLSX.readFile(path)
    expect(book.SheetNames).toEqual([
      "Ringkasan",
      "Status Gizi",
      "Vitamin A",
      "SKDN (Draf)",
      "Catatan",
    ])

    const summary = XLSX.utils.sheet_to_json<unknown[]>(
      book.Sheets["Ringkasan"],
      {
        header: 1,
        defval: null,
        blankrows: false,
      }
    )
    const eligible = summary.find((row) => row[0] === "Balita terdata")
    expect(eligible).toEqual(["Balita terdata", 4, 5, 9])

    // Tanpa nama anak, NIK, maupun teks catatan pengguna.
    const everything = book.SheetNames.flatMap((name) =>
      XLSX.utils
        .sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, defval: "" })
        .flat()
        .map(String)
    ).join("\n")
    expect(everything).not.toContain("Anak Contoh")
    expect(everything).not.toMatch(/3200\d{12}/)
    expect(everything).toContain("belum divalidasi oleh tenaga kesehatan")
  })

  test("bulan tanpa pengukuran: angka nol dan persen strip, bukan 0% palsu", async ({
    page,
  }) => {
    await openWithSampleData(page, "/reports")
    await selectMonth(page, "November", "2026")
    // 8 balita terdata, tidak ada yang ditimbang → 0%.
    await expect(
      page.getByRole("row", { name: /^Ditimbang \(ada berat\)\s+0\s+0\s+0$/ })
    ).toBeVisible()
    await expect(
      page.getByRole("row", { name: /^Persen ditimbang.*0%\s+0%\s+0%$/ })
    ).toBeVisible()
    await expect(page.getByText("Belum ada anak yang dinilai.")).toHaveCount(4)
  })
})

test.describe("tata letak di layar HP", () => {
  test.use({ viewport: { width: 375, height: 800 } })

  for (const path of ["/dashboard", "/reports"]) {
    test(`${path}: halaman tidak bergulir ke samping`, async ({ page }) => {
      await freezeClock(page)
      await importAndSaveValidSample(page)
      await page.goto(path)
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toBeVisible()
      // Beri waktu data dan grafik tampil.
      await expect(
        page.getByText("Hasil masih dalam tahap uji").first()
      ).toBeVisible()

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth)
    })
  }
})
