# OpenASP — Spesifikasi Mapping Excel Bu Bidan → OpenASP
**Versi:** 0.1-draft  
**Tanggal:** 12 November 2026  
**Basis:** Workbook `BU BIDAN_FORMAT UKUR MASTER KARANGTAWAR SEPTEMBER` dan hasil ekstraksi sheet yang tersedia.

## 1. Tujuan

Dokumen ini mendefinisikan cara OpenASP membaca format Excel Bu Bidan tanpa mengharuskan pengguna mengubah template Excel asal.

Prinsip:

- Excel asal adalah **format input**, bukan sumber kebenaran klasifikasi antropometri.
- Data diubah ke model internal OpenASP.
- Perhitungan Z-Score dan klasifikasi dilakukan oleh Anthropometry Engine OpenASP.
- Data identitas sensitif tidak perlu dikirim ke server untuk MVP; proses import dapat dilakukan di browser.
- Kolom yang belum dapat dipastikan dari struktur sumber diberi status `NEEDS_VALIDATION`, bukan ditebak.

## 2. Struktur yang teridentifikasi dari sumber

Ekstraksi workbook menunjukkan kelompok sheet:

- `CONTOH`
- `Tambah Balita`
- `JANUARI`
- `FEBRUARI`
- `MARET`
- `APRIL`
- `MEI`
- `JUNI`
- `JULI`
- `AGUSTUS`
- `SEPTEMBER`
- `OKTOBER`
- `NOVEMBER`
- `DESEMBER`

Sheet bulanan memiliki pola data pengukuran dan monitoring. Ekstraksi juga menunjukkan adanya sheet/area hasil antropometri dengan kolom Z-Score, status gizi, IMT, dan parameter L/M/S.

## 3. Mapping data induk

### 3.1 Kolom yang teridentifikasi

| Sumber | Field internal | Status |
|---|---|---|
| `tgl_lahir` | `birthDate` | CONFIRMED |
| `NIK` | `nik` | CONFIRMED |
| `nama_anak` | `name` | CONFIRMED |
| `berat_lahir` | `birthWeightKg` | CONFIRMED |
| `tinggi` | `birthLengthCm` / `birthHeightCm` | CONFIRMED, nama sumber perlu konteks |
| `kia` | `kia` | CONFIRMED |
| `imd` | `imd` | CONFIRMED |
| `nama_ortu` | `parentName` | CONFIRMED |
| `nik_ortu` | `parentNik` | CONFIRMED |
| `hp_ortu` | `parentPhone` | CONFIRMED |
| `alamat` | `address` | CONFIRMED |
| `rt` | `rt` | CONFIRMED |
| `rw` | `rw` | CONFIRMED |
| `Bln pert` | `birthMonth` / field terkait | NEEDS_VALIDATION |
| jenis kelamin `L/P` | `sex` | CONFIRMED dari struktur sheet hasil |

**Catatan:** `nik`, `parentNik`, `parentPhone`, dan `address` adalah data sensitif. OpenASP tidak perlu memasukkan semuanya ke model analitik jika tidak diperlukan.

## 4. Mapping data pengukuran

Ekstraksi sumber secara eksplisit menunjukkan header:

`No, NIK, TANGGALUKUR, TINGGI, CARAUKUR, BERAT, vita, vita_nilai, asi_bulan_1 ... asi_bulan_6, LILA 1 ... LILA 12, lingkar_kepala, pemberian_ke, sumber_pmt, pemberian_pusat, tahun_produksi, pemberian_daerah, CHEK`

Mapping:

| Kolom sumber | Field OpenASP | Status |
|---|---|---|
| `NIK` | `childNik` | CONFIRMED |
| `TANGGALUKUR` | `measuredAt` | CONFIRMED |
| `TINGGI` | `lengthHeightCm` | CONFIRMED |
| `CARAUKUR` | `measurementPosition` | CONFIRMED |
| `BERAT` | `weightKg` | CONFIRMED |
| `vita` | `vitaminA` | CONFIRMED |
| `vita_nilai` | `vitaminAValue` | CONFIRMED |
| `asi_bulan_1` ... `asi_bulan_6` | `exclusiveBreastfeeding[1..6]` | CONFIRMED |
| `LILA 1` ... `LILA 12` | `lilaHistory[1..12]` | CONFIRMED sebagai kolom sumber; makna bulan/tanggal perlu dipetakan |
| `lingkar_kepala` | `headCircumferenceCm` | CONFIRMED |
| `pemberian_ke` | `pmtDistribution` | CONFIRMED |
| `sumber_pmt` | `pmtSource` | CONFIRMED |
| `pemberian_pusat` | `pmtFromCenter` | CONFIRMED |
| `tahun_produksi` | `productionYear` | CONFIRMED |
| `pemberian_daerah` | `pmtFromRegion` | CONFIRMED |
| `CHEK` | `checkFlag` | CONFIRMED |

## 5. Data bulanan

Ekstraksi sheet hasil pengukuran menunjukkan pola:

