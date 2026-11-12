# OpenASP — Arsitektur Aplikasi dan Rencana Implementasi
**Versi:** 0.1-draft  
**Tanggal:** 12 November 2026  
**Stack target:** Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui  
**Deployment target:** Vercel  
**Status:** Rancangan arsitektur MVP

---

## 1. Tujuan arsitektur

OpenASP adalah aplikasi web responsif/PWA untuk membantu pencatatan, import Excel, pemantauan antropometri, rekap Posyandu, dan ekspor laporan.

Arsitektur harus:
- mudah dibaca oleh developer lain;
- memisahkan UI, business logic, data access, dan integrasi file;
- mendukung beberapa format Excel tanpa mengikat domain ke satu template;
- memisahkan perhitungan antropometri dari tampilan;
- dapat diuji secara otomatis;
- menjaga data anak tetap di perangkat pengguna pada MVP;
- memungkinkan backend ditambahkan kemudian tanpa menulis ulang seluruh aplikasi.

**Pilihan arsitektur:** modular monolith berbasis feature/domain modules. Hindari microservices untuk MVP.

## 2. Keputusan teknologi

| Area | Rekomendasi | Alasan |
|---|---|---|
| Framework | Next.js App Router | Routing, layout, deployment Vercel |
| Bahasa | TypeScript strict | Kontrak data yang jelas |
| Styling | Tailwind CSS | Konsisten dan cepat |
| UI primitives | shadcn/ui + Radix | Komponen aksesibel dan dapat dikustomisasi |
| UI composition | Atomic Design | Konsistensi komponen presentasi |
| Form | React Hook Form + Zod | Validasi form dan schema |
| Import Excel | SheetJS (`xlsx`) | Membaca workbook di browser |
| State UI | Zustand | State lintas halaman yang ringan |
| Local persistence | IndexedDB melalui Dexie | Dataset lebih besar daripada localStorage |
| Table | TanStack Table | Tabel besar dan konfigurasi kolom |
| Chart | Recharts | Dashboard |
| Unit/integration tests | Vitest + Testing Library | Uji domain dan komponen |
| E2E | Playwright | Uji alur import sampai ekspor |
| PWA | Serwist atau pendekatan PWA Next.js yang kompatibel | Instalasi dan cache aset statis |

**Catatan:** versi paket harus dipilih dan dikunci saat inisialisasi proyek. Jangan menambahkan library hanya karena populer; setiap dependency harus punya fungsi yang jelas.

## 3. Prinsip arsitektur

### 3.1 Pisahkan domain dari framework

Perhitungan umur, koreksi panjang/tinggi, Z-Score, klasifikasi, SKDN, dan normalisasi data tidak boleh berada di React component atau file `page.tsx`.

Contoh:
- `calculateAge()` tidak boleh bergantung pada React.
- `calculateZScore()` tidak boleh membaca Zustand.
- importer Excel mengubah workbook menjadi model internal, bukan langsung mengubah UI.
- komponen tabel hanya menampilkan data dan memicu callback.

### 3.2 Modular monolith berbasis fitur

Setiap fitur memiliki komponen UI, hooks, schema, dan service yang relevan. Aturan domain yang dipakai lintas fitur ditempatkan pada `domain/` atau `shared/` yang sesuai.

### 3.3 Atomic Design hanya untuk lapisan UI

Atomic Design digunakan untuk menyusun komponen presentasi:
- **Atoms:** Button, Input, Badge, Label, Spinner.
- **Molecules:** SearchField, DateField, StatCard, FileDropzone.
- **Organisms:** Sidebar, DataTable, ImportWizard, ChildForm, MonthlyMeasurementTable.
- **Templates:** DashboardLayout, ImportLayout, ReportLayout.
- **Pages:** route pages Next.js yang menyusun template dan feature components.

Jangan menaruh business logic antropometri di `atoms/`, `molecules/`, atau `organisms/`. Atomic Design mengatur komposisi UI, bukan keseluruhan arsitektur aplikasi.

## 4. Struktur folder yang direkomendasikan

