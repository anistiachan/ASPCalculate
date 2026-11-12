# OpenASP — Spesifikasi Perhitungan Antropometri
**Versi:** 0.1-draft  
**Tanggal:** 12 November 2026  
**Status:** Draft teknis untuk validasi; belum untuk penggunaan klinis/keputusan tata laksana.

## 1. Tujuan dan prinsip

Dokumen ini menetapkan dasar awal perhitungan antropometri OpenASP untuk anak usia 0–60 bulan. Tujuannya adalah menghasilkan perhitungan yang konsisten, dapat diuji, dan dapat ditelusuri sumber standarnya, sambil tetap mendukung alur input dan format laporan ASP yang sudah digunakan Posyandu.

Prinsip utama:

1. **Standar kesehatan mengalahkan rumus workbook lokal** jika keduanya berbeda.
2. Workbook ASP Karangtawar dan workbook master bidan dipakai untuk memahami alur kerja, kolom input, istilah, dan kebutuhan laporan—bukan otomatis dianggap sebagai sumber kebenaran antropometri.
3. Setiap hasil harus dapat ditelusuri ke data input, versi standar, tabel referensi, dan versi mesin perhitungan.
4. Jangan menyamakan klasifikasi status gizi dengan indikator tren pertumbuhan atau indikator administrasi SKDN.
5. Data anak adalah data pribadi dan kesehatan. MVP sebaiknya memproses file di browser tanpa mengunggah data mentah ke server.

## 2. Sumber standar dan batas penggunaannya

### 2.1 Sumber normatif Indonesia

**Permenkes RI Nomor 2 Tahun 2020 tentang Standar Antropometri Anak** tercatat berstatus berlaku pada JDIH Kemenkes. Peraturan ini menetapkan empat indeks antropometri dan kategori status gizi. Untuk anak 0–5 tahun, standar Indonesia mengacu pada WHO Child Growth Standards 2006.

Sumber:
- JDIH Kemenkes: https://jdih.kemkes.go.id/documents/peraturan-menteri-kesehatan-nomor-2-tahun-2020
- Salinan PDF resmi: https://jdih.kemkes.go.id/storage/documents/pdfs/2020permenkes002.pdf
- Basis data peraturan BPK: https://peraturan.bpk.go.id/Details/152505/

### 2.2 Sumber teknis WHO

WHO Child Growth Standards 2006 menjadi referensi pertumbuhan untuk anak di bawah lima tahun. Dokumentasi WHO menjelaskan metode LMS dan perlunya metode khusus untuk nilai yang berada di luar ±3 SD. Implementasi WHO Anthro menyediakan algoritma dan pemeriksaan kualitas data yang lebih lengkap daripada menerapkan rumus LMS dasar secara langsung.

Sumber:
- WHO Child Growth Standards — Methods and Development: https://www.who.int/publications/i/item/924154693X
- WHO Anthro source/documentation (z-scores): https://github.com/WorldHealthOrganization/anthro/blob/master/man/anthro_zscores.Rd
- WHO Anthro Survey Analyser Quick Guide: https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/anthro-survey-analyser-quickguide.pdf
- WHO Training Course on Child Growth Assessment: https://iris.who.int/bitstream/handle/10665/43601/9789241595070_C_eng.pdf

**Catatan versi:** Jangan mencampur tabel WHO 2006 untuk usia 0–5 tahun dengan WHO Reference 2007 untuk usia 5–18 tahun. Ruang lingkup MVP dokumen ini adalah 0–60 bulan sesuai kebutuhan OpenASP saat ini.

## 3. Indeks yang dihitung

Untuk anak usia 0–60 bulan, OpenASP harus mendukung:

| Kode internal | Nama | Data utama | Kegunaan |
|---|---|---|---|
| WAZ | BB/U | Berat badan, umur, jenis kelamin | Mengidentifikasi berat badan sangat kurang/kurang; bukan alat untuk mengklasifikasikan kegemukan |
| HAZ | PB/U atau TB/U | Panjang/tinggi, umur, jenis kelamin | Mengidentifikasi sangat pendek/pendek |
| WHZ | BB/PB atau BB/TB | Berat badan, panjang/tinggi, jenis kelamin | Menilai wasting dan kelebihan berat badan |
| BAZ | IMT/U | IMT, umur, jenis kelamin | Menilai status gizi berdasarkan IMT menurut umur |

IMT dihitung sebagai:

`BMI = weightKg / (heightCm / 100)²`

