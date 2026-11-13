# Z-score dan status gizi otomatis di Excel Bu Bidan

Workbook `BU BIDAN_FORMAT UKUR MASTER ...` diberi kolom **z-score dan status gizi seperti sheet PSG**, berupa
**rumus Excel** yang terisi sendiri begitu tanggal ukur, BB, dan TB diisi. Dokumen ini tidak memuat data anak.
Berkas asli dan hasilnya memuat data pribadi (NIK, nama) dan tidak boleh di-commit (`docs/*.xls*` diabaikan git).

## Hasil

Berkas baru `... (Z-SCORE).xlsx` dibuat dari berkas asli; **berkas asli tidak diubah**. Pada setiap sheet bulan
(`JANUARI` sampai `DESEMBER`) ditambahkan sembilan kolom tepat setelah `TINGGI`:

| Kolom | Isi |
| --- | --- |
| `JK` | L atau P. Diambil dari `Tambah Balita` lewat NIK; boleh diketik langsung (menimpa rumus). |
| `UMUR (bln)` | Umur dalam bulan penuh. |
| `Z TB/U`, `Z BB/U`, `Z BB/TB` | Z-score, dua desimal. |
| `STATUS TB/U`, `STATUS BB/U`, `STATUS BB/TB` | Kategori Permenkes 2/2020 (Sangat pendek, Pendek, Normal, Tinggi; Berat badan sangat kurang sampai Risiko berat badan lebih; Gizi buruk sampai Obesitas). |
| `STUNTING?` | `YA` bila TB/U di bawah −2 SD (pendek atau sangat pendek), `TIDAK` bila tidak. Bila belum bisa dihitung, berisi apa yang kurang ("isi JK (L/P)", "isi tgl lahir (Tambah Balita)", "isi TB", "umur 60 bulan atau lebih", dan sebagainya). |

Status yang tidak normal berwarna merah; `STUNTING?` = YA berlatar merah muda; sel `JK` kosong yang barisnya
sudah berisi TB disorot kuning. Rumus disiapkan sampai baris 300 pada setiap sheet.

Tambahan lain di berkas: sheet `PETUNJUK_ZSCORE`, empat sheet referensi `WHO_LHFA`, `WHO_WFA`, `WHO_WFL`, `WHO_WFH`
(tabel WHO 2006 yang sama dengan aplikasi), kolom bantu tersembunyi berawalan `bantu_` di kanan setiap sheet, dan
kolom bantu `bantu_nik_teks` (tersembunyi) di `Tambah Balita`.

## Yang harus diisi agar z-score muncul

Rumus butuh **jenis kelamin** dan **tanggal lahir**. Keduanya tidak ada pada sheet bulan (tanggal lahir hanya ada
pada `MEI` sampai `SEPTEMBER`, jenis kelamin tidak ada sama sekali). Karena itu:

1. Isi sheet **`Tambah Balita`** untuk setiap anak: `NIK`, `tgl_lahir`, `jenis_kelamin`.
2. Sheet bulan mencari anak lewat NIK. Anak yang belum ada di sana bisa diberi `JK` dengan mengetik L atau P.
3. Pada sheet `MEI`–`SEPTEMBER`, tanggal lahir dibaca dari kolom `TANGGAL LAHIR` sheet itu sendiri.

Pada berkas BRANGS yang diperiksa, `Tambah Balita` hanya berisi satu baris contoh, jadi sampai sheet itu diisi
(atau `JK` diketik) kolom z-score kosong dan kolom `STUNTING?` menjelaskan penyebabnya.

## Aturan perhitungan

Meniru mesin antropometri OpenASP (`src/domain/anthropometry`), yang mengikuti WHO Anthro dan Permenkes 2/2020:

- Umur dalam **hari** (tanggal ukur − tanggal lahir); z-score hanya untuk umur di bawah 60 bulan (hari / 30,4375).
- Koreksi posisi dari `CARAUKUR`: berdiri di bawah 731 hari **+0,7 cm**; terlentang 731 hari ke atas **−0,7 cm**;
  berdiri pada bayi di bawah 9 bulan tidak dikoreksi; cara ukur kosong tidak dikoreksi.
- LMS: TB/U dan BB/U dari tabel per hari; BB/PB (di bawah 731 hari) dan BB/TB dari tabel per 0,1 cm dengan
  interpolasi linear antar baris.