- `JAN` → `Umur`, `BB`, `TB`
- `FEB` → `Umur`, `BB`, `TB`
- ...
- `DES` → `Umur`, `BB`, `TB`

Selain itu ada:

- `Vit.A` biru
- `Vit.A` merah
- `ASI-E` Ya/Tidak
- `STATUS PERTUMBUHAN`
- status numerik/indikator lain

OpenASP sebaiknya **tidak menjadikan kolom JAN–DES sebagai struktur database utama**. Sebaliknya, ubah menjadi array pengukuran:

```ts
type Measurement = {
  childId: string;
  measuredAt: string;
  ageInCompletedMonths: number | null;
  weightKg: number | null;
  lengthHeightCm: number | null;
  measurementPosition:
    | "STANDING"
    | "RECUMBENT"
    | "UNKNOWN";
};
```

Dengan demikian, satu anak dapat memiliki 0–12 atau lebih catatan pengukuran tanpa mengubah struktur database.

## 6. Cara menghubungkan data induk dan pengukuran

Kunci utama import:

```text
NIK
```

Alur:

```text
Data Induk
    |
    | NIK
    v
Child
    |
    +---- Measurement Januari
    +---- Measurement Februari
    +---- Measurement Maret
    +---- ...
    +---- Measurement Desember
```

Namun OpenASP sebaiknya membuat `childId` internal.

```ts
Child {
  id: string;        // internal
  nik?: string;      // external identifier
  name: string;
  birthDate: string;
  sex: "M" | "F";
}
```

## 7. Normalisasi format angka

Workbook sumber menggunakan nilai seperti:

- `15.8`
- `16.4`
- `102`
- `59.0`

dan dalam beberapa konteks Excel Indonesia dapat menggunakan koma desimal.

Importer harus menerima:

```text
15.8
15,8
"15.8"
"15,8"
```

dan mengubahnya menjadi:

```ts
15.8
```

Tetapi:

```text
""
null
"-"
"FALSE"
```

tidak boleh otomatis menjadi `0`.

`0` harus dipertahankan sebagai nol hanya jika memang merupakan nilai sumber yang valid untuk field tersebut.

## 8. Normalisasi cara ukur

Sumber menunjukkan nilai seperti:

```text
Terlentang
Berdiri
```

Normalisasi:

```ts
function normalizeMeasurementPosition(value: string) {
  const v = value.trim().toLowerCase();

  if (v === "terlentang") return "RECUMBENT";
  if (v === "berdiri") return "STANDING";

  return "UNKNOWN";
}
```

Nilai hasil normalisasi digunakan oleh Anthropometry Engine untuk menentukan apakah koreksi posisi diperlukan.

Nilai sumber tetap disimpan untuk audit.

## 9. Jangan langsung memakai Z-Score dari Excel

Ekstraksi workbook juga menunjukkan kolom:

- `NILAI Z_SCORE`
- `TB / U`
- `BB / U`
- `BB / TB`
- `L`
- `M`
- `S`
- `zsc`
- `ZSC_TBU`
- `ZSC_BBU`
- status gizi
- `IMT`

Ini sangat berguna untuk **reverse engineering dan golden test**.

Namun OpenASP sebaiknya:

```text
Excel Z-Score
      |
      v
REFERENCE / COMPARISON
      |
      X
      |
      v
WHO/Permenkes Engine
      |
      v
OpenASP Z-Score
```

Bukan:

```text
Excel Z-Score --> OpenASP
```

Alasannya, workbook bisa memiliki rumus/versi tabel yang berbeda dari standar yang kita tetapkan sebagai sumber kebenaran.

## 10. Golden test dari workbook

Beberapa baris hasil Excel dapat dipilih sebagai test case.

Untuk setiap kasus, simpan secara anonim:

```ts
{
  sex: "M",
  birthDate: "...",
  measuredAt: "...",
  weightKg: 14.1,
  lengthHeightCm: 98.6,
  measurementPosition: "STANDING",

  excel: {
    waz: -1.30,
    haz: -1.46,
    whz: "...",
    classification: "Normal"
  },

  expected: {
    source: "WHO/Permenkes",
    waz: "...",
    haz: "...",
    whz: "..."
  }
}
```

Nilai identitas seperti nama dan NIK tidak diperlukan dalam fixture.

## 11. Status import

Importer sebaiknya menghasilkan status:

```ts
type ImportRowStatus =
  | "VALID"
  | "WARNING"
  | "INVALID";
```

Contoh:

### VALID

```text
NIK ditemukan
Tanggal lahir valid
Tanggal ukur valid
Berat valid
Tinggi valid
Cara ukur diketahui
```

### WARNING

```text
Tanggal lahir tidak ada di sheet bulanan,
tetapi ditemukan di data induk.
```

### INVALID

```text
NIK tidak ditemukan
Tanggal ukur < tanggal lahir
Berat bukan angka
Tinggi bukan angka
Jenis kelamin tidak ditemukan
```

