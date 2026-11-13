import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import {
  addChild,
  addMeasurement,
  byLabel,
  historyRow,
  importAndSaveValidSample,
  importSample,
} from "./helpers"

/**
 * Pemeriksaan aksesibilitas otomatis (axe-core) pada halaman yang benar-benar
 * dirender: kontras warna, label, nama tombol, ID ganda, dan sebagainya.
 * Menguji standar WCAG 2.2 AA yang diminta docs/design/skill.md.
 */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

async function expectNoViolations(page: Page, label: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze()

  const summary = violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 3).map((n) => ({
      target: n.target.join(" "),
      detail: n.any[0]?.message ?? n.failureSummary?.split("\n")[1],
    })),
  }))
  expect(summary, `Pelanggaran aksesibilitas pada ${label}`).toEqual([])
}

test.describe("aksesibilitas (WCAG 2.2 AA)", () => {
  test("daftar balita berisi data", async ({ page }) => {
    await importAndSaveValidSample(page)
    await page.goto("/children")
    await expect(page.getByText("Menampilkan 10 dari 10 balita")).toBeVisible()
    await expectNoViolations(page, "daftar balita")
  })

  test("daftar balita kosong", async ({ page }) => {
    await page.goto("/children")
    await expect(page.getByText("Belum ada data balita")).toBeVisible()
    await expectNoViolations(page, "daftar kosong")
  })

  test("formulir tambah balita, termasuk saat ada pesan error", async ({
    page,
  }) => {
    await page.goto("/children/new")
    await expect(byLabel(page, "Nama", { exact: false })).toBeVisible()
    await expectNoViolations(page, "formulir tambah balita")

    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(page.getByText("Nama wajib diisi.")).toBeVisible()
    await expectNoViolations(page, "formulir tambah balita dengan error")
  })

  test("detail balita dengan riwayat pengukuran dan dialog hapus", async ({
    page,
  }) => {
    await addChild(page, {
      name: "Anak Aksesibel",
      birthDate: "2025-03-15",
      sex: "Perempuan",
    })
    await addMeasurement(page, {
      date: "2026-06-10",
      weight: "12,4",
      height: "88,5",
      position: "Berdiri",
    })
    await expect(historyRow(page, /10 Jun 2026/)).toBeVisible()
    await expectNoViolations(page, "detail balita")

    await page.getByRole("button", { name: /Hapus pengukuran 10/ }).click()
    await expect(page.getByRole("alertdialog")).toBeVisible()
    await expectNoViolations(page, "dialog konfirmasi hapus")
  })

  test("tabel status gizi dengan badge kategori dan catatan", async ({
    page,
  }) => {
    await addChild(page, {
      name: "Bayi Aksesibel",
      birthDate: "2026-01-01",
      sex: "Laki-laki",
    })
    // Bayi 8 bulan diukur berdiri: kategori "Sangat pendek" (badge merah) beserta catatan.
    await addMeasurement(page, {
      date: "2026-09-02",
      weight: "7",
      height: "60",
      position: "Berdiri",
    })
    await expect(page.getByText("Sangat pendek")).toBeVisible()
    await expectNoViolations(page, "tabel status gizi")
  })

  test("formulir pengukuran dengan peringatan kewajaran", async ({ page }) => {
    await addChild(page, {
      name: "Anak Peringatan",
      birthDate: "2025-03-15",
      sex: "Laki-laki",
    })
    await page.getByRole("link", { name: "Tambah pengukuran" }).first().click()
    await byLabel(page, "Tanggal ukur").fill("2026-06-10")
    await byLabel(page, "Berat (kg)").fill("45")
    await expect(page.getByText("Periksa kembali angka ini")).toBeVisible()
    await expectNoViolations(page, "formulir pengukuran dengan peringatan")
  })

  test("halaman import dengan pratinjau berisi error dan peringatan", async ({
    page,
  }) => {
    await page.goto("/import")
    await expectNoViolations(page, "halaman import awal")

    await importSample(page, "contoh-bu-bidan-bermasalah.xlsx")
    await expect(
      page.getByText("Ada baris yang tidak bisa diimpor")
    ).toBeVisible()
    await expectNoViolations(page, "pratinjau import bermasalah")
  })

  test("halaman placeholder dan sidebar", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible()
    await expectNoViolations(page, "dashboard")
  })
})