- BB/U dan BB/TB memakai penyesuaian WHO di luar ±3 SD; TB/U memakai rumus LMS biasa.
- Z-score dibulatkan dua desimal dan kategori memakai nilai yang sudah dibulatkan.
- Hasil **belum divalidasi tenaga kesehatan** dan tidak boleh dipakai untuk keputusan layanan gizi.

## Kondisi data nyata yang ditangani rumus

Ditemukan pada berkas BRANGS dan ditangani (sebagian akan membuat rumus Excel biasa gagal):

- **BB dan TB tersimpan sebagai teks** dengan koma desimal (`"17,2"`); rumus membaca koma maupun titik, tidak
  bergantung pada bahasa Excel.
- **Tanggal ukur berbentuk teks dengan format berbeda antar sheet**: `2026-01-07`, `11-05-2026`, dan di sheet
  `JUNI` berupa teks JavaScript (`Thu Jun 11 2026 00:00:00 GMT+0700 (Indochina Time)`).
- **NIK pada sheet Februari–September berakhiran spasi tak terputus** (karakter 160), yang tidak dibuang oleh
  `TRIM`. Rumus membuangnya sebelum mencocokkan NIK, termasuk NIK di `Tambah Balita`.
- Kolom sheet asli berformat **Teks**; rumus ditulis ke sel berformat General supaya benar-benar dihitung.

## Verifikasi

Hasil rumus dibandingkan baris demi baris dengan mesin OpenASP memakai
`src/test/bu-bidan-zscore-compare.local.test.ts` (lokal; dilewati tanpa variabel lingkungan
`BU_BIDAN_ZSCORE_JSON`). Pada salinan uji (jenis kelamin diisi selang-seling hanya untuk uji, bukan data nyata)
**701 baris dibandingkan dengan selisih z-score maksimum 0,00** dan jenis kelamin, umur, status, serta STUNTING?
sama persis. Cabang yang jarang tercakup: stunting dan sangat pendek, z-score di luar ±3 SD (BB/U dan BB/TB),
tabel panjang dan tinggi, koreksi posisi naik dan turun, bayi diukur berdiri, batas 731 hari, umur 60 bulan ke
atas, serta ketiga bentuk tanggal ukur dan koma desimal.

## Membuat ulang

```powershell
powershell -ExecutionPolicy Bypass -File scripts\add-zscore-to-bu-bidan.ps1 `
  -Source "docs\BU BIDAN_FORMAT UKUR MASTER BRANGS SEPTEMBER.xls" `
  -Output "docs\BU BIDAN_FORMAT UKUR MASTER BRANGS SEPTEMBER (Z-SCORE).xlsx" -Overwrite
```

Butuh Windows dengan Excel terpasang dan Node.js (untuk membuat tabel WHO). Kolom dicari menurut nama header,
bukan nomor kolom, karena posisinya berbeda antar sheet.

## Berkas hasil bisa terproteksi

Pada komputer tempat skrip ini dibuat, Excel menyimpan berkas `.xlsx` yang **diubah lalu disimpan** sebagai berkas
terproteksi (bukan ZIP biasa; diduga label sensitivitas dari kebijakan kantor). Berkas itu terbuka normal di
Excel, tetapi **tidak terbaca pustaka lain, termasuk impor OpenASP**. Itu kontrol perlindungan data (berkas
memuat NIK anak) dan tidak dihindari oleh skrip. Untuk membaca nilainya di luar Excel, pakai
`scripts\dump-bu-bidan-values.ps1`.

## Dampak pada aplikasi

Adapter impor Bu Bidan mengabaikan kolom z-score, status, dan kolom `bantu_*`, sehingga workbook yang sudah
diberi kolom ini (dan terbaca, yaitu tidak terproteksi) diimpor tanpa peringatan kolom tidak dikenal. OpenASP
tetap menghitung ulang status gizi dengan mesinnya sendiri.

## Belum ditangani

- Aplikasi belum mengenali tanggal ukur berbentuk teks JavaScript seperti pada sheet `JUNI` berkas ini
  (`parseDate` mendukung ISO, `DD-MM-YYYY`, `DD/MM/YYYY`, dan tanggal Excel).
- Satu-satunya sumber jenis kelamin adalah `Tambah Balita` atau ketikan langsung di kolom `JK`.