## 12. Konflik data

Jika data induk dan data bulanan berbeda:

```text
Data induk:
DOB = A

Data bulanan:
DOB = B
```

Jangan memilih salah satu diam-diam.

Importer harus:

```text
WARNING:
Tanggal lahir berbeda antara data induk dan sheet pengukuran.
```

Kemudian pengguna memilih sumber yang benar.

## 13. Mapping model internal

Model akhir:

```ts
interface Child {
  id: string;
  nik?: string;
  name: string;
  birthDate: string;
  sex: "M" | "F";
  posyanduId?: string;
}

interface Measurement {
  id: string;
  childId: string;

  measuredAt: string;

  weightKg: number | null;
  rawLengthHeightCm: number | null;

  measurementPosition:
    | "STANDING"
    | "RECUMBENT"
    | "UNKNOWN";

  lilaCm?: number | null;
  headCircumferenceCm?: number | null;

  pittingEdema?: boolean | null;

  vitaminA?: boolean | null;
  vitaminAValue?: string | null;

  exclusiveBreastfeeding?: boolean | null;

  pmt?: {
    given: boolean;
    source?: string;
  };
}
```

Kemudian hasil antropometri dipisahkan:

```ts
interface AnthropometryResult {
  measurementId: string;

  correctedLengthHeightCm: number | null;
  bmi: number | null;

  waz: number | null;
  haz: number | null;
  whz: number | null;
  baz: number | null;

  wazCategory: string | null;
  hazCategory: string | null;
  whzCategory: string | null;
  bazCategory: string | null;

  standard: "PERMENKES_2_2020_WHO_2006";
  referenceVersion: string;
  algorithmVersion: string;

  flags: string[];
}
```

## 14. Posyandu

Sumber juga menunjukkan nilai seperti `P1` dan nama Posyandu.

OpenASP jangan membatasi jumlah Posyandu menjadi 10.

Gunakan:

```ts
interface Posyandu {
  id: string;
  code: string;
  name: string;
}
```

Sehingga dapat mendukung:

```text
P1
P2
...
P10
P11
P20
```

tanpa mengubah kode.

## 15. Strategi importer

Untuk MVP:

```text
Upload Excel
     |
     v
Detect workbook
     |
     +--> Detect "Tambah Balita"
     |
     +--> Detect monthly sheets
     |
     v
Detect headers
     |
     v
Map columns
     |
     v
Validate
     |
     v
Preview
     |
     v
User confirms
     |
     v
Normalize
     |
     v
Anthropometry Engine
```

Preview wajib menampilkan:

- jumlah balita;
- jumlah pengukuran;
- jumlah data valid;
- jumlah warning;
- jumlah error;
- sheet yang berhasil dikenali;
- kolom yang tidak dikenali.

## 16. Keputusan implementasi

| Area | Keputusan |
|---|---|
| Format sumber | Didukung sebagai adapter |
| Data induk | Dipisahkan dari measurement |
| Kunci pencocokan | NIK, dengan ID internal OpenASP |
| Pengukuran | Model longitudinal/array |
| JAN–DES | Dinormalisasi menjadi records |
| Z-Score Excel | Hanya pembanding/golden test |
| Z-Score OpenASP | WHO + Permenkes |
| Cara ukur | Dinormalisasi |
| Angka desimal | Terima `.` dan `,` |
| Nilai kosong | `null`, bukan `0` |
| Posyandu | Dinamis |
| Data sensitif | Minimalkan dan proses lokal untuk MVP |
| Import | Preview → validation → confirm → normalize |

## 17. Yang masih perlu divalidasi

Belum boleh diasumsikan:

1. Arti pasti semua kolom `LILA 1–12`.
2. Arti pasti `CHEK`.
3. Hubungan `pemberian_ke`, `sumber_pmt`, dan field PMT lainnya.
4. Rumus yang menghasilkan kolom Z-Score pada workbook.
5. Versi pasti tabel LMS yang digunakan workbook.
6. Arti seluruh kolom hasil seperti `**`, `PDK`, `S.PDK`, `BGM`, `KRS`, `S.KRS`, `GMK`, `MSL`, `CALON`, `DS`, `POSY`, dan `BBK`.
7. Apakah semua sheet bulanan menggunakan struktur yang identik.
8. Aturan persis yang digunakan workbook untuk menentukan `UMUR`.
9. Aturan NTOB dan indikator SKDN lain.

Semua poin tersebut harus dibuktikan dari formula/header workbook atau sumber resmi sebelum dijadikan business rule OpenASP.

## 18. Kesimpulan

Format Bu Bidan **layak dijadikan input adapter OpenASP**.

Kita tidak perlu mengubah Excel pengguna. Yang perlu dibuat adalah:

**Excel → Importer → Normalized Data → WHO/Permenkes Engine → OpenASP Report**

Dengan cara ini OpenASP dapat menerima beberapa variasi format Posyandu tanpa mengorbankan konsistensi perhitungan antropometri.