Panjang/tinggi yang sudah dikoreksi sesuai posisi pengukuran dipakai secara konsisten untuk indeks yang memerlukannya.

## 4. Umur dan aturan posisi pengukuran

### 4.1 Umur

- Simpan tanggal lahir dan tanggal pengukuran sebagai tanggal kalender, bukan teks bebas.
- Tolak tanggal pengukuran yang lebih awal daripada tanggal lahir.
- Permenkes mendefinisikan umur dalam **bulan penuh** untuk penilaian menurut standar; contoh umur 2 bulan 29 hari dihitung 2 bulan.
- Jangan menghitung umur dengan pembagian sederhana `hari / 30` untuk menentukan bulan penuh.
- Simpan juga umur dalam hari sebagai nilai turunan untuk audit/kompatibilitas algoritma WHO, tetapi aturan pemilihan referensi harus konsisten dengan metode standar yang dipakai.
- Aturan tepat pemetaan umur ke baris/titik referensi WHO harus dikunci setelah tabel resmi dan hasil pembanding WHO Anthro diverifikasi. Jangan mengarang interpolasi umur.

### 4.2 Panjang telentang dan tinggi berdiri

Menurut Permenkes No. 2 Tahun 2020:

| Umur | Pengukuran yang digunakan | Jika posisi salah |
|---|---|---|
| 0 sampai 24 bulan | Panjang badan telentang | Jika diukur berdiri, tambahkan 0,7 cm |
| Di atas 24 bulan | Tinggi badan berdiri | Jika diukur telentang, kurangi 0,7 cm |

Simpan nilai mentah, posisi pengukuran, nilai koreksi, dan nilai final. Jangan menimpa nilai mentah.

WHO Anthro juga mendokumentasikan koreksi +0,7 cm untuk anak di bawah 24 bulan yang diukur berdiri dan -0,7 cm untuk anak berusia 24 bulan atau lebih yang diukur telentang. Dokumentasi WHO menyebut ambang operasional 731 hari dalam implementasi Anthro; OpenASP harus menguji konsistensi batas ini dengan ketentuan bulan penuh pada Permenkes sebelum menetapkan aturan final di kode.

**Validasi khusus:** WHO Anthro mendokumentasikan perlakuan khusus terhadap catatan posisi berdiri yang tidak wajar pada bayi di bawah 9 bulan. OpenASP sebaiknya memberi peringatan/flag dan tidak melakukan koreksi otomatis tanpa kebijakan yang tervalidasi.

## 5. Perhitungan Z-Score

### 5.1 Rumus LMS dasar

Untuk parameter referensi L, M, dan S:

Jika `L != 0`:

`Z = (((X / M) ^ L) - 1) / (L * S)`

Jika `L == 0`:

`Z = ln(X / M) / S`

Keterangan:
- `X`: pengukuran anak (atau IMT untuk BAZ).
- `L`: parameter Box-Cox.
- `M`: median referensi.
- `S`: koefisien variasi.
- L, M, S harus dipilih dari tabel yang cocok dengan indeks, jenis kelamin, umur, serta panjang/tinggi sesuai kebutuhan.

### 5.2 Peringatan penting: nilai di luar ±3 SD

Rumus LMS dasar tidak boleh digunakan begitu saja untuk mengekstrapolasi nilai ekstrem. Materi WHO menjelaskan bahwa WHO Anthro menerapkan modifikasi untuk Z-Score di luar -3 dan +3 SD. Karena itu:

- Jangan menganggap rumus Excel LMS sederhana sudah setara dengan WHO Anthro.
- Implementasikan algoritma ekstrem sesuai dokumentasi/algoritma WHO yang tervalidasi.
- Tambahkan test case pada sekitar -3 dan +3 SD serta nilai ekstrem.
- Jika algoritma ekstrem belum tersedia, tandai hasil sebagai belum tervalidasi; jangan diam-diam mengeluarkan angka presisi palsu.

### 5.3 Tabel referensi

Tabel LMS harus berupa aset data berversi, bukan angka yang ditanam tersebar di kode.

Metadata minimal:
- sumber dan versi standar;
- indeks (WAZ/HAZ/WHZ/BAZ);
- jenis kelamin;
- kelompok umur atau panjang/tinggi;
- L, M, S;
- unit;
- tanggal/versi impor;
- checksum atau identitas file sumber.

Sebelum produksi, tabel harus diverifikasi terhadap sumber WHO resmi dan/atau tabel lampiran resmi Permenkes. Jangan mengambil tabel LMS dari blog, forum, atau salinan tanpa asal-usul.

