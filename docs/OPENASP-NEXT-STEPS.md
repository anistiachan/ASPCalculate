# OpenASP — Project Continuation Notes

> Dokumen kerja untuk melanjutkan pengembangan OpenASP di sesi berikutnya.  
> Status saat dokumen ini dibuat: tahap perencanaan selesai, implementasi fondasi proyek (Phase 0) menjadi langkah berikutnya.

## 1. Ringkasan Proyek

**OpenASP** adalah aplikasi web/PWA publik dan gratis untuk membantu pencatatan data balita, pengukuran antropometri, rekap Posyandu, serta import/export Excel. Aplikasi terinspirasi dari alur kerja file ASP Excel yang digunakan di lapangan, tetapi standar perhitungan gizi harus mengacu pada standar resmi.

### Tujuan utama

- Mempermudah pencatatan data balita dan hasil pengukuran Posyandu.
- Mengurangi ketergantungan pada workbook Excel yang kompleks.
- Menyediakan perhitungan antropometri yang konsisten dan dapat diuji.
- Menghasilkan rekap dan file Excel yang tetap familier bagi pengguna.
- Dapat digunakan melalui HP maupun desktop.
- Gratis dan mudah diakses melalui browser, dengan kemampuan PWA sebagai pengembangan lanjutan.

### Prinsip produk

1. **Standar resmi adalah sumber kebenaran** untuk perhitungan antropometri.
2. **Workbook ASP adalah referensi workflow dan kompatibilitas**, bukan sumber kebenaran medis.
3. **Privasi sejak awal:** data anak sebisa mungkin diproses dan disimpan di perangkat pengguna.
4. **Local-first:** MVP tidak mengharuskan pengguna mengunggah data anak ke server.
5. **Import harus transparan:** pengguna dapat melihat pratinjau, peringatan, dan kesalahan sebelum data disimpan.
6. **Hasil harus dapat ditelusuri:** rumus, referensi standar, dan versi data referensi perlu terdokumentasi.

---

## 2. Keputusan Teknologi Awal

| Area | Pilihan awal | Catatan |
|---|---|---|
| Framework | Next.js App Router | Struktur aplikasi web dan routing |
| Bahasa | TypeScript strict | Hindari penggunaan `any` tanpa alasan |
| UI | Tailwind CSS + shadcn/ui | Komponen konsisten dan responsif |
| Form | React Hook Form + Zod | Validasi input |
| Tabel | TanStack Table | Tabel data balita dan pengukuran |
| Excel | SheetJS (`xlsx`) | Import/export workbook |
| State UI | Zustand | Hanya state antarmuka/transien |
| Penyimpanan lokal | Dexie + IndexedDB | Penyimpanan data utama di browser |
| Grafik | Recharts | Dashboard dan visualisasi |
| Testing unit | Vitest + Testing Library | Domain logic dan komponen |
| Testing E2E | Playwright | Alur penggunaan utama |
| Deployment | Vercel | Hosting aplikasi Next.js |

Pilihan library dapat dievaluasi ulang saat implementasi, tetapi perubahan harus memiliki alasan yang jelas.

---

## 3. Arsitektur yang Disarankan

Gunakan **Modular Monolith + Feature-Based Architecture**. Tidak perlu microservices untuk MVP.

### Batas tanggung jawab

- `app/`: routing, layout, dan komposisi halaman Next.js.
- `features/`: alur fitur aplikasi, misalnya import Excel dan pengelolaan balita.
- `domain/`: aturan bisnis murni, entitas, validasi domain, dan perhitungan antropometri.
- `infrastructure/`: implementasi penyimpanan, pembacaan Excel, dan export.
- `components/`: komponen UI yang dapat digunakan ulang.
- `store/`: state antarmuka yang tidak menjadi sumber data utama.
- `lib/`: helper teknis lintas fitur yang benar-benar umum.

**Aturan penting:** domain tidak boleh bergantung pada React, Next.js, Zustand, atau library UI. Perhitungan antropometri harus dapat dijalankan dan diuji secara independen.

### Usulan struktur direktori

