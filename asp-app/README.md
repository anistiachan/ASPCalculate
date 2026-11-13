# OpenASP

Aplikasi web untuk pencatatan Posyandu dan pemantauan antropometri balita (0–60 bulan). Terinspirasi dari alur kerja workbook ASP di lapangan, tetapi perhitungan gizi mengacu pada standar resmi (Permenkes No. 2 Tahun 2020 dan WHO Child Growth Standards 2006).

> **Status: Phase 4 selesai secara teknis, menunggu tinjauan tenaga kesehatan dan definisi SKDN.** Sudah ada import Excel, pencatatan balita dan pengukuran, pencarian dan filter, perhitungan z-score dan status gizi (BB/U, TB/U, BB/PB-TB, IMT/U) menurut Permenkes 2/2020 dengan acuan WHO 2006, dashboard, laporan bulanan yang bisa diunduh sebagai Excel, dan Daftar Pantauan (balita pendek, kurus, BGM, bermasalah, serta sasaran Vitamin A dan ASI). SKDN tampil sebagai draf menurut rumus workbook asli (S/sasaran belum ada sumbernya); ASI eksklusif, kelas ibu, MBG, dan rekap per Posyandu belum ada karena definisi atau datanya belum tersedia (lihat [`../docs/OPENASP-DEFINISI-LAPORAN.md`](../docs/OPENASP-DEFINISI-LAPORAN.md)).
>
> **Hasil perhitungan belum divalidasi oleh tenaga kesehatan** dan setiap hasil di layar menampilkan peringatan itu. Aplikasi ini belum boleh dipakai untuk keputusan layanan gizi. Daftar keputusan yang perlu ditinjau ada di [`../docs/OPENASP-VALIDASI-ANTROPOMETRI.md`](../docs/OPENASP-VALIDASI-ANTROPOMETRI.md).

Dokumen perencanaan ada di [`../docs`](../docs). Mulai dari `OPENASP-NEXT-STEPS.md`.

## Prinsip

- **Standar resmi adalah sumber kebenaran** untuk perhitungan. Workbook ASP hanya referensi alur kerja dan kompatibilitas.
- **Privasi:** data anak diproses dan disimpan di perangkat pengguna (IndexedDB). Jangan mengirim data anak ke server, log, atau analytics. NIK tidak pernah ditampilkan penuh.
- **Logika domain terpisah dari UI:** `src/domain/` tidak boleh mengimpor React, Next.js, atau library UI.
- **Jangan mengarang tabel LMS** atau isi workbook yang belum diverifikasi.
- **Gunakan data sintetis** untuk fixture, tes, dan tangkapan layar. Jangan memasukkan NIK, nama, alamat, atau nomor telepon asli ke repository.
- **Aturan desain** mengikuti `../docs/design/skill.md` (token semantik, WCAG 2.2 AA, skala tipografi, radius). Penyimpangan yang disengaja (font teks isi) dijelaskan di `src/app/globals.css`.

## Teknologi

Next.js (App Router, Cache Components) · React · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Radix) · React Hook Form + Zod · Dexie (IndexedDB) · SheetJS · Vitest · Playwright · Prettier · ESLint

Next.js yang dipakai punya perubahan dibanding versi yang umum dikenal. Baca panduan di `node_modules/next/dist/docs/` sebelum menulis kode terkait framework (lihat `AGENTS.md`).

## Menjalankan

Butuh Node.js 20.9 atau lebih baru (dikembangkan dengan Node 24).

```bash
npm install
npm run dev      # http://localhost:3000
```

Untuk mencoba import, gunakan file contoh sintetis di [`samples/`](samples/README.md).

## Perintah