## 6. Klasifikasi status gizi — Permenkes No. 2 Tahun 2020

Gunakan batas per indeks berikut. Batas kategori tidak boleh disamaratakan.

### 6.1 BB/U (0–60 bulan)

| Z-Score | Kategori |
|---|---|
| `< -3 SD` | Berat badan sangat kurang |
| `-3 SD sampai < -2 SD` | Berat badan kurang |
| `-2 SD sampai +1 SD` | Berat badan normal |
| `> +1 SD` | Risiko berat badan lebih |

Catatan: BB/U rendah perlu dikonfirmasi dengan BB/PB atau BB/TB atau IMT/U. BB/U tidak digunakan untuk mengklasifikasikan anak gemuk/sangat gemuk.

### 6.2 PB/U atau TB/U (0–60 bulan)

| Z-Score | Kategori |
|---|---|
| `< -3 SD` | Sangat pendek |
| `-3 SD sampai < -2 SD` | Pendek |
| `-2 SD sampai +3 SD` | Normal |
| `> +3 SD` | Tinggi |

### 6.3 BB/PB atau BB/TB (0–60 bulan)

| Z-Score | Kategori |
|---|---|
| `< -3 SD` | Gizi buruk |
| `-3 SD sampai < -2 SD` | Gizi kurang |
| `-2 SD sampai +1 SD` | Gizi baik |
| `> +1 SD sampai +2 SD` | Berisiko gizi lebih |
| `> +2 SD sampai +3 SD` | Gizi lebih |
| `> +3 SD` | Obesitas |

### 6.4 IMT/U (0–60 bulan)

| Z-Score | Kategori |
|---|---|
| `< -3 SD` | Gizi buruk* |
| `-3 SD sampai < -2 SD` | Gizi kurang* |
| `-2 SD sampai +1 SD` | Gizi baik |
| `> +1 SD sampai +2 SD` | Berisiko gizi lebih |
| `> +2 SD sampai +3 SD` | Gizi lebih |
| `> +3 SD` | Obesitas |

`*` Permenkes memberi catatan bahwa kriteria diagnosis gizi buruk dan gizi kurang menurut pedoman tata laksana menggunakan indeks BB/PB atau BB/TB.

**Penting:** Tabel di atas menyalin batas dan kategori Permenkes. Implementasi harus menguji batas tepatnya (`-3`, `-2`, `+1`, `+2`, `+3`) agar tidak ada celah atau tumpang tindih. Untuk kategori yang ditulis sebagai “sampai dengan”, gunakan batas inklusif sesuai redaksi regulasi; untuk kategori yang ditulis `>` gunakan eksklusif.

## 7. Evaluasi rumus dari workbook ASP yang sudah diberikan

Rumus berikut merupakan temuan dari formula yang dibagikan pengguna. Rumus ini adalah perilaku workbook yang perlu dipertahankan sebagai pembanding, bukan otomatis rumus final OpenASP.

### 7.1 Formula LMS berlabel BB/TB

```excel
=IF(L18>0,IF(M18>0,(((L18/HA18)^GZ18)-1)/(GZ18*HB18),""),"")
```

Pemetaan yang sudah diketahui dari formula:
- `GZ18` diperlakukan sebagai L;
- `HA18` diperlakukan sebagai M;
- `HB18` diperlakukan sebagai S.

Hal yang belum terbukti:
- pemetaan pasti `L18` dan `M18` ke header/variabel input;
- pemilihan baris LMS;
- penanganan `L = 0`;
- penanganan Z-Score ekstrem;
- apakah tabelnya benar-benar WHO 2006 dan versinya;
- apakah nilai panjang/tinggi sudah dikoreksi.

### 7.2 Formula status TB/U dari ASP

```excel
=IF(M18>0,IF(N18<-3,"S.Pendek",IF(N18<-2,"Pendek",IF(N18<=2,"Normal","Tinggi")))," ")
```

Formula tersebut menggunakan batas atas normal `+2`, sedangkan Permenkes 2/2020 menetapkan normal PB/U atau TB/U sampai `+3 SD`, dan kategori tinggi di atas `+3 SD`. Ini adalah perbedaan nyata yang harus diselesaikan dengan memilih standar Permenkes untuk mesin standar OpenASP, bukan menyalin batas workbook.

### 7.3 Formula status BB/U dari ASP