```text
openasp/
├── public/
│   ├── icons/
│   └── manifest.webmanifest
│
├── src/
│   ├── app/
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── children/page.tsx
│   │   │   ├── measurements/page.tsx
│   │   │   ├── import/page.tsx
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [reportType]/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── providers.tsx
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn primitives
│   │   ├── atoms/
│   │   ├── molecules/
│   │   ├── organisms/
│   │   └── templates/
│   │
│   ├── features/
│   │   ├── children/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── schemas/
│   │   │   ├── services/
│   │   │   └── types.ts
│   │   ├── measurements/
│   │   ├── excel-import/
│   │   │   ├── components/
│   │   │   ├── adapters/
│   │   │   │   ├── bu-bidan/
│   │   │   │   └── asp-karangtawar/
│   │   │   ├── parsers/
│   │   │   ├── mappers/
│   │   │   ├── validators/
│   │   │   └── types.ts
│   │   ├── dashboard/
│   │   ├── reports/
│   │   └── settings/
│   │
│   ├── domain/
│   │   ├── child/
│   │   │   ├── child.types.ts
│   │   │   └── child.rules.ts
│   │   ├── anthropometry/
│   │   │   ├── age/
│   │   │   ├── measurement/
│   │   │   ├── references/
│   │   │   │   └── who-2006/
│   │   │   ├── zscore/
│   │   │   ├── classification/
│   │   │   └── anthropometry.types.ts
│   │   ├── skdn/
│   │   └── reporting/
│   │
│   ├── infrastructure/
│   │   ├── storage/
│   │   │   ├── db.ts             # Dexie / IndexedDB
│   │   │   └── repositories/
│   │   ├── excel/
│   │   │   ├── workbook-reader.ts
│   │   │   └── workbook-writer.ts
│   │   └── export/
│   │
│   ├── store/
│   │   ├── app.store.ts
│   │   ├── import.store.ts
│   │   └── ui.store.ts
│   │
│   ├── lib/
│   │   ├── date/
│   │   ├── number/
│   │   ├── result/
│   │   └── constants/
│   │
│   └── test/
│       ├── fixtures/
│       └── helpers/
│
├── docs/
│   ├── architecture/
│   ├── data-mapping/
│   └── anthropometry/
│
├── tests/
│   └── e2e/
│
├── .env.example
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

Folder boleh berkembang mengikuti kebutuhan. Hindari membuat folder kosong atau abstraction yang belum punya use case.

## 5. Batas tanggung jawab setiap lapisan

| Lapisan | Boleh melakukan | Tidak boleh melakukan |
|---|---|---|
| `app/` | Routing, layout, metadata, komposisi halaman | Menghitung Z-Score atau parsing workbook |
| `components/` | Presentasi dan interaksi UI generik | Mengakses workbook/IndexedDB langsung |
| `features/` | Use case fitur, form, hooks, orchestration | Menyimpan standar WHO di komponen |
| `domain/` | Aturan bisnis murni dan kalkulasi | Mengimpor React/Next.js/Zustand |
| `infrastructure/` | Excel, IndexedDB, file export | Menentukan kategori gizi |
| `store/` | State UI dan state sementara | Menjadi sumber kebenaran seluruh data |

**Dependency direction:** `app → features → domain`; `features → infrastructure` melalui interface/repository bila diperlukan. `domain` tidak mengimpor lapisan lain.

## 6. Alur import Excel

```text
Pilih file
   |
   v
Workbook Reader (SheetJS)
   |
   v
Deteksi workbook & sheet
   |
   v
Pilih adapter berdasarkan format
   |
   v
Parse header dan baris
   |
   v
Map ke RawImportRow
   |
   v
Normalize tanggal/angka/boolean
   |
   v
Match data induk dan pengukuran
   |
   v
Validation report
   |
   v
Preview: valid / warning / error
   |
   v
Konfirmasi pengguna
   |
   v
Simpan ke IndexedDB
   |
   v
Hitung ulang ringkasan dan indikator
```

### Kontrak adapter

Setiap adapter menghasilkan model perantara yang sama. Jangan biarkan nama kolom Excel menyebar ke seluruh aplikasi.

```ts
export interface ImportAdapter {
  id: string;
  displayName: string;
  detect(workbook: WorkbookLike): Promise<boolean>;
  parse(workbook: WorkbookLike): Promise<ImportBatch>;
}

export interface ImportBatch {
  source: {
    adapterId: string;
    fileName: string;
    importedAt: string;
  };
  children: ImportedChild[];
  measurements: ImportedMeasurement[];
  warnings: ImportIssue[];
  errors: ImportIssue[];
}
```

`WorkbookLike` di atas adalah ilustrasi kontrak; implementasi aktual mengikuti tipe SheetJS.

### Import harus idempotent

Jika file yang sama diimpor dua kali, sistem tidak boleh menggandakan semua pengukuran. Buat aturan pencocokan yang eksplisit, misalnya:
- child identity: NIK jika tersedia, jika tidak gunakan kombinasi field yang disetujui dan tampilkan potensi duplikat;
- measurement: child internal ID + tanggal ukur + sumber/atribut pengukuran;
- konflik nilai tidak boleh ditimpa diam-diam; tampilkan pilihan review.

NIK dan nomor KK adalah data sensitif. Gunakan hanya bila diperlukan untuk matching, hindari logging, dan jangan kirim ke analytics.

## 7. Alur perhitungan antropometri

```text
Measurement + Child
        |
        v
