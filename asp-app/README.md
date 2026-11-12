# OpenASP

Aplikasi web untuk pencatatan Posyandu dan pemantauan antropometri balita (0–60 bulan). Terinspirasi dari alur kerja workbook ASP di lapangan, tetapi perhitungan gizi mengacu pada standar resmi (Permenkes No. 2 Tahun 2020 dan WHO Child Growth Standards 2006).

> **Status: Phase 0 (fondasi).** Baru ada kerangka aplikasi, navigasi, dan halaman placeholder. Belum ada perhitungan antropometri, import Excel, maupun penyimpanan data. Aplikasi ini belum boleh dipakai untuk keputusan layanan gizi.

Dokumen perencanaan ada di [`../docs`](../docs). Mulai dari `OPENASP-NEXT-STEPS.md`.

## Prinsip

- **Standar resmi adalah sumber kebenaran** untuk perhitungan. Workbook ASP hanya referensi alur kerja dan kompatibilitas.
- **Privasi:** data anak diproses dan disimpan di perangkat pengguna. Jangan mengirim data anak ke server, log, atau analytics.
- **Logika domain terpisah dari UI:** `src/domain/` tidak boleh mengimpor React, Next.js, atau library UI.
- **Jangan mengarang tabel LMS** atau isi workbook yang belum diverifikasi.
- **Gunakan data sintetis** untuk fixture, tes, dan tangkapan layar. Jangan memasukkan NIK, nama, alamat, atau nomor telepon asli ke repository.

## Teknologi

Next.js (App Router) · React · TypeScript strict · Tailwind CSS 4 · shadcn/ui (Radix) · Vitest · Prettier · ESLint

Next.js yang dipakai punya perubahan dibanding versi yang umum dikenal. Baca panduan di `node_modules/next/dist/docs/` sebelum menulis kode terkait framework (lihat `AGENTS.md`).

## Menjalankan

Butuh Node.js 20.9 atau lebih baru (dikembangkan dengan Node 24).

```bash
npm install
npm run dev      # http://localhost:3000
```

## Perintah

| Perintah               | Fungsi                               |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Server pengembangan                  |
| `npm run build`        | Build produksi                       |
| `npm run start`        | Menjalankan hasil build              |
| `npm run lint`         | ESLint                               |
| `npm run typecheck`    | Pemeriksaan tipe TypeScript          |
| `npm test`             | Menjalankan semua tes (Vitest)       |
| `npm run test:watch`   | Tes dalam mode watch                 |
| `npm run format`       | Merapikan kode dengan Prettier       |
| `npm run format:check` | Memeriksa format tanpa mengubah file |

Sebelum commit, jalankan `format:check`, `typecheck`, `lint`, `test`, dan `build`.

Di Windows, jalankan `npm test` dari PowerShell atau Command Prompt. Di git-bash, Vitest bisa gagal dengan error `Cannot read properties of undefined (reading 'config')` karena huruf drive pada jalur proyek tidak konsisten.

## Struktur folder

```text
src/
├── app/                  # Routing dan layout Next.js
│   └── (app)/            # Halaman aplikasi dengan sidebar
├── components/
│   ├── ui/               # Komponen shadcn/ui (dibuat CLI)
│   ├── molecules/
│   └── organisms/
├── hooks/
└── lib/
    └── constants/        # Konstanta bersama, mis. daftar menu
```

Folder lain di rencana arsitektur (`features/`, `domain/`, `infrastructure/`, `store/`) ditambahkan saat fitur terkait mulai dikerjakan, bukan dibuat kosong lebih dulu. Lihat `../docs/OPENASP-ARSITEKTUR-APLIKASI-v0.1.md`.

Menambah komponen shadcn/ui:

```bash
npx shadcn@latest add <nama-komponen>
```

## Tahapan

| Phase | Isi                                  | Status   |
| ----- | ------------------------------------ | -------- |
| 0     | Fondasi proyek                       | Berjalan |
| 1     | Import Excel (adapter Bu Bidan)      | Belum    |
| 2     | Data balita dan pengukuran           | Belum    |
| 3     | Mesin antropometri (WHO + Permenkes) | Belum    |
| 4     | Dashboard dan laporan                | Belum    |
| 5     | PWA, hardening, deployment           | Belum    |

## Disclaimer

OpenASP adalah alat bantu pencatatan dan skrining. Hasilnya tidak menggantikan penilaian tenaga kesehatan.