```excel
=IF(L18>0,IF(O18<-3,"BB S.Krg",IF(O18<-2,"BB Krg",IF(O18<=2,"BB Normal","BB Lbh")))," ")
```

Workbook memakai normal sampai `+2`, sementara Permenkes menetapkan BB/U normal sampai `+1 SD` dan risiko berat badan lebih di atas `+1 SD`. Workbook juga memakai label yang tidak sepenuhnya sama dengan istilah resmi.

### 7.4 Formula status BB/TB dari ASP

```excel
=IF(L18>0,IF(M18>0,IF(P18<-3,"S.Kurus",IF(P18<-2,"Kurus",IF(P18<=2,"Normal","Gemuk")))," "),"")
```

Formula workbook memakai kategori sederhana dan ambang normal sampai `+2`. Permenkes membedakan gizi baik, risiko gizi lebih, gizi lebih, dan obesitas dengan ambang +1, +2, dan +3. OpenASP harus mengikuti kategori resmi dan boleh menyediakan label lama hanya pada lapisan ekspor/kompatibilitas jika pemetaan labelnya disetujui.

### 7.5 Formula IMT dari ASP

```excel
=IF(M18>0,IF(L18>0,L18/(M18*M18*0.0001),""),"")
```

Secara aljabar ini setara dengan `berat_kg / (tinggi_cm / 100)^2`, apabila L adalah berat dalam kg dan M adalah tinggi dalam cm. Pemetaan kolom harus dikonfirmasi dari header sebelum diimplementasikan.

### 7.6 Formula interpolasi lain

Dua formula yang diberikan:

```excel
=IF(M16>20,DP16-((DI16-K16)*(DP16-DO16)),"")
```

```excel
=IF(L18>=1,DW18-((DI18-$K18)*(DW18-$DV18)),"")
```

Bentuknya tampak seperti interpolasi linear antara dua nilai referensi, tetapi makna setiap sel, unit, dan tabel rujukannya belum terpetakan. Jangan menganggap formula ini setara dengan LMS atau menetapkannya sebagai perhitungan WHO sebelum header, nilai referensi, dan contoh hasilnya berhasil direkonstruksi.

## 8. Validasi input dan kualitas data

Validasi minimal:
- tanggal lahir dan tanggal ukur valid;
- tanggal ukur tidak sebelum tanggal lahir;
- jenis kelamin wajib tersedia untuk lookup standar;
- berat badan dan panjang/tinggi harus numerik, positif, dan dalam rentang yang masuk akal;
- posisi pengukuran wajib dipilih atau diberi status tidak diketahui;
- umur di luar cakupan 0–60 bulan tidak boleh diberi klasifikasi 0–60 bulan;
- data hilang tidak boleh diubah menjadi nol;
- edema pitting bilateral harus ditangani sebagai flag klinis khusus dan tidak boleh disamakan dengan nilai berat badan biasa;
- nilai ekstrem ditandai untuk pemeriksaan ulang, bukan otomatis dihapus;
- simpan nilai asli dan hasil koreksi secara terpisah.

Rentang pemeriksaan teknis bukan batas diagnosis. Nilai di luar rentang pemeriksaan harus memunculkan peringatan untuk verifikasi pengukuran, bukan keputusan klinis otomatis.

## 9. Desain output perhitungan

Setiap hasil pengukuran sebaiknya menyimpan:

```ts
type AnthropometryResult = {
  childId: string;
  measuredAt: string;
  ageInDays: number;
  ageInCompletedMonths: number;
  sex: "M" | "F";

  weightKg: number | null;
  rawLengthHeightCm: number | null;
  measurementPosition: "RECUMBENT" | "STANDING" | "UNKNOWN";
  correctedLengthHeightCm: number | null;
  correctionCm: number;

  bmi: number | null;
  waz: number | null;
  haz: number | null;
  whz: number | null;
  baz: number | null;

  wazCategory: string | null;
  hazCategory: string | null;
  whzCategory: string | null;
  bazCategory: string | null;

  flags: string[];
  standardName: "Permenkes 2/2020 + WHO 2006";
  referenceDataVersion: string;
  algorithmVersion: string;
};
```

Ini adalah rancangan tipe awal. Implementasi final perlu menyesuaikan skema data aplikasi dan memastikan tidak menyimpan data identitas berlebihan.

## 10. Test plan dan acceptance criteria

### 10.1 Test matrix minimum

