# OpenASP — Spesifikasi Mapping Excel Bu Bidan → OpenASP
**Versi:** 0.2-draft (dikoreksi berdasarkan workbook aktual)  
**Tanggal:** 12 November 2026  
**File sumber:** `BU BIDAN_FORMAT UKUR MASTER KARANGTAWAR SEPTEMBER(1).xlsx`  
**Status:** Draft mapping; perlu konfirmasi pemilik format untuk beberapa arti kolom.

## 1. Tujuan

Mendefinisikan cara OpenASP mengimpor workbook Bu Bidan tanpa meminta pengguna menyusun ulang Excel. Importer mengubah data menjadi model internal yang konsisten, lalu menyerahkannya ke validasi dan Anthropometry Engine OpenASP.

**Pemisahan penting:**
- Workbook ini adalah sumber struktur input dan alur kerja.
- Workbook ini bukan sumber kebenaran untuk rumus Z-Score atau klasifikasi.
- Z-Score OpenASP akan dihitung terpisah menggunakan standar yang sudah ditetapkan (Permenkes No. 2 Tahun 2020 dan WHO Child Growth Standards 2006), setelah tabel referensi dan algoritmanya divalidasi.
- Kolom yang maknanya belum jelas tidak boleh ditebak.

## 2. Struktur workbook yang benar-benar ditemukan

Workbook memiliki 14 sheet:
- `CONTOH`
- `Tambah Balita`
- `JANUARI` sampai `DESEMBER`

Tidak ditemukan formula Excel pada workbook yang diperiksa. Artinya, file ini berfungsi sebagai template/data input, bukan workbook perhitungan antropometri otomatis.

### 2.1 Sheet `Tambah Balita`

Header berada pada baris 2, bukan baris 1. Kolom yang ditemukan:

| Header sumber | Field internal yang disarankan | Status |
|---|---|---|
| `No` | `rowNumber` | Metadata |
| `anak_ke` | `birthOrder` | Perlu konfirmasi format |
| `tgl_lahir` | `birthDate` | Teridentifikasi |
| `jenis_kelamin` | `sex` | Teridentifikasi; nilai yang diizinkan perlu dipastikan |
| `nomor_KK` | `familyCardNumber` | Sensitif; hindari jika tidak dibutuhkan |
| `NIK` | `nik` | Sensitif; kunci pencocokan import sementara |
| `nama_anak` | `name` | Data identitas |
| `usia_hamil` | `gestationalAgeAtBirth` | Satuan/format perlu konfirmasi |
| `berat_lahir` | `birthWeightKg` | Satuan perlu dikonfirmasi |
| `panjang_lahir` | `birthLengthCm` | Satuan perlu dikonfirmasi |
| `lingkar_kepala_lahir` | `birthHeadCircumferenceCm` | Satuan perlu dikonfirmasi |
| `kia` | `kiaStatus` | Nilai kategori perlu konfirmasi |
| `kia_bayi_kecil` | `smallBabyKiaStatus` | Makna/nilai perlu konfirmasi |
| `imd` | `imdStatus` | Nilai kategori perlu konfirmasi |
| `nama_ortu` | `parentName` | Data identitas |
| `nik_ortu` | `parentNik` | Sangat sensitif; tidak perlu untuk analitik |
| `hp_ortu` | `parentPhone` | Data pribadi |
| `alamat` | `address` | Data pribadi |
| `rt` | `rt` | Data lokasi |
| `rw` | `rw` | Data lokasi |
| `hapus` | `deleteFlag` | Perlu aturan proses |
| `pindah` | `movedFlag` | Perlu aturan proses |

**Kondisi file:** sheet ini berupa template/header; tidak ada baris balita terisi yang dapat dipakai untuk memverifikasi format nilai aktualnya.

### 2.2 Sheet bulanan `JANUARI`–`MEI`

Header ditemukan pada baris 1. Kolom:

