import { expect, type Page } from "@playwright/test"
import { join } from "node:path"

const SAMPLES_DIR = join(process.cwd(), "samples")

/**
 * Kolom berdasarkan labelnya, hanya yang terlihat. Next.js (Cache Components) menyimpan
 * halaman sebelumnya yang tersembunyi di DOM, dan `getByLabel` ikut menghitungnya.
 */
export function byLabel(
  page: Page,
  text: string,
  options?: { exact?: boolean }
) {
  return page.getByLabel(text, options).filter({ visible: true })
}

/** Mengimpor file contoh sintetis lewat halaman Import, seperti yang dilakukan pengguna. */
export async function importSample(
  page: Page,
  fileName = "contoh-bu-bidan-valid.xlsx"
) {
  await page.goto("/import")
  await byLabel(page, "File Excel").setInputFiles(join(SAMPLES_DIR, fileName))
  await expect(page.getByText(`Pratinjau: ${fileName}`)).toBeVisible()
}

export async function importAndSaveValidSample(page: Page) {
  await importSample(page)
  await page.getByRole("button", { name: /^Simpan \d+ anak/ }).click()
  await expect(page.getByText("Import selesai")).toBeVisible()
}

/** Menambah balita lewat formulir dan menunggu halaman detailnya terbuka. */
export async function addChild(
  page: Page,
  data: {
    name: string
    birthDate: string
    sex: "Laki-laki" | "Perempuan"
    nik?: string
  }
) {
  await page.goto("/children/new")
  await byLabel(page, "Nama", { exact: false }).fill(data.name)
  await byLabel(page, "Tanggal lahir").fill(data.birthDate)
  await byLabel(page, data.sex).check()
  if (data.nik) await byLabel(page, "NIK").fill(data.nik)
  await page.getByRole("button", { name: "Simpan" }).click()
  await expect(
    page.getByRole("heading", { level: 1, name: data.name })
  ).toBeVisible()
}

export async function addMeasurement(
  page: Page,
  data: {
    date: string
    weight?: string
    height?: string
    position?: "Berdiri" | "Terlentang" | "Tidak diketahui"
  }
) {
  await page.getByRole("link", { name: "Tambah pengukuran" }).first().click()
  await byLabel(page, "Tanggal ukur").fill(data.date)
  if (data.weight) await byLabel(page, "Berat (kg)").fill(data.weight)
  if (data.height) await byLabel(page, "Panjang/tinggi (cm)").fill(data.height)
  if (data.position) await byLabel(page, data.position).check()
  await page.getByRole("button", { name: "Simpan" }).click()
}