```text
openasp/
├── public/
├── docs/
│   ├── OPENASP-REVERSE-ENGINEERING.md
│   ├── OPENASP-SPESIFIKASI-ANTROPOMETRI-v0.1.md
│   ├── OPENASP-MAPPING-EXCEL-BU-BIDAN-v0.2.md
│   ├── OPENASP-ARSITEKTUR-APLIKASI-v0.1.md
│   └── OPENASP-NEXT-STEPS.md
├── src/
│   ├── app/
│   ├── components/
│   │   ├── ui/
│   │   ├── atoms/
│   │   ├── molecules/
│   │   ├── organisms/
│   │   └── templates/
│   ├── features/
│   │   ├── children/
│   │   ├── measurements/
│   │   ├── excel-import/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   └── settings/
│   ├── domain/
│   │   ├── child/
│   │   ├── anthropometry/
│   │   ├── skdn/
│   │   └── reporting/
│   ├── infrastructure/
│   │   ├── storage/
│   │   ├── excel/
│   │   └── export/
│   ├── store/
│   └── lib/
├── tests/
│   └── e2e/
├── package.json
└── README.md
```

Struktur ini adalah arah awal, bukan kewajiban membuat seluruh folder kosong sejak hari pertama. Tambahkan folder saat fitur terkait mulai dikerjakan.

---

## 4. Status Analisis Sebelum Implementasi

### 4.1 Referensi workbook

Workbook yang telah dibahas:
- `ASP KARANGTAWAR 2025.xls`
- `BU BIDAN_FORMAT UKUR MASTER KARANGTAWAR SEPTEMBER.xls`

Catatan:
- Workbook Bu Bidan memiliki sheet `CONTOH`, `Tambah Balita`, dan sheet bulanan Januari–Desember.
- Struktur antar-sheet bulanan tidak sepenuhnya seragam.
- Kolom yang ditemukan mencakup identitas anak, tanggal lahir (tidak selalu tersedia di setiap sheet), tanggal pengukuran, berat badan, tinggi/panjang badan, LILA, lingkar kepala, edema pitting, metode/posisi pengukuran, Vitamin A, ASI 0–6 bulan, kelas ibu balita, dan MBG.
- Sheet `CONTOH` bukan data yang harus diimpor.
- Beberapa workbook perlu digabungkan dengan master data balita karena tanggal lahir tidak selalu tersedia di sheet bulanan.
- Data dapat menggunakan format angka desimal koma.
- Belum semua formula, macro, referensi antar-sheet, dan perilaku workbook ASP berhasil direverse-engineer. Jangan menganggap hasil reverse engineering sudah lengkap.

### 4.2 Strategi import

Gunakan adapter terpisah untuk setiap format workbook:

```text
Excel file
   ↓
Workbook detector
   ↓
Template-specific adapter
   ↓
Raw rows
   ↓
Normalization
   ↓
Validation + import preview
   ↓
User confirmation
   ↓
Canonical application data
```

Target awal adapter:
- `BuBidanAdapter`
- `AspKarangtawarAdapter` (setelah struktur workbook cukup dipahami)

Jangan membuat satu parser besar yang berisi banyak kondisi berdasarkan nama sheet/kolom. Pisahkan deteksi template, pemetaan kolom, normalisasi, dan validasi.

### 4.3 Model data konseptual awal

Model final belum dikunci. Mulai dari konsep berikut:

- **Child**: identitas dan data dasar balita.
- **Measurement**: satu kejadian pengukuran pada tanggal tertentu.
- **MeasurementValue**: berat, panjang/tinggi, LILA, lingkar kepala, edema, dan metadata pengukuran.
- **SupplementationRecord**: Vitamin A dan intervensi/suplemen lain bila diperlukan.
- **Posyandu**: unit layanan/posyandu.
- **ImportBatch**: asal file, template, waktu import, ringkasan hasil, dan status proses.

Pisahkan data anak dari data pengukuran. Satu anak dapat memiliki banyak catatan pengukuran.

---

## 5. Catatan Antropometri — Batasan Penting

Perhitungan antropometri adalah domain yang sensitif dan harus divalidasi dengan referensi resmi serta tenaga kesehatan yang kompeten sebelum dipakai untuk keputusan klinis.

### Referensi utama

- Permenkes RI No. 2 Tahun 2020 tentang Standar Antropometri Anak.
- WHO Child Growth Standards 2006 untuk anak usia 0–5 tahun.
- WHO Anthro sebagai referensi pembanding implementasi algoritma.

### Indeks yang direncanakan

- BB/U — berat badan menurut umur.
- PB/U atau TB/U — panjang/tinggi badan menurut umur.
- BB/PB atau BB/TB — berat badan menurut panjang/tinggi badan.
- IMT/U — indeks massa tubuh menurut umur.

