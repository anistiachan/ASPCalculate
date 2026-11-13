import { expect, test, type Page } from "@playwright/test"

import { byLabel, importSample } from "./helpers"

async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date("2026-11-13T10:00:00"))
}

test.describe("contoh P1 (template yang diisi)", () => {
  test("contoh valid: diimpor, lalu hasil pemeriksaan menunjukkan anak pendek", async ({
    page,
  }) => {
    await freezeClock(page)
    await importSample(page, "contoh-p1-valid.xlsx")
    await expect(
      page.getByText("Ada baris yang tidak bisa diimpor")
    ).toHaveCount(0)
    await page.getByRole("button", { name: /^Simpan 8 anak/ }).click()
    await expect(page.getByText("Import selesai")).toBeVisible()

    // Berkas memuat beberapa bulan: bulan terbaru dipilih, bulan lain bisa dipilih.
    await expect(
      page.getByRole("heading", { name: "Hasil pemeriksaan · Agustus 2026" })
    ).toBeVisible()
    await byLabel(page, "Bulan diperiksa").selectOption({
      label: "Januari 2026",
    })
    await expect(
      page.getByRole("heading", { name: "Hasil pemeriksaan · Januari 2026" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Anak Contoh G" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Anak Contoh H" })
    ).toBeVisible()
  })

  test("contoh bermasalah: pratinjau menolak baris salah dan memberi peringatan angka tidak wajar", async ({
    page,
  }) => {
    await freezeClock(page)
    await importSample(page, "contoh-p1-bermasalah.xlsx")
    await expect(
      page.getByText("Ada baris yang tidak bisa diimpor")
    ).toBeVisible()
    await expect(page.getByText("Nama Posyandu kosong.")).toBeVisible()
    await expect(
      page.getByText(/Jenis kelamin: harus 1 \(laki-laki\) atau 2/)
    ).toBeVisible()
    await expect(page.getByText(/Berat harus lebih dari nol/)).toBeVisible()
    await expect(
      page.getByText(/Berat 105 kg di luar rentang wajar/)
    ).toBeVisible()
    await expect(page.getByText(/814 cm di luar rentang wajar/)).toBeVisible()
  })
})