| Header sumber | Field internal | Catatan |
|---|---|---|
| `No` | `rowNumber` | Nomor baris |
| `NIK` | `sourceChildKey` | Pencocokan ke data induk |
| `nama_anak` | `sourceChildName` | Validasi silang, bukan kunci utama |
| `TANGGALUKUR` | `measuredAt` | Tanggal pengukuran |
| `BERAT` | `weightKg` | Berat badan |
| `TINGGI` | `lengthHeightCm` | Perlu dipastikan apakah selalu PB/TB sesuai `CARAUKUR` |
| `LILA` | `lilaCm` | Satuan diasumsikan cm; konfirmasi |
| `lingkar_kepala` | `headCircumferenceCm` | Satuan diasumsikan cm; konfirmasi |
| `Pitting_edema` | `pittingEdema` | Nilai kosong dan kode perlu didefinisikan |
| `CARAUKUR` | `measurementPosition` | Contoh nilai: `Berdiri`, `Terlentang` |
| `vita` | `vitaminAStatus` | Contoh nilai `ya`/`tidak`; jenis kapsul/dosis belum dipisah |
| `asi_bulan_0` ... `asi_bulan_6` | `breastfeedingByMonth[0..6]` | Makna persis tiap bulan perlu dikonfirmasi |
| `kelas_ibu_balita` | `motherToddlerClassAttendance` | Indikator kegiatan |
| `mbg` | `mbgStatus` | Program MBG; definisi operasional perlu konfirmasi |
| `KETERANGAN` | `rowNote` | Contoh template memuat catatan seperti pindah/hapus/data ganda |

### 2.3 Sheet bulanan `JUNI`–`SEPTEMBER`

Memiliki kolom yang sama, dengan tambahan `TANGGAL LAHIR` di antara `nama_anak` dan `TANGGALUKUR`.

| Header sumber | Field internal | Catatan |
|---|---|---|
| `TANGGAL LAHIR` | `birthDateFromMonthlySheet` | Cocokkan dengan data induk; konflik harus menjadi warning |

Kolom lainnya mengikuti mapping bagian 2.2.

### 2.4 Sheet `OKTOBER`–`DESEMBER`

Header tersedia dengan pola yang sama seperti `JANUARI`–`MEI` (tanpa `TANGGAL LAHIR`). Pada file yang diperiksa, sheet ini tampak sebagai template kosong/belum berisi pengukuran.

### 2.5 Sheet `CONTOH`

Memuat contoh pengisian dengan struktur pengukuran bulanan. Ada contoh nilai seperti `berdiri`/`terlentang`, `ya`/`tidak`, serta teks keterangan. Sheet ini berguna untuk memahami format, tetapi **baris contoh tidak boleh ikut diimpor sebagai data balita nyata**.

## 3. Perbedaan struktur antarbulan yang harus ditangani

| Sheet | Struktur tanggal lahir | Kolom utama |
|---|---|---|
| Januari–Mei | Tidak ada `TANGGAL LAHIR` | 21 kolom |
| Juni–Juli | Ada `TANGGAL LAHIR` | 22 kolom |
| Agustus–September | Ada `TANGGAL LAHIR` | 22 kolom |
| Oktober–Desember | Tidak ada `TANGGAL LAHIR` | 21 kolom |

Catatan: perbedaan jumlah kolom berasal dari penambahan kolom tanggal lahir, bukan alasan untuk mengandalkan posisi kolom tetap. Importer wajib membaca nama header dan memetakan berdasarkan header yang dinormalisasi.

## 4. Model data internal

Pisahkan identitas balita dan setiap catatan pengukuran. Jangan menyimpan format Januari–Desember sebagai 12 kelompok kolom tetap.