### Hal yang belum boleh diasumsikan final

- Batas usia dan aturan koreksi posisi pengukuran harus dipastikan konsisten dengan referensi yang dipilih.
- Rumus LMS dasar saja belum cukup untuk semua kondisi ekstrem; aturan WHO untuk nilai di luar rentang tertentu harus diimplementasikan dengan benar.
- Ambang klasifikasi harus diverifikasi, termasuk batas inklusif/eksklusif.
- Rumus Excel ASP dapat berbeda dari standar resmi. Perbedaan harus didokumentasikan, bukan disamarkan.
- Data tabel LMS harus memiliki sumber, versi, satuan, jenis kelamin, indeks, dan rentang usia/tinggi yang jelas.
- Semua perhitungan harus memiliki golden test yang dibandingkan dengan hasil referensi WHO yang valid.

**Jangan membuat angka LMS sendiri atau menyalin tabel dari sumber tidak resmi.**

---

## 6. Tahapan Pengembangan

### Phase 0 — Project Foundation (langkah berikutnya)

Tujuan: menyiapkan repository dan kerangka aplikasi yang bisa dikembangkan secara konsisten.

Checklist:

- [ ] Tentukan repository GitHub (repository baru atau repository yang sudah ada).
- [ ] Buat project Next.js dengan App Router dan TypeScript.
- [ ] Aktifkan TypeScript strict mode.
- [ ] Pasang dan konfigurasi Tailwind CSS.
- [ ] Pasang shadcn/ui dan siapkan komponen dasar.
- [ ] Siapkan ESLint dan formatter.
- [ ] Buat struktur folder awal.
- [ ] Buat layout responsif untuk desktop dan mobile.
- [ ] Buat navigasi utama.
- [ ] Buat halaman placeholder untuk Dashboard, Data Balita, Pengukuran, Import Excel, Laporan, dan Pengaturan.
- [ ] Tambahkan README berisi cara instalasi dan menjalankan project.
- [ ] Pastikan `npm run build` berhasil.
- [ ] Buat commit awal.

### Definition of Done Phase 0

- Project dapat dijalankan secara lokal.
- Build production berhasil.
- Tidak ada error TypeScript.
- Layout dapat digunakan pada layar HP dan desktop.
- Navigasi ant halaman berjalan.
- Struktur folder dan konvensi kode terdokumentasi.
- Belum perlu ada perhitungan antropometri atau penyimpanan data sungguhan.

### Phase 1 — Excel Import Foundation

- Workbook detector.
- Adapter untuk format Bu Bidan.
- Normalisasi tanggal, angka, jenis kelamin, dan satuan.
- Preview sebelum import.
- Validasi baris dan ringkasan error/warning.
- Simpan hasil ke IndexedDB setelah konfirmasi.
- Uji file dengan variasi struktur sheet.

### Phase 2 — Data Balita dan Pengukuran

- CRUD data balita.
- Riwayat pengukuran.
- Relasi anak dan pengukuran.
- Pencarian dan filter.
- Penyimpanan lokal menggunakan IndexedDB.

### Phase 3 — Mesin Antropometri

- Implementasi data referensi LMS resmi.
- Perhitungan empat indeks.
- Aturan usia, posisi, dan satuan.
- Klasifikasi sesuai regulasi.
- Golden test dan validasi tenaga kesehatan.

### Phase 4 — Dashboard dan Laporan

- Rekap jumlah balita.
- Rekap pengukuran bulanan.
- Rekap status antropometri.
- Rekap SKDN dan indikator tambahan sesuai definisi yang disepakati.
- Export Excel.

### Phase 5 — PWA, Hardening, dan Deployment

- PWA/installability.
- Backup dan restore data lokal.
- Pengujian lintas browser/perangkat.
- Aksesibilitas.
- Optimasi performa.
- Dokumentasi privasi dan batasan aplikasi.
- Deployment Vercel.

---

## 7. UX dan Navigasi Awal

Navigasi utama yang disarankan:

1. **Dashboard**
   - Ringkasan aktivitas dan data bulan berjalan.
2. **Data Balita**
   - Daftar, pencarian, tambah, edit, dan detail balita.
3. **Pengukuran**
   - Input dan riwayat pengukuran.
4. **Import Excel**
   - Pilih template, upload file, preview, validasi, konfirmasi.