Buat test fixture terpisah untuk:
- laki-laki dan perempuan;
- usia mendekati 0, 6, 24, dan 60 bulan;
- umur tepat di sekitar pergantian bulan penuh;
- pengukuran telentang dan berdiri;
- pengukuran di kedua sisi batas usia 24 bulan;
- nilai Z-Score di sekitar -3, -2, +1, +2, dan +3;
- nilai di luar ±3 SD;
- L sama dengan nol pada LMS;
- data hilang, nol, negatif, dan tidak masuk akal;
- IMT dihitung dari berat dan panjang/tinggi yang sudah dikoreksi.

### 10.2 Sumber pembanding

Untuk setiap test case, bandingkan:
1. hasil OpenASP;
2. hasil WHO Anthro versi yang dicatat;
3. tabel/klasifikasi Permenkes yang relevan;
4. hasil Excel ASP jika kasus yang sama dapat dimasukkan ke workbook.

Catat selisih numerik, kategori, alasan selisih, dan keputusan. Jangan menyatakan cocok hanya berdasarkan pembulatan tampilan.

### 10.3 Acceptance criteria

- Klasifikasi sama dengan kategori Permenkes untuk semua fixture yang valid.
- Z-Score cocok dengan hasil referensi WHO Anthro dalam toleransi numerik yang ditetapkan setelah pengujian.
- Koreksi posisi tepat dan dapat diaudit.
- Nilai ekstrem mengikuti algoritma WHO yang tervalidasi.
- Tidak ada penggunaan formula interpolasi ASP yang belum dipahami sebagai standar.
- Hasil yang tidak dapat dihitung ditampilkan sebagai tidak tersedia beserta alasan, bukan nol.
- Versi tabel referensi dan algoritma tercatat pada setiap hasil.

## 11. Rekomendasi implementasi

Pisahkan implementasi ke modul berikut:

```text
src/
  modules/anthropometry/
    age/
      calculate-age.ts
    measurement/
      correct-length-height.ts
      validate-measurement.ts
    references/
      who-2006/
        metadata.json
        waz/
        haz/
        whz/
        baz/
    zscore/
      lms.ts
      who-extreme-adjustment.ts
    classification/
      perm  enkes-2-2020.ts
    validation/
      fixtures/
      compare-reference-results.ts
```

Nama folder/file final boleh disederhanakan. Prinsip pentingnya adalah pemisahan data referensi, algoritma Z-Score, klasifikasi, dan validasi.

**Jangan mengisi tabel LMS dengan angka hasil salin manual yang belum diverifikasi.** Impor tabel dari sumber resmi, simpan sumber dan checksum, lalu buat automated tests.

## 12. Hal yang masih harus dipastikan sebelum production

1. Tabel LMS yang tepat untuk WAZ, HAZ, WHZ, dan BAZ serta format distribusi resmi yang akan digunakan.
2. Algoritma WHO untuk Z-Score di luar ±3 SD dan aturan flag biologically implausible values.
3. Rekonsiliasi batas umur bulan penuh Permenkes dengan pemetaan umur/hari pada implementasi WHO Anthro.
4. Perlakuan pengukuran berdiri pada bayi di bawah 9 bulan.
5. Pemetaan kolom dan satuan pada formula interpolasi ASP.
6. Pemetaan label lama ASP ke kategori resmi tanpa kehilangan kompatibilitas laporan.
7. Validasi oleh tenaga gizi/tenaga kesehatan yang berwenang sebelum aplikasi dipakai untuk pemantauan nyata.

## 13. Keputusan desain sementara

| Area | Keputusan |
|---|---|
| Standar klasifikasi Indonesia | Permenkes No. 2 Tahun 2020 |
| Referensi pertumbuhan 0–60 bulan | WHO Child Growth Standards 2006 |
| Indeks | WAZ, HAZ, WHZ, BAZ |
| Z-Score | Algoritma WHO LMS lengkap, termasuk penanganan ekstrem |
| Koreksi posisi | +0,7 cm / -0,7 cm sesuai umur dan posisi |
| Excel ASP | Referensi kompatibilitas dan reverse engineering |
| Kategori output | Istilah dan ambang Permenkes |
| Data pribadi | Proses lokal di browser untuk MVP; minimalkan penyimpanan dan ekspor |
| Status kesiapan | Draft; menunggu tabel referensi, golden test cases, dan validasi tenaga kesehatan |

---
**Disclaimer:** OpenASP adalah alat bantu pencatatan dan skrining. Hasil aplikasi tidak menggantikan penilaian tenaga kesehatan, konfirmasi pengukuran, maupun tata laksana sesuai pedoman klinis.