```ts
type Sex = "M" | "F";
type MeasurementPosition = "STANDING" | "RECUMBENT" | "UNKNOWN";

interface Child {
  id: string;                 // ID internal OpenASP
  sourceKey?: string;         // kunci sementara saat import; mis. NIK
  name: string;
  birthDate: string;          // ISO YYYY-MM-DD
  sex: Sex;
  birthOrder?: number | null;
  birthWeightKg?: number | null;
  birthLengthCm?: number | null;
  birthHeadCircumferenceCm?: number | null;
}

interface Measurement {
  id: string;
  childId: string;
  measuredAt: string;         // ISO YYYY-MM-DD
  weightKg: number | null;
  rawLengthHeightCm: number | null;
  measurementPosition: MeasurementPosition;
  lilaCm: number | null;
  headCircumferenceCm: number | null;
  pittingEdema: boolean | null;
  vitaminAStatus: boolean | null;
  breastfeedingByMonth: Record<number, boolean | null>;
  motherToddlerClassAttendance: boolean | null;
  mbgStatus: boolean | null;
  sourceSheet: string;
  sourceRow: number;
}
```

`sourceKey` tidak harus disimpan permanen setelah proses pencocokan. Untuk MVP yang menjaga privasi, gunakan ID internal dan minimalkan penyimpanan NIK, nomor KK, NIK orang tua, telepon, dan alamat.

## 5. Aturan pencocokan data induk dan pengukuran

### 5.1 Sumber data untuk jenis kelamin dan tanggal lahir

- `jenis_kelamin` hanya ditemukan di sheet `Tambah Balita`.
- `TANGGAL LAHIR` tidak ada pada Januari–Mei dan Oktober–Desember.
- `TANGGAL LAHIR` ditambahkan pada Juni–September.
- Karena itu, jenis kelamin tetap harus diambil dari data induk.
- Tanggal lahir sebaiknya diambil dari data induk sebagai sumber utama; kolom tanggal lahir di sheet Juni–September digunakan sebagai validasi silang.

### 5.2 Pencocokan

Urutan yang disarankan:
1. Cocokkan berdasarkan NIK jika tersedia dan valid.
2. Jika NIK tidak ada, jangan otomatis mencocokkan hanya dari nama. Tampilkan sebagai data belum terhubung untuk ditinjau pengguna.
3. Jika nama anak berbeda tetapi NIK sama, tampilkan warning.
4. Jika tanggal lahir berbeda antara data induk dan sheet bulanan, tampilkan konflik dan minta pengguna memilih sumber yang benar.
5. Jika satu NIK muncul lebih dari sekali dalam sheet/bulan yang sama, tandai kemungkinan duplikasi; jangan hapus otomatis.

NIK adalah pengenal pribadi. Proses pencocokan sebaiknya dilakukan lokal di browser, dan NIK tidak perlu dikirim ke backend untuk MVP.

## 6. Normalisasi nilai

### 6.1 Angka desimal

Sumber memuat angka dengan titik maupun koma desimal, misalnya `15.8` dan `15,8`. Parser harus mendukung keduanya.

Aturan:
- `15,8` → `15.8`
- `15.8` → `15.8`
- sel kosong → `null`
- `-` → `null` hanya jika disepakati sebagai penanda kosong
- jangan mengubah nilai kosong menjadi nol
- jika format ambigu (misalnya pemisah ribuan dan desimal sekaligus), tandai error untuk review

### 6.2 Tanggal

Sumber memuat beberapa format:
- `YYYY-MM-DD`
- `DD/MM/YYYY`
- `DD-MM-YYYY`
- nilai tanggal Excel asli (serial/date cell)

Importer harus membaca tipe tanggal Excel terlebih dahulu; jika berupa teks, parse dengan format eksplisit. Jangan memakai parser tanggal bebas yang dapat menukar hari dan bulan.

Simpan hasil sebagai `YYYY-MM-DD`.

### 6.3 Cara ukur

Normalisasi:
- `Berdiri`, `BERDIRI`, `berdiri` → `STANDING`
- `Terlentang`, `TERLENTANG`, `terlentang` → `RECUMBENT`
- kosong atau nilai lain → `UNKNOWN` dan warning

Simpan juga nilai mentah sumber untuk audit.

### 6.4 Ya/Tidak

Normalisasi case-insensitive:
- `ya`, `YA`, `Ya` → `true`
- `tidak`, `TIDAK`, `Tidak` → `false`
- kosong → `null`
- nilai lain → `UNKNOWN`/warning