5. **Laporan**
   - Rekap bulanan, SKDN, dan export.
6. **Pengaturan**
   - Profil Posyandu, preferensi, backup, dan restore.

Untuk mobile, gunakan navigasi yang tidak memakan banyak ruang. Tabel lebar perlu memiliki strategi tampilan mobile, misalnya card/list view atau kolom prioritas, bukan sekadar mengecilkan seluruh tabel.

---

## 8. Privasi, Keamanan, dan Backup

MVP direncanakan memproses file Excel langsung di browser.

- Jangan mengirim workbook atau data anak ke server.
- Jangan menaruh data anak di `localStorage` sebagai database.
- Gunakan IndexedDB melalui Dexie.
- Jangan memasukkan nama, NIK, tanggal lahir, atau data sensitif ke log/analytics.
- Sediakan backup dan restore yang mudah dipahami.
- Jelaskan bahwa data lokal dapat hilang jika browser/site data dihapus atau perangkat rusak.
- Uji mekanisme backup/restore sebelum aplikasi dipakai secara rutin.
- Jika kelak ada fitur sinkronisasi/cloud, desain consent, autentikasi, enkripsi, retensi, dan penghapusan data harus dibahas secara terpisah.

---

## 9. Konvensi Implementasi

- Gunakan TypeScript strict.
- Hindari `any`; gunakan tipe domain dan schema validasi.
- Nama variabel/fungsi menjelaskan maksud.
- Pisahkan UI, use case, domain logic, dan infrastruktur.
- Hindari business logic di `page.tsx`.
- Hindari file raksasa dan komponen yang mengerjakan banyak hal.
- Jangan membuat abstraksi generik sebelum ada kebutuhan nyata.
- Simpan konstanta domain dan definisi klasifikasi di satu tempat yang jelas.
- Tulis unit test untuk setiap fungsi perhitungan dan normalisasi penting.
- Gunakan data sintetis untuk fixture dan screenshot dokumentasi.

---

## 10. Keputusan yang Masih Terbuka

- [ ] Apakah repository GitHub OpenASP sudah tersedia atau akan dibuat baru?
- [ ] Nama repository dan package manager (npm/pnpm).
- [ ] Apakah aplikasi akan fokus pada satu Posyandu per browser pada MVP?
- [ ] Apakah master data balita diambil dari workbook tertentu atau pengguna menginput dari awal?
- [ ] Aturan deduplikasi jika NIK kosong atau data identitas tidak lengkap.
- [ ] Definisi final indikator SKDN dan indikator tambahan lokal.
- [ ] Versi data LMS dan mekanisme pembaruan referensi.
- [ ] Bentuk template export Excel yang harus dipertahankan.

---

## 11. Prompt untuk Melanjutkan di Sesi Berikutnya

Salin prompt ini ketika ingin melanjutkan:

> Kita sedang mengembangkan OpenASP, aplikasi web/PWA gratis untuk pencatatan Posyandu dan antropometri anak. Gunakan dokumen `OPENASP-NEXT-STEPS.md` sebagai konteks kelanjutan, bersama dokumen reverse engineering, spesifikasi antropometri, mapping Excel Bu Bidan, dan arsitektur aplikasi yang sudah dibuat.
>
> Saat ini langkah berikutnya adalah Phase 0 — Project Foundation. Bantu saya melanjutkan secara bertahap, jangan langsung membuat seluruh aplikasi. Mulai dengan memastikan status repository, lalu siapkan project Next.js App Router + TypeScript strict, Tailwind, shadcn/ui, struktur folder, layout responsif, dan halaman placeholder.
>
> Pertahankan prinsip: domain logic terpisah dari UI, data anak diproses lokal di browser untuk MVP, standar resmi menjadi sumber kebenaran antropometri, dan workbook Excel hanya menjadi adapter workflow/kompatibilitas.
>
> Jelaskan alasan keputusan teknis yang penting dan berikan langkah yang bisa saya jalankan serta verifikasi satu per satu. Jangan mengarang isi workbook atau standar yang belum diverifikasi.

---

## 12. Catatan Status

Dokumen ini adalah **rencana kerja**, bukan bukti bahwa fitur sudah diimplementasikan. Semua item checklist harus diperbarui setelah benar-benar selesai. Jika ada keputusan baru, catat tanggal, alasan, dan dampaknya agar arah pengembangan tetap konsisten.
