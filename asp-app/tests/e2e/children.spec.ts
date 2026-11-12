import { expect, test } from "@playwright/test"

import {
  addChild,
  addMeasurement,
  byLabel,
  importAndSaveValidSample,
  importSample,
} from "./helpers"

test.describe("import lalu daftar balita", () => {
  test("data hasil import tampil di daftar, dan pencarian serta filter bekerja", async ({
    page,
  }) => {
    await importAndSaveValidSample(page)

    await page.goto("/children")
    await expect(page.getByText("Menampilkan 10 dari 10 balita")).toBeVisible()

    // Pencarian nama.
    await byLabel(page, "Cari balita").fill("contoh 03")
    await expect(page.getByText("Menampilkan 1 dari 10 balita")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Anak Contoh 03" })
    ).toBeVisible()

    // Pencarian 4 digit terakhir NIK (NIK sintetis ...0007).
    await byLabel(page, "Cari balita").fill("0007")
    await expect(
      page.getByRole("link", { name: "Anak Contoh 07" })
    ).toBeVisible()
    await expect(page.getByText("Menampilkan 1 dari 10 balita")).toBeVisible()

    // Filter jenis kelamin: 5 laki-laki dan 5 perempuan pada data contoh.
    await byLabel(page, "Cari balita").fill("")
    await page.getByRole("button", { name: "Perempuan", exact: true }).click()
    await expect(page.getByText("Menampilkan 5 dari 10 balita")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Perempuan", exact: true })
    ).toHaveAttribute("aria-pressed", "true")

    // Tidak ada hasil â†’ pesan dan tombol hapus filter.
    await byLabel(page, "Cari balita").fill("zzzz")
    await expect(page.getByText("Tidak ada balita yang cocok")).toBeVisible()
    await page
      .getByRole("button", { name: "Hapus pencarian dan filter" })
      .click()
    await expect(page.getByText("Menampilkan 10 dari 10 balita")).toBeVisible()
  })

  test("NIK penuh tidak pernah tampil di daftar maupun detail", async ({
    page,
  }) => {
    await importAndSaveValidSample(page)
    await page.goto("/children")
    await expect(page.getByText("Menampilkan 10 dari 10 balita")).toBeVisible()
    expect(await page.content()).not.toMatch(/3200\d{12}/)

    await page.getByRole("link", { name: "Anak Contoh 03" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Anak Contoh 03" })
    ).toBeVisible()
    expect(await page.content()).not.toMatch(/3200\d{12}/)
  })

  test("import ulang file yang sama tidak menggandakan daftar", async ({
    page,
  }) => {
    await importAndSaveValidSample(page)
    await importSample(page)
    await page.getByRole("button", { name: /^Simpan \d+ anak/ }).click()
    await expect(page.getByText("Import selesai")).toBeVisible()

    await page.goto("/children")
    await expect(page.getByText("Menampilkan 10 dari 10 balita")).toBeVisible()
  })

  test("daftar kosong menampilkan ajakan menambah atau mengimpor", async ({
    page,
  }) => {
    await page.goto("/children")
    await expect(page.getByText("Belum ada data balita")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Tambah balita" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Import Excel" }).last()
    ).toBeVisible()
  })
})