Jangan mengartikan nilai kosong sebagai `false`.

### 6.5 Pitting edema

Pada file terlihat sel kosong dan contoh angka `0`, tetapi belum ada kamus nilai yang lengkap. Jangan langsung menyimpulkan bahwa `0` berarti tidak ada edema dan angka lain berarti ada edema tanpa konfirmasi. Untuk sementara simpan `rawPittingEdema` dan tandai `NEEDS_MAPPING` sampai pemilik format mengonfirmasi kode nilai.

## 7. Validasi sebelum import

### Error — tidak boleh diimpor sebelum diperbaiki
- NIK duplikat yang membuat identitas anak ambigu.
- NIK pengukuran tidak ditemukan di data induk.
- Tanggal pengukuran tidak valid.
- Tanggal lahir tidak tersedia untuk penghitungan umur.
- Jenis kelamin tidak tersedia untuk lookup referensi WHO.
- Berat/tinggi terisi tetapi bukan angka yang dapat diparse.
- Tanggal pengukuran lebih awal dari tanggal lahir.

### Warning — boleh ditinjau dan dikonfirmasi
- Nama anak berbeda antara data induk dan sheet bulanan.
- Tanggal lahir bulanan berbeda dari data induk.
- Cara ukur kosong/tidak dikenal.
- Nilai antropometri tampak tidak wajar.
- Kolom yang tidak dikenal atau header berubah.
- Duplikasi catatan pengukuran untuk anak dan tanggal yang sama.
- `Pitting_edema` belum memiliki mapping kode.

Validasi rentang antropometri adalah pemeriksaan kualitas input, bukan diagnosis. Jangan menghapus otomatis nilai ekstrem.

## 8. Desain proses import

```text
Pilih file Excel
      |
      v
Baca workbook lokal di browser
      |
      v
Kenali sheet dan baris header
      |
      v
Petakan header berdasarkan nama
      |
      v
Impor data induk (Tambah Balita)
      |
      v
Impor sheet pengukuran bulanan
      |
      v
Normalisasi angka, tanggal, ya/tidak, cara ukur
      |
      v
Cocokkan child berdasarkan NIK
      |
      v
Validasi dan deteksi konflik/duplikasi
      |
      v
Tampilkan preview dan ringkasan
      |
      v
Pengguna konfirmasi
      |
      v
Simpan ke state lokal OpenASP
      |
      v
Anthropometry Engine menghitung hasil
```

Preview harus menampilkan:
- sheet yang dikenali dan dilewati;
- jumlah data induk;
- jumlah catatan pengukuran;
- jumlah valid, warning, dan error;
- jumlah anak yang belum cocok ke data induk;
- konflik tanggal lahir/nama;
- header yang tidak dikenali;
- contoh data yang sudah dinormalisasi (tanpa menampilkan NIK penuh).

## 9. Adapter dan pemetaan header

Jangan mengandalkan nomor kolom. Gunakan kamus alias header, setelah normalisasi huruf besar/kecil, spasi, dan tanda baca.

Contoh:

```ts
const headerAliases = {
  nik: ["NIK"],
  name: ["nama_anak", "NAMA ANAK"],
  birthDate: ["tgl_lahir", "TANGGAL LAHIR"],
  measuredAt: ["TANGGALUKUR", "TANGGAL UKUR"],
  weightKg: ["BERAT", "BB"],
  lengthHeightCm: ["TINGGI", "TB", "PANJANG"],
  measurementPosition: ["CARAUKUR", "CARA UKUR"],
  lilaCm: ["LILA"],
  headCircumferenceCm: ["lingkar_kepala", "LINGKAR KEPALA"],
  pittingEdema: ["Pitting_edema", "PITTING EDEMA"],
  vitaminAStatus: ["vita", "VITA"],
};
```

Alias `BB`, `TB`, `PANJANG` adalah kandidat untuk format lain dan tidak berarti semuanya sudah ditemukan di workbook Bu Bidan ini. Adapter Bu Bidan harus menggunakan header yang benar-benar terdeteksi.