| Perintah                   | Fungsi                                                                 |
| -------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`              | Server pengembangan                                                    |
| `npm run build`            | Build produksi                                                         |
| `npm run start`            | Menjalankan hasil build                                                |
| `npm run lint`             | ESLint                                                                 |
| `npm run typecheck`        | Pemeriksaan tipe (membuat tipe rute Next.js lebih dulu)                |
| `npm test`                 | Tes unit dan integrasi (Vitest)                                        |
| `npm run test:watch`       | Tes unit dalam mode watch                                              |
| `npm run test:e2e`         | Tes end-to-end di browser (Playwright). Jalankan `build` dulu.         |
| `npm run format`           | Merapikan kode dengan Prettier                                         |
| `npm run format:check`     | Memeriksa format tanpa mengubah file                                   |
| `npm run samples:generate` | Membuat ulang file contoh Excel di `samples/`                          |
| `npm run karangtawar:slim` | Meringkas workbook ASP Karangtawar asli (puluhan MB) agar bisa diimpor |
| `npm run who:import`       | Mengunduh dan memvalidasi tabel referensi WHO 2006 (lihat di bawah)    |

Skrip PowerShell (Windows, butuh Excel terpasang), tidak lewat `npm run`:

- `scripts/add-zscore-to-bu-bidan.ps1` menambahkan kolom z-score dan status gizi (seperti sheet PSG, dengan rumus Excel otomatis) ke workbook Bu Bidan. Lihat [`../docs/OPENASP-EXCEL-ZSCORE-BU-BIDAN.md`](../docs/OPENASP-EXCEL-ZSCORE-BU-BIDAN.md).
- `scripts/dump-bu-bidan-values.ps1` membuang nilai sel workbook ke JSON lewat Excel, untuk tes pembanding lokal `src/test/bu-bidan-zscore-compare.local.test.ts` (dilewati tanpa variabel lingkungan; memuat data pribadi, jangan di-commit).

Sebelum commit, jalankan `format:check`, `typecheck`, `lint`, `test`, `build`, lalu `test:e2e`.

### Tes end-to-end

`test:e2e` memakai Microsoft Edge yang sudah ada di Windows (tidak mengunduh browser) dan menguji hasil build produksi di port 3217. Ganti port dengan `E2E_PORT` bila bentrok. Tes mencakup alur import, tambah/ubah/hapus balita dan pengukuran, serta pemeriksaan aksesibilitas otomatis (axe-core, WCAG 2.2 AA) pada halaman yang benar-benar dirender.

### Tabel referensi WHO

Parameter LMS di `src/domain/anthropometry/references/who-2006/` **dihasilkan** oleh `npm run who:import` dari tabel resmi WHO (`cdn.who.int`); jangan mengubah JSON-nya dengan tangan atau memformatnya dengan Prettier. Skrip memverifikasi hash SHA-256 setiap berkas dan mencocokkan hasil hitung dengan kolom SD yang diterbitkan WHO. Jika WHO mengganti berkas, skrip berhenti sampai perubahannya ditinjau. Detail di `../docs/OPENASP-VALIDASI-ANTROPOMETRI.md`.

### Catatan lingkungan Windows

- Jalankan `npm test` dari **PowerShell atau Command Prompt**. Di git-bash, Vitest bisa gagal dengan `Cannot read properties of undefined (reading 'config')` karena huruf drive pada jalur proyek tidak konsisten.
- **Jangan mengubah berkas dengan `Get-Content`/`Set-Content` di Windows PowerShell 5.1.** Perintah itu membaca berkas sebagai ANSI dan menulisnya dengan BOM, sehingga karakter seperti "–" menjadi "â€“". Gunakan penyunting atau alat edit. Tes `src/test/encoding.test.ts` mendeteksi kerusakan semacam ini.

## Struktur folder

```text
src/
├── app/                      # Routing dan layout Next.js
│   └── (app)/                # Halaman aplikasi dengan sidebar
│       ├── children/         # Daftar, detail, tambah/ubah balita, pengukuran
│       └── import/           # Import Excel
├── components/
│   ├── ui/                   # Komponen shadcn/ui (dibuat CLI, sebagian disesuaikan)
│   ├── molecules/            # FormField, PageHeader, ToggleButtonGroup, dst.
│   └── organisms/            # AppSidebar
├── domain/                   # Aturan bisnis murni (tanpa React/Next.js)
│   ├── anthropometry/        # Mesin z-score, koreksi posisi, klasifikasi Permenkes
│   │   └── references/       # Tabel LMS WHO 2006 (dihasilkan skrip)
│   ├── child/                # Tipe anak dan data tersimpan
│   ├── measurement/          # Pemeriksaan kewajaran nilai input
│   └── reporting/            # Rekap bulanan: cakupan, sebaran status, Vitamin A
├── features/
│   ├── children/             # Daftar, form, detail, hook data, skema validasi
│   ├── excel-import/         # Adapter, normalizer, validator, perencana import
│   └── reports/              # Dashboard dan laporan; grafik SVG buatan sendiri (tanpa Recharts)
├── infrastructure/
│   ├── excel/                # Pembaca workbook dan pembuat berkas rekap (SheetJS)
│   └── storage/              # IndexedDB (Dexie) dan repository
├── lib/                      # Helper umum: tanggal, angka, format, warna
└── test/                     # Fixture sintetis dan tes lintas modul
tests/e2e/                    # Tes Playwright
samples/                      # File Excel contoh (sintetis)
scripts/                      # Skrip pembuat file contoh
```

Folder `store/` di rencana arsitektur belum dibuat karena belum ada kebutuhan state lintas halaman (data reaktif memakai `dexie-react-hooks`). Lihat `../docs/OPENASP-ARSITEKTUR-APLIKASI-v0.1.md`.

Menambah komponen shadcn/ui:

```bash
npx shadcn@latest add <nama-komponen>
```

Beberapa komponen di `src/components/ui/` sudah disesuaikan (kontras AA, ukuran target sentuh, kursor). Jangan menimpanya dengan `--overwrite` tanpa memeriksa diff, dan jalankan `npm test` setelahnya.

## Tahapan

| Phase | Isi                                  | Status                                                  |
| ----- | ------------------------------------ | ------------------------------------------------------- |
| 0     | Fondasi proyek                       | Selesai                                                 |
| 1     | Import Excel (adapter Bu Bidan)      | Selesai                                                 |
| 2     | Data balita dan pengukuran           | Selesai                                                 |
| 3     | Mesin antropometri (WHO + Permenkes) | Teknis selesai, **menunggu tinjauan tenaga kesehatan**  |
| 4     | Dashboard dan laporan bulanan        | Teknis selesai; **SKDN menunggu definisi dari pemilik** |
| 5     | PWA, hardening, deployment           | Belum                                                   |

Adapter ASP Karangtawar (sheet P1–P10 dan sheet PSG bulanan) sudah ada, begitu pula template Excel, hasil pemeriksaan setelah impor, alur ukur ulang, rekap format P1, serta cadangkan dan pulihkan data (halaman Pengaturan, berkas JSON yang hanya menambah data); lihat [`../docs/OPENASP-MAPPING-KARANGTAWAR-v0.1.md`](../docs/OPENASP-MAPPING-KARANGTAWAR-v0.1.md). Belum dikerjakan: ekspor e-PPGBM, layar penyelesaian konflik import, enkripsi berkas cadangan, serta grafik kurva dan pemantauan tren pertumbuhan.

## Disclaimer

OpenASP adalah alat bantu pencatatan dan skrining. Hasilnya tidak menggantikan penilaian tenaga kesehatan.