test.describe("tambah dan ubah balita", () => {
  test("menambah balita manual lalu mengubah datanya", async ({ page }) => {
    await addChild(page, {
      name: "Budi Percobaan",
      birthDate: "2025-03-15",
      sex: "Laki-laki",
    })
    await expect(page.getByText("Dicatat manual")).toBeVisible()
    await expect(page.getByText("Tidak diisi")).toBeVisible()

    await page.getByRole("link", { name: "Ubah data" }).click()
    await expect(byLabel(page, "Nama", { exact: false })).toHaveValue(
      "Budi Percobaan"
    )
    await byLabel(page, "Nama", { exact: false }).fill("Budi Diubah")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Budi Diubah" })
    ).toBeVisible()
  })

  test("membuka Tambah balita lagi setelah menyimpan menampilkan formulir kosong", async ({
    page,
  }) => {
    await addChild(page, {
      name: "Anak Pertama",
      birthDate: "2025-03-15",
      sex: "Perempuan",
      nik: "3200000000000077",
    })

    // Navigasi di dalam aplikasi (bukan memuat ulang halaman): daftar → Tambah balita.
    await page.getByRole("link", { name: "Daftar balita" }).click()
    await page.getByRole("link", { name: "Tambah balita" }).first().click()

    await expect(byLabel(page, "Nama", { exact: false })).toBeVisible()
    await expect(byLabel(page, "Nama", { exact: false })).toHaveValue("")
    await expect(byLabel(page, "Tanggal lahir")).toHaveValue("")
    await expect(byLabel(page, "NIK")).toHaveValue("")
    await expect(byLabel(page, "Perempuan")).not.toBeChecked()
  })

  test("membuka Ubah data lagi setelah menyimpan menampilkan data terbaru, bukan yang lama", async ({
    page,
  }) => {
    await addChild(page, {
      name: "Nama Lama",
      birthDate: "2025-03-15",
      sex: "Laki-laki",
    })
    await page.getByRole("link", { name: "Ubah data" }).click()
    await byLabel(page, "Nama", { exact: false }).fill("Nama Baru")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Nama Baru" })
    ).toBeVisible()

    // Buka formulir ubah untuk kedua kalinya lewat navigasi di dalam aplikasi.
    await page.getByRole("link", { name: "Ubah data" }).click()
    await expect(byLabel(page, "Nama", { exact: false })).toHaveValue(
      "Nama Baru"
    )
  })

  test("tombol Back setelah menyimpan perubahan tidak menampilkan data lama di formulir ubah", async ({
    page,
  }) => {
    await addChild(page, {
      name: "Nama Awal",
      birthDate: "2025-03-15",
      sex: "Laki-laki",
    })
    await page.getByRole("link", { name: "Ubah data" }).click()
    await byLabel(page, "Nama", { exact: false }).fill("Nama Sesudah")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(
      page.getByRole("heading", { level: 1, name: "Nama Sesudah" })
    ).toBeVisible()

    // Back peramban kembali ke halaman ubah yang dulu dibuka.
    await page.goBack()
    await expect(page).toHaveURL(/\/edit$/)
    await expect(byLabel(page, "Nama", { exact: false })).toHaveValue(
      "Nama Sesudah"
    )
  })

  test("tidak ada id ganda di DOM walau berpindah antar halaman formulir", async ({
    page,
  }) => {
    // Next.js menyimpan halaman sebelumnya yang tersembunyi; id statis pada formulir
    // akan bentrok dan membuat label menunjuk ke kolom yang salah.
    await addChild(page, {
      name: "Anak Id",
      birthDate: "2025-03-15",
      sex: "Laki-laki",
    })
    await page.getByRole("link", { name: "Ubah data" }).click()
    await expect(byLabel(page, "Nama", { exact: false })).toHaveValue("Anak Id")
    await page.getByRole("link", { name: "Batal" }).click()
    await page.getByRole("link", { name: "Tambah pengukuran" }).first().click()
    await expect(byLabel(page, "Tanggal ukur")).toBeVisible()

    const duplicates = await page.evaluate(() => {
      const counts = new Map<string, number>()
      for (const el of document.querySelectorAll("[id]")) {
        counts.set(el.id, (counts.get(el.id) ?? 0) + 1)
      }
      return [...counts].filter(([, n]) => n > 1).map(([id]) => id)
    })
    expect(duplicates).toEqual([])

    // Tiap kolom hanya punya satu label.
    const labelCounts = await page.evaluate(() =>
      Array.from(document.querySelectorAll("input")).map(
        (input) => input.labels?.length ?? 0
      )
    )
    for (const n of labelCounts) expect(n).toBeLessThanOrEqual(1)
  })

  test("formulir menolak data tidak valid dengan pesan yang jelas", async ({
    page,
  }) => {
    await page.goto("/children/new")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(page.getByText("Nama wajib diisi.")).toBeVisible()
    await expect(page.getByText("Tanggal lahir wajib diisi.")).toBeVisible()
    await expect(page.getByText("Pilih jenis kelamin.")).toBeVisible()

    await byLabel(page, "NIK").fill("123")
    await byLabel(page, "Nama", { exact: false }).fill("Uji")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(page.getByText("NIK harus 16 digit angka.")).toBeVisible()
    // Tetap di halaman formulir.
    await expect(page).toHaveURL(/\/children\/new$/)
  })

  test("menolak NIK yang sudah dipakai anak lain tanpa menampilkan NIK-nya", async ({
    page,
  }) => {
    await addChild(page, {
      name: "Anak Satu",
      birthDate: "2025-03-15",
      sex: "Perempuan",
      nik: "3200000000000042",
    })
    await page.goto("/children/new")
    await byLabel(page, "Nama", { exact: false }).fill("Anak Dua")
    await byLabel(page, "Tanggal lahir").fill("2025-04-01")
    await byLabel(page, "Laki-laki").check()
    await byLabel(page, "NIK").fill("3200000000000042")
    await page.getByRole("button", { name: "Simpan" }).click()

    await expect(
      page.getByText("NIK ini sudah dipakai anak lain.")
    ).toBeVisible()
    await expect(page).toHaveURL(/\/children\/new$/)
  })

  test("balita yang tidak ada menampilkan pesan, bukan halaman kosong", async ({
    page,
  }) => {
    await page.goto("/children/tidak-ada")
    await expect(page.getByText("Balita tidak ditemukan")).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Kembali ke daftar balita" })
    ).toBeVisible()
  })
})