## 10. Hubungan dengan Anthropometry Engine

Setelah import:
- `birthDate`, `measuredAt`, dan `sex` menjadi input umur dan lookup referensi.
- `weightKg` menjadi input WAZ dan WHZ/BAZ.
- `rawLengthHeightCm` dan `measurementPosition` menjadi input koreksi posisi dan HAZ/WHZ/BAZ.
- LILA, lingkar kepala, Vitamin A, ASI, kelas ibu balita, dan MBG disimpan sebagai indikator terpisah; jangan mencampurkannya ke rumus Z-Score WHO tanpa standar yang sesuai.

Kolom `CARAUKUR` menentukan apakah nilai tinggi adalah hasil pengukuran berdiri atau telentang. OpenASP perlu menerapkan aturan koreksi yang sudah ditetapkan pada spesifikasi antropometri dan menyimpan nilai mentah serta nilai terkoreksi secara terpisah.

## 11. Data yang tidak boleh diasumsikan

Hal-hal berikut belum dapat dipastikan dari workbook ini:
1. Satuan dan presisi resmi berat lahir, panjang lahir, lingkar kepala, LILA, dan tinggi/ panjang pengukuran (meskipun angka tampak konsisten dengan kg/cm).
2. Definisi operasional `usia_hamil`.
3. Makna pasti `anak_ke`.
4. Kamus nilai `Pitting_edema`.
5. Apakah `vita` merujuk pada kapsul Vitamin A tertentu, warna/dosis, atau sekadar status pemberian.
6. Definisi tiap `asi_bulan_0` sampai `asi_bulan_6` (misalnya apakah kolom menyatakan pemberian ASI pada bulan tersebut atau status ASI eksklusif).
7. Definisi operasional `kelas_ibu_balita` dan `mbg`.
8. Apakah `hapus` dan `pindah` adalah flag, tanggal, atau instruksi administrasi.
9. Posyandu mana yang menjadi asal setiap baris—tidak ada kolom Posyandu yang terlihat pada sheet bulanan yang diperiksa.
10. Apakah ada aturan tambahan di luar workbook (misalnya file pendamping atau prosedur manual).

Kolom yang belum jelas harus disimpan sebagai raw value atau dikecualikan dari kalkulasi sampai dikonfirmasi.

## 12. Acceptance criteria

Importer Bu Bidan dianggap siap untuk MVP jika:
- mengenali `Tambah Balita` dengan header di baris 2;
- mengenali sheet bulanan dengan header di baris 1;
- menerima variasi bulanan yang memiliki/tidak memiliki `TANGGAL LAHIR`;
- memetakan berdasarkan header, bukan posisi kolom;
- membaca tanggal Excel dan teks tanggal dengan benar;
- membaca koma/titik desimal;
- mempertahankan kosong sebagai `null`;
- menormalisasi `Berdiri`/`Terlentang` dan `Ya`/`Tidak`;
- mendeteksi NIK yang tidak terhubung, duplikasi, dan konflik DOB;
- tidak mengimpor sheet `CONTOH` sebagai data nyata;
- menampilkan preview sebelum konfirmasi;
- memproses file di browser tanpa mengirim data identitas ke server.

## 13. Kesimpulan

Format workbook Bu Bidan **dapat didukung sebagai salah satu adapter import OpenASP**. Implementasi harus berdasarkan header aktual, menangani variasi struktur bulanan, dan menggabungkan data pengukuran dengan data induk untuk memperoleh tanggal lahir serta jenis kelamin.

Alur target:

**Excel Bu Bidan → Import Adapter → Normalized Child & Measurement → Validation → WHO/Permenkes Anthropometry Engine → Dashboard/Report/Export**

Dokumen ini masih draft. Sebelum business rule indikator non-antropometri ditetapkan, perlu konfirmasi dari pemilik workbook/kader/bidan mengenai arti kolom yang belum jelas.