Validate required inputs
        |
        v
Calculate age (documented rule)
        |
        v
Correct length/height by position
        |
        v
Select WHO reference row(s)
        |
        v
Calculate WAZ / HAZ / WHZ / BAZ
        |
        v
Apply WHO extreme-value algorithm
        |
        v
Classify using Permenkes 2/2020
        |
        v
Store result + reference version + algorithm version
```

Kalkulator harus berupa fungsi murni dan diuji dengan golden test cases terhadap WHO Anthro. Jangan mengaktifkan hasil produksi sebelum tabel LMS dan algoritma ekstrem tervalidasi.

## 8. Data model dan local-first storage

Untuk MVP tanpa login:
- proses workbook di browser;
- simpan dataset secara lokal menggunakan IndexedDB;
- sediakan ekspor/backup dan impor ulang;
- tampilkan informasi bahwa data tersimpan pada perangkat/browser tersebut;
- sediakan fungsi hapus seluruh dataset;
- jangan mengirim data anak ke server, analytics, error monitoring, atau log.

`localStorage` hanya untuk preferensi kecil seperti tema/sidebar. Dataset anak dan hasil pengukuran disimpan di IndexedDB.

### Catatan risiko local-first

Data lokal dapat hilang jika pengguna menghapus data browser, mengganti perangkat, atau memakai mode privat. Karena itu, fitur backup/export dan peringatan pengguna wajib ada. Enkripsi lokal dapat dipertimbangkan, tetapi manajemen kunci harus dirancang dengan benar; jangan membuat enkripsi semu yang memberi rasa aman palsu.

## 9. Next.js: Server Components dan Client Components

Gunakan Server Components secara default untuk shell/layout dan konten statis. Gunakan `"use client"` hanya pada bagian yang memerlukan:
- file picker / drag-and-drop;
- Zustand;
- IndexedDB;
- tabel interaktif;
- chart interaktif;
- form dan wizard.

Karena MVP local-first dan tidak membutuhkan backend, jangan memaksakan server action/API route untuk mengolah file anak. Komponen browser-only harus diisolasi agar library Excel atau chart tidak masuk ke bundle awal yang tidak perlu.

Jika memakai static export untuk deployment, pastikan semua fitur kompatibel dengan static export. Jika memakai runtime Next.js standar di Vercel, tetap pisahkan data pribadi agar tidak pernah terkirim ke server.

## 10. Atomic Design: contoh penerapan

### Atoms
- `Button`
- `Input`
- `Label`
- `Badge`
- `Skeleton`
- `IconButton`

### Molecules
- `FormField`
- `SearchInput`
- `DatePickerField`
- `FileDropzone`
- `StatusBadge`
- `MetricCard`

### Organisms
- `AppSidebar`
- `Topbar`
- `ChildDataTable`
- `ImportFilePanel`
- `ImportValidationSummary`
- `MeasurementForm`
- `MonthlyMeasurementGrid`

### Templates
- `DashboardTemplate`
- `DataManagementTemplate`
- `ImportWizardTemplate`
- `ReportTemplate`

### Feature composition
Contoh halaman import menggabungkan `ImportWizardTemplate` dengan komponen fitur `ExcelImportWizard`. Aturan parsing dan mapping tetap ada di `features/excel-import/`, bukan di organism UI.

Jangan terlalu kaku: jika sebuah komponen hanya dipakai satu fitur dan bukan pola UI generik, simpan dekat fitur tersebut. Tidak semua komponen harus dipaksa menjadi atom/molecule.

## 11. Naming, readability, dan coding conventions

- Gunakan `PascalCase` untuk React components dan types.
- Gunakan `camelCase` untuk functions/variables.
- Gunakan nama domain yang eksplisit: `correctLengthHeight`, `calculateWeightForAgeZScore`.
- Hindari nama generik seperti `utils2`, `dataHelper`, `commonFunction`.
- Hindari barrel `index.ts` berlapis-lapis yang menyulitkan penelusuran dependency.
- Satu file memiliki satu tanggung jawab utama.
- Hindari component besar; pecah berdasarkan tanggung jawab, bukan sekadar jumlah baris.
- Gunakan `type`/`interface` yang eksplisit untuk batas antar modul.
- Aktifkan TypeScript `strict`.
- Validasi input eksternal dengan Zod; TypeScript tidak memvalidasi file Excel saat runtime.
- Tambahkan komentar untuk alasan/aturan yang tidak jelas, bukan mengomentari setiap baris.
- Jangan menyimpan magic number; buat konstanta bernama dan sertakan sumber standar.

## 12. Testing strategy

| Jenis test | Yang diuji |
|---|---|
| Unit domain | Umur, koreksi posisi, LMS, algoritma ekstrem, klasifikasi |
| Unit importer | Header, parser tanggal, angka koma, boolean, adapter tiap format |
| Integration | Import → normalize → validate → persist |
| Component | Form, preview import, tabel, error states |
| E2E | Upload workbook, review warning, konfirmasi, dashboard, export |
| Regression | Golden test WHO dan contoh workbook yang dianonimkan |

Golden test fixtures tidak boleh berisi NIK, nama, alamat, atau nomor telepon asli. Buat dataset sintetis/anonymized dengan kasus batas yang disetujui ahli.

## 13. Tahapan implementasi yang disarankan

### Phase 0 — Foundation (sekarang)
- Buat repository Git.
- Inisialisasi Next.js App Router + TypeScript strict.
- Setup Tailwind dan shadcn/ui.
- Setup ESLint/Prettier dan alias `@/`.
- Buat layout responsif: sidebar desktop, drawer mobile.
- Buat aturan folder dan import boundaries.

**Definition of done:** aplikasi berjalan di lokal dan preview Vercel; lint, typecheck, dan test command tersedia.

### Phase 1 — Domain model & importer
- Finalisasi canonical data model.
- Implementasikan adapter Bu Bidan.
- Implementasikan adapter ASP Karangtawar setelah mapping cukup.
- Parse workbook di browser.
- Tampilkan preview, warning, error, dan ringkasan hasil import.
- Simpan dataset ke IndexedDB setelah konfirmasi.

**Definition of done:** workbook sintetis/anonymized berhasil diimpor, tidak ada duplikasi diam-diam, dan semua warning dapat ditinjau.

### Phase 2 — Data management
- Daftar balita.
- Detail balita dan riwayat pengukuran.
- Tambah/edit pengukuran manual.
- Pencarian dan filter.
- Backup dan restore dataset.

### Phase 3 — Anthropometry engine
- Finalisasi tabel referensi WHO resmi.
- Implementasikan umur, koreksi posisi, LMS dan algoritma ekstrem.
- Cocokkan golden tests dengan WHO Anthro.
- Validasi klasifikasi dengan Permenkes.
- Review tenaga kesehatan.

**Definition of done:** tidak ada selisih kategori pada golden tests; toleransi numerik terdokumentasi; versi referensi dan algoritma tercatat.

### Phase 4 — Dashboard dan laporan
- Dashboard ringkasan.
- Rekap SKDN.
- Rekap kategori antropometri.
- Vitamin A dan ASI.
- Filter periode dan Posyandu.
- Export Excel/PDF.

### Phase 5 — PWA, hardening, dan release
- PWA installability dan offline shell.
- Uji perangkat mobile.
- Uji performa file besar.
- Audit privasi dan keamanan lokal.
- Dokumentasi pengguna dan changelog.

## 14. Hal yang jangan dilakukan

- Jangan membuat satu `page.tsx` berisi seluruh proses import dan kalkulasi.
- Jangan menaruh semua kode ke folder `utils`.
- Jangan mengakses IndexedDB langsung dari komponen UI.
- Jangan menyimpan dataset anak di Zustand sebagai satu-satunya persistence.
- Jangan mengunggah workbook ke API hanya untuk membaca Excel.
- Jangan menanam tabel LMS ke komponen.
- Jangan mencampur klasifikasi Permenkes dengan label workbook lokal.
- Jangan membuat microservices, repository abstraction berlebihan, atau dependency injection framework sebelum ada kebutuhan.
- Jangan menganggap Atomic Design menggantikan pemisahan domain dan feature.

## 15. Keputusan arsitektur sementara

| Area | Keputusan |
|---|---|
| Architecture style | Modular monolith |
| Routing | Next.js App Router |
| UI composition | Atomic Design untuk presentational UI |
| Feature organization | Feature-based modules |
| Business logic | Pure domain modules |
| Excel | Client-side SheetJS + adapter pattern |
| Validation | Zod |
| UI state | Zustand |
| Persistence | IndexedDB + Dexie |
| Backend | Tidak diperlukan untuk MVP |
| Deployment | Vercel |
| Testing | Vitest + Testing Library + Playwright |
| Privacy | Local-first; no child data upload |

---

## 16. Next action

Mulai dari **Phase 0 — Foundation**, bukan langsung membuat semua halaman. Setelah shell dan struktur folder siap, kerjakan **Phase 1 — Importer** dengan workbook uji yang sudah dianonimkan. Ini memberi fondasi yang bisa dipakai ulang oleh seluruh fitur OpenASP.