test.describe("pengukuran", () => {
  test.beforeEach(async ({ page }) => {
    await addChild(page, {
      name: "Anak Ukur",
      birthDate: "2025-03-15",
      sex: "Perempuan",
    })
  })

  test("menambah pengukuran dan melihatnya di riwayat", async ({ page }) => {
    await addMeasurement(page, {
      date: "2026-06-10",
      weight: "12,4",
      height: "88,5",
      position: "Berdiri",
    })

    await expect(
      page.getByRole("heading", { level: 1, name: "Anak Ukur" })
    ).toBeVisible()
    const row = page.getByRole("row", { name: /10 Jun 2026/ })
    await expect(row).toBeVisible()
    await expect(row).toContainText("12,4")
    await expect(row).toContainText("88,5")
    // 15 Mar 2025 â†’ 10 Jun 2026 = 14 bulan penuh.
    await expect(row).toContainText("14 bln")
  })

  test("menampilkan umur saat diukur secara langsung di formulir", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Tambah pengukuran" }).first().click()
    await byLabel(page, "Tanggal ukur").fill("2026-06-10")
    await expect(
      page.getByRole("status").filter({ hasText: "14 bln" })
    ).toBeVisible()
  })

  test("validasi: wajib salah satu angka, cara ukur wajib bila tinggi diisi", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Tambah pengukuran" }).first().click()
    await byLabel(page, "Tanggal ukur").fill("2026-06-10")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(page.getByText("Isi berat atau panjang/tinggi.")).toBeVisible()

    await byLabel(page, "Panjang/tinggi (cm)").fill("80")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(
      page.getByText("Pilih cara ukur, atau 'Tidak diketahui'.")
    ).toBeVisible()
    await expect(page).toHaveURL(/measurements\/new$/)
  })

  test("tanggal ukur sebelum lahir dan di masa depan ditolak", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Tambah pengukuran" }).first().click()
    await byLabel(page, "Berat (kg)").fill("10")

    await byLabel(page, "Tanggal ukur").fill("2025-03-14")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(
      page.getByText("Tanggal ukur tidak boleh lebih awal dari tanggal lahir.")
    ).toBeVisible()

    // Tahun di atas 2100 ditolak sebagai tidak valid; 2099 valid tetapi di masa depan.
    await byLabel(page, "Tanggal ukur").fill("2099-01-01")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(
      page.getByText("Tanggal ukur tidak boleh di masa depan.")
    ).toBeVisible()
  })

  test("angka tidak wajar memunculkan peringatan tetapi tetap bisa disimpan", async ({
    page,
  }) => {
    await page.getByRole("link", { name: "Tambah pengukuran" }).first().click()
    await byLabel(page, "Tanggal ukur").fill("2026-06-10")
    await byLabel(page, "Berat (kg)").fill("45")

    await expect(page.getByText("Periksa kembali angka ini")).toBeVisible()
    await expect(
      page.getByText(/Berat 45 kg di luar rentang wajar/)
    ).toBeVisible()

    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(page.getByRole("row", { name: /10 Jun 2026/ })).toContainText(
      "45"
    )
  })

  test("pengukuran pada tanggal yang sama ditolak", async ({ page }) => {
    await addMeasurement(page, { date: "2026-06-10", weight: "12" })
    await expect(page.getByRole("row", { name: /10 Jun 2026/ })).toBeVisible()

    await addMeasurement(page, { date: "2026-06-10", weight: "13" })
    await expect(
      page.getByText(/Sudah ada pengukuran pada tanggal ini/)
    ).toBeVisible()
    await expect(page).toHaveURL(/measurements\/new$/)
  })

  test("mengubah pengukuran", async ({ page }) => {
    await addMeasurement(page, { date: "2026-06-10", weight: "12" })
    await page.getByRole("link", { name: /Ubah pengukuran 10/ }).click()
    await expect(byLabel(page, "Berat (kg)")).toHaveValue("12")

    await byLabel(page, "Berat (kg)").fill("12,8")
    await page.getByRole("button", { name: "Simpan" }).click()
    await expect(page.getByRole("row", { name: /10 Jun 2026/ })).toContainText(
      "12,8"
    )
  })

  test("membuka Tambah pengukuran lagi setelah menyimpan menampilkan formulir kosong", async ({
    page,
  }) => {
    await addMeasurement(page, {
      date: "2026-06-10",
      weight: "12",
      height: "80",
      position: "Berdiri",
    })
    await expect(page.getByRole("row", { name: /10 Jun 2026/ })).toBeVisible()

    await page.getByRole("link", { name: "Tambah pengukuran" }).first().click()
    await expect(byLabel(page, "Tanggal ukur")).toBeVisible()
    await expect(byLabel(page, "Berat (kg)")).toHaveValue("")
    await expect(byLabel(page, "Panjang/tinggi (cm)")).toHaveValue("")
    await expect(byLabel(page, "Berdiri")).not.toBeChecked()
    // Tanggal kembali ke hari ini, bukan tanggal pengukuran sebelumnya.
    await expect(byLabel(page, "Tanggal ukur")).not.toHaveValue("2026-06-10")
  })

  test("menghapus pengukuran meminta konfirmasi dan bisa dibatalkan", async ({
    page,
  }) => {
    await addMeasurement(page, { date: "2026-06-10", weight: "12" })
    const row = page.getByRole("row", { name: /10 Jun 2026/ })

    await page.getByRole("button", { name: /Hapus pengukuran 10/ }).click()
    await expect(page.getByRole("alertdialog")).toContainText(
      "Hapus pengukuran ini?"
    )
    await page.getByRole("button", { name: "Batal" }).click()
    await expect(row).toBeVisible()

    await page.getByRole("button", { name: /Hapus pengukuran 10/ }).click()
    await page.getByRole("button", { name: "Ya, hapus" }).click()
    await expect(row).toHaveCount(0)
    await expect(
      page.getByText("Belum ada pengukuran untuk balita ini.")
    ).toBeVisible()
  })

  test("menghapus balita ikut menghapus pengukurannya dan kembali ke daftar", async ({
    page,
  }) => {
    await addMeasurement(page, { date: "2026-06-10", weight: "12" })
    await page.getByRole("button", { name: "Hapus balita" }).click()
    await expect(page.getByRole("alertdialog")).toContainText("1 pengukurannya")
    await page.getByRole("button", { name: "Ya, hapus" }).click()

    await expect(page).toHaveURL(/\/children$/)
    await expect(page.getByText("Belum ada data balita")).toBeVisible()
  })
})

test.describe("kursor penunjuk", () => {
  test("tombol dan tautan memakai cursor: pointer, tombol nonaktif tidak", async ({
    page,
  }) => {
    await page.goto("/children")
    const cursorOf = (locator: ReturnType<typeof page.locator>) =>
      locator.evaluate((el) => getComputedStyle(el).cursor)

    expect(
      await cursorOf(page.getByRole("link", { name: "Tambah balita" }).first())
    ).toBe("pointer")
    expect(
      await cursorOf(page.getByRole("link", { name: "Import Excel" }).first())
    ).toBe("pointer")

    await page.goto("/children/new")
    const submit = page.getByRole("button", { name: "Simpan" })
    expect(await cursorOf(submit)).toBe("pointer")

    await page.goto("/import")
    expect(await cursorOf(byLabel(page, "File Excel"))).toBe("pointer")
  })
})
