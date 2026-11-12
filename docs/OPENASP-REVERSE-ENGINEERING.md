# OpenASP --- Reverse Engineering Notes

**Status:** Draft awal berdasarkan ekspor TXT workbook ASP KARANGTAWAR
2025\
**Tujuan:** Menjadi dasar analisis dan implementasi OpenASP (Next.js +
TypeScript).\
**Penting:** Dokumen ini memisahkan hal yang terlihat pada sumber dengan
hal yang masih berupa hipotesis atau standar eksternal. Jangan
menganggap seluruh rumus di bawah sudah sama dengan rumus Excel asli.

------------------------------------------------------------------------

## 1. Ringkasan

Ekspor TXT menunjukkan bahwa workbook ASP mengelola data induk balita,
pengukuran antropometri berkala, riwayat bulanan, penentuan status gizi,
serta rekap per jenis kelamin dan Posyandu.

Workbook tampak menggunakan referensi **WHO-2005** dan memiliki
kolom/label terkait parameter **L, M, S**, `zsc`, serta `ZSC_TBU` dan
`ZSC_BBU`. Namun, ekspor TXT tidak menyimpan formula Excel, sehingga
rumus sel, referensi antarsheet, named ranges, macro, dan aturan
validasi asli belum dapat dipastikan.

## 2. Struktur data yang teridentifikasi

### 2.1 Data induk balita

Kolom yang terlihat pada ekspor mencakup: - Nomor/identitas internal
balita - Nama balita - Jenis kelamin (kode yang terlihat: `1` dan `2`) -
Tanggal lahir - Data orang tua/wali - Nama Posyandu - Informasi
wilayah/RT/RW pada sebagian sheet

**Catatan privasi:** Data asli mengandung informasi pribadi anak dan
keluarga. Pengembangan dan pengujian OpenASP sebaiknya memakai data
sintetis atau data yang sudah dianonimkan. Jangan menyalin NIK, nomor
telepon, alamat, atau nama asli ke issue, log, demo, maupun repository
publik.

### 2.2 Pengukuran

Kolom yang terlihat: - Tanggal ukur/timbang - Berat badan (kg) -
Tinggi/panjang badan (cm) - Metode/posisi ukur, misalnya `Berdiri` dan
`Terlentang` - Riwayat pengukuran per bulan

### 2.3 Indikator dan rekap

Label yang ditemukan antara lain: - TB/U - BB/U - BB/TB - IMT - Status
gizi - Pendek dan sangat pendek - BB kurang - BGM - Kurus dan sangat
kurus - Gemuk - Vitamin A - ASI eksklusif - Rekap menurut laki-laki,
perempuan, total, dan Posyandu

Workbook juga menampilkan periode Januari--Desember dan beberapa kolom
rekap persentase/jumlah.

## 3. Apa yang sudah diketahui tentang perhitungan?

### 3.1 Bukti langsung dari ekspor

Pada salah satu ekspor terdapat header parameter: - `TU`, `TL`, `hari`,
`bln`, `bln+1` - `TB`, `L`, `M`, `S`, `zsc`, `ZSC_TBU` - `BB`, `L`, `M`,
`S`, `zsc`, `ZSC_BBU`

Ini menunjukkan adanya proses penentuan umur/kelompok umur, pengambilan
parameter LMS, dan penghitungan z-score. Tetapi ekspor TXT tidak
menunjukkan formula sel yang menghubungkan kolom-kolom tersebut.

### 3.2 Rumus LMS --- acuan teknis, belum terverifikasi sebagai rumus Excel asli

Untuk parameter L, M, dan S, rumus LMS yang umum digunakan adalah:

Jika `L != 0`:

`Z = ((X / M)^L - 1) / (L * S)`

Jika `L = 0`:

`Z = ln(X / M) / S`

Keterangan: - `X`: hasil pengukuran aktual (misalnya berat atau
panjang/tinggi) - `L`, `M`, `S`: parameter referensi sesuai indikator,
jenis kelamin, dan umur - `Z`: nilai z-score

**Status:** Ini merupakan acuan matematis LMS, bukan bukti bahwa formula
workbook ASP persis seperti ini. Implementasi harus diuji terhadap hasil
workbook asli atau kalkulator resmi yang relevan.

### 3.3 Umur

Ekspor memperlihatkan kolom tanggal lahir, tanggal ukur, umur, serta
komponen `hari`, `bln`, dan `bln+1`.

**Belum diketahui:** - Apakah umur dihitung sebagai selisih tanggal
secara presisi, jumlah bulan penuh, atau pembulatan tertentu. -
Bagaimana workbook menangani tanggal ukur sebelum tanggal lahir, tanggal
akhir bulan, dan usia yang melewati batas tabel. - Apakah lookup LMS
menggunakan umur dalam hari, umur bulan, atau interpolasi antarbulan.

Jangan menggunakan pembulatan umur sederhana sebelum perilaku workbook
terkonfirmasi.

### 3.4 Koreksi posisi pengukuran

Ekspor memuat nilai posisi seperti `Berdiri` dan `Terlentang`.

**Belum diketahui dari ekspor:** - Apakah dan kapan koreksi
panjang/tinggi sebesar 0,7 cm diterapkan. - Apakah koreksi bergantung
pada usia, posisi ukur, atau keduanya. - Apakah nilai mentah atau nilai
terkoreksi yang dipakai untuk lookup LMS dan pelaporan.

Aturan koreksi harus diverifikasi terhadap petunjuk teknis yang menjadi
acuan workbook sebelum diterapkan.

## 4. Klasifikasi status gizi

Label kategori terlihat pada ekspor, tetapi batas klasifikasi dan
formula IF/lookup asli belum dapat dipastikan hanya dari TXT.

Untuk implementasi, klasifikasi harus dipetakan secara eksplisit per
indeks antropometri. Jangan menyamakan kategori TB/U, BB/U, BB/PB atau
BB/TB, dan IMT/U karena masing-masing mengukur aspek yang berbeda.

Contoh struktur aturan yang perlu dikonfirmasi: - TB/U atau PB/U: sangat
pendek, pendek, normal, tinggi - BB/U: berat badan sangat kurang, berat
badan kurang, normal, risiko berat badan lebih (sesuai standar yang
dipakai) - BB/PB atau BB/TB: sangat kurus, kurus, normal, gemuk - IMT/U:
kategori berdasarkan standar IMT menurut umur

**Peringatan:** Batas kategori final harus mengikuti standar resmi dan
versi pedoman yang memang digunakan oleh pemilik program. Jangan
menetapkan kategori berdasarkan label semata.

## 5. Rekap SKDN dan indikator program

Ekspor menunjukkan adanya rekap jumlah dan persentase menurut jenis
kelamin/Posyandu serta indikator seperti Vitamin A dan ASI-E. Akan
tetapi, definisi operasional dan pembilang/penyebut tiap indikator belum
terkonfirmasi.

Hal yang perlu ditelusuri dari workbook: - Definisi S, K, D, dan N yang
dipakai workbook. - Kriteria balita masuk sasaran pada bulan/periode
tertentu. - Apakah anak tanpa pengukuran tetap dihitung pada sasaran. -
Bagaimana data ganda, pindah Posyandu, atau balita yang tidak hadir
diperlakukan. - Rumus persentase dan aturan jika penyebut bernilai
nol. - Definisi BGM dan indikator calon balita kurus.

## 6. Tingkat kepastian saat ini

  -----------------------------------------------------------------------
  Area                    Status                  Catatan
  ----------------------- ----------------------- -----------------------
  Struktur data induk     Teridentifikasi         Kolom identitas dan
                          sebagian                Posyandu terlihat

  Input pengukuran        Teridentifikasi         Tanggal, BB, TB/PB,
                                                  posisi ukur

  Riwayat bulanan         Teridentifikasi         Periode
                                                  Januari--Desember
                                                  terlihat

  Referensi WHO-2005      Terindikasi langsung    Tercantum pada lembar
                                                  penentuan status gizi

  Parameter LMS           Terindikasi langsung    Header L, M, S terlihat

  Rumus z-score workbook  Belum terverifikasi     Formula Excel tidak ada
                                                  di TXT

  Perhitungan umur        Belum terverifikasi     Komponen umur terlihat,
                                                  aturan pastinya tidak

  Koreksi posisi          Belum terverifikasi     Posisi tercatat,
                                                  formula koreksi tidak
                                                  terlihat

  Batas klasifikasi       Belum terverifikasi     Label ada,
                                                  formula/batas tidak
                                                  terlihat

  SKDN dan persentase     Belum terverifikasi     Rekap terlihat,
                                                  definisi dan formula
                                                  belum

  Macro/VBA/referensi     Tidak dapat dipastikan  TXT tidak
  antarsheet                                      mempertahankan struktur
                                                  tersebut
  -----------------------------------------------------------------------

## 7. Rencana verifikasi perhitungan

Agar hasil OpenASP bisa dibandingkan dengan ASP asli, diperlukan file
Excel yang masih mempertahankan formula, idealnya `.xlsx` atau `.xlsm`.

Prioritas sheet yang perlu diperiksa: 1. Sheet data/input Posyandu. 2.
Sheet penentuan status gizi atau tabel LMS. 3. Sheet output TB/U, BB/U,
BB/TB atau IMT/U. 4. Sheet SKDN dan rekap. 5. Sheet utama/menu yang
berisi parameter periode dan wilayah.

Untuk setiap contoh balita, siapkan data uji anonim: - Jenis kelamin -
Tanggal lahir - Tanggal ukur - BB - PB/TB - Posisi pengukuran - Hasil
z-score dan kategori yang ditampilkan ASP

Lalu bandingkan hasil per langkah: 1. Umur pada tanggal ukur. 2. Nilai
PB/TB terkoreksi (jika ada). 3. Parameter L, M, S yang dipilih. 4.
Z-score masing-masing indeks. 5. Kategori status gizi. 6. Angka rekap
yang dihasilkan.

Gunakan beberapa kasus batas (misalnya dekat ambang -3 SD, -2 SD, +1 SD,
+2 SD, dan +3 SD) serta kasus usia/posisi pengukuran yang berbeda.

## 8. Rekomendasi arsitektur awal OpenASP

Untuk MVP yang mengutamakan privasi: - Next.js + TypeScript untuk
aplikasi web responsif/PWA. - Proses data dan perhitungan di browser. -
Penyimpanan lokal perangkat hanya jika diperlukan dan dengan kontrol
hapus/ekspor yang jelas. - Hindari mengunggah data anak ke server pada
MVP. - Pisahkan modul `age-calculation`, `measurement-correction`,
`lms-reference`, `z-score`, `classification`, dan `recap`. - Simpan
versi sumber standar antropometri dan metadata referensinya agar hasil
dapat diaudit. - Buat pengujian otomatis untuk seluruh contoh pembanding
terhadap ASP asli.

## 9. Kesimpulan

**Belum, perhitungan lengkap ASP belum diketahui dan belum boleh
dianggap berhasil direplikasi.** Yang sudah diketahui adalah bentuk
data, jenis indikator, adanya referensi WHO-2005, dan petunjuk
penggunaan parameter LMS. Rumus LMS dapat dijadikan dasar teknis untuk
investigasi, tetapi perhitungan umur, lookup/interpolasi LMS, koreksi
posisi, klasifikasi, dan rekap SKDN masih harus diverifikasi dari
workbook yang mempertahankan formula atau dari contoh hasil yang dapat
diuji.

Dokumen ini adalah baseline reverse engineering, bukan spesifikasi
klinis final. OpenASP tidak boleh dipakai untuk keputusan layanan gizi
sebelum algoritma diverifikasi dengan sumber resmi dan tenaga gizi yang
kompeten.


---

## 10. Formula Excel asli yang diberikan pengguna

Bagian ini ditambahkan berdasarkan formula Excel yang diberikan langsung oleh pengguna. Formula berikut merupakan bukti yang lebih kuat daripada dugaan dari ekspor TXT. Formula dipertahankan sesuai referensi sel aslinya.

### 10.1 Formula Z-Score (interpolasi)

Formula pertama:

```excel
=IF(M16>20,DP16-((DI16-K16)*(DP16-DO16)),"")
```

Formula BB/U Z-Score:

```excel
=IF(L18>=1,DW18-((DI18-$K18)*(DW18-$DV18)),"")
```

Keduanya berbentuk **interpolasi linear** antara dua nilai referensi:
- Formula pertama menggunakan `DP16` dan `DO16`.
- Formula BB/U menggunakan `DW18` dan `DV18`.
- Faktor interpolasi menggunakan selisih `DI - K`.
- Formula mengembalikan string kosong (`""`) jika syarat IF tidak terpenuhi.

Secara aljabar, bentuk umumnya adalah:

`nilai_atas - ((faktor_selisih) * (nilai_atas - nilai_bawah))`

**Yang belum bisa dipastikan hanya dari formula ini:** arti bisnis setiap sel (`DI`, `K`, `DP`, `DO`, `DW`, `DV`), satuan/skalanya, serta apakah `DI-K` memang pecahan posisi di antara dua titik referensi. Perlu melihat header dan nilai pada kolom-kolom tersebut untuk memastikan konteks dan arah interpolasinya. Karena itu, formula ini jangan diganti dengan rumus LMS langsung.

### 10.2 Formula BB/TB Z-Score berbasis LMS

```excel
=IF(L18>0,IF(M18>0,(((L18/HA18)^GZ18)-1)/(GZ18*HB18),""),"")
```

Struktur yang terlihat:
- `L18`: nilai pengukuran yang menjadi pembilang (perlu konfirmasi header; kemungkinan BB).
- `M18`: nilai pengukuran kedua dan menjadi syarat harus lebih dari nol (perlu konfirmasi header; kemungkinan TB/PB).
- `GZ18`: parameter `L`.
- `HA18`: parameter `M`.
- `HB18`: parameter `S`.

Rumus menghitung bentuk LMS:

`Z = (((X / M)^L) - 1) / (L * S)`

dengan syarat `L18 > 0` dan `M18 > 0`. Jika syarat luar tidak terpenuhi hasilnya kosong; jika `L18 > 0` tetapi `M18 <= 0`, hasilnya juga kosong.

**Catatan penting:** formula Excel yang diberikan tidak memiliki cabang khusus saat parameter LMS `L = 0`. Jangan menambahkan cabang `ln(X/M)/S` ke replika ASP tanpa memastikan apakah ada formula lain atau memang parameter L pada tabel ini selalu bukan nol. Untuk implementasi standar LMS yang lebih umum, kasus L=0 perlu ditangani, tetapi itu akan menjadi keputusan implementasi yang harus dibedakan dari perilaku formula asli.

### 10.3 Klasifikasi TB/U

```excel
=IF(M18>0,IF(N18<-3,"S.Pendek",IF(N18<-2,"Pendek",IF(N18<=2,"Normal","Tinggi")))," ")
```

Aturan persis berdasarkan formula:
| Kondisi | Hasil |
|---|---|
| `M18 <= 0` | `" "` (satu spasi) |
| `N18 < -3` | `S.Pendek` |
| `-3 <= N18 < -2` | `Pendek` |
| `-2 <= N18 <= 2` | `Normal` |
| `N18 > 2` | `Tinggi` |

### 10.4 Klasifikasi BB/U

```excel
=IF(L18>0,IF(O18<-3,"BB S.Krg",IF(O18<-2,"BB Krg",IF(O18<=2,"BB Normal","BB Lbh")))," ")
```

Aturan persis berdasarkan formula:
| Kondisi | Hasil |
|---|---|
| `L18 <= 0` | `" "` (satu spasi) |
| `O18 < -3` | `BB S.Krg` |
| `-3 <= O18 < -2` | `BB Krg` |
| `-2 <= O18 <= 2` | `BB Normal` |
| `O18 > 2` | `BB Lbh` |

### 10.5 Klasifikasi BB/TB

```excel
=IF(L18>0,IF(M18>0,IF(P18<-3,"S.Kurus",IF(P18<-2,"Kurus",IF(P18<=2,"Normal","Gemuk")))," "),"")
```

Aturan persis berdasarkan formula:
| Kondisi | Hasil |
|---|---|
| `L18 <= 0` | `""` (kosong) |
| `L18 > 0` dan `M18 <= 0` | `" "` (satu spasi) |
| `P18 < -3` | `S.Kurus` |
| `-3 <= P18 < -2` | `Kurus` |
| `-2 <= P18 <= 2` | `Normal` |
| `P18 > 2` | `Gemuk` |

### 10.6 Perhitungan IMT

```excel
=IF(M18>0,IF(L18>0,L18/(M18*M18*0.0001),""),"")
```

Formula tersebut menghitung:

`IMT = BB (kg) / (TB dalam cm × TB dalam cm × 0.0001)`

Faktor `0.0001` mengonversi kuadrat sentimeter menjadi kuadrat meter. Formula hanya menghasilkan nilai jika `M18 > 0` dan `L18 > 0`; selain itu hasilnya kosong.

### 10.7 Pemetaan kolom yang sudah terlihat

Berdasarkan formula yang diberikan:
| Sel | Peran yang dapat dipastikan dari formula |
|---|---|
| `N18` | Nilai Z-Score yang dipakai klasifikasi TB/U |
| `O18` | Nilai Z-Score yang dipakai klasifikasi BB/U |
| `P18` | Nilai Z-Score yang dipakai klasifikasi BB/TB |
| `GZ18` | Parameter LMS L pada formula BB/TB |
| `HA18` | Parameter LMS M pada formula BB/TB |
| `HB18` | Parameter LMS S pada formula BB/TB |
| `L18`, `M18` | Nilai input/pengukuran yang menjadi syarat dan operand formula; header persisnya perlu dicocokkan dengan sheet |

## 11. Dampak terhadap status reverse engineering

Dengan formula tambahan ini, beberapa bagian yang sebelumnya belum diketahui kini **sudah diketahui pada level formula sel**:
- Formula interpolasi untuk dua kolom Z-Score yang diberikan.
- Formula LMS untuk BB/TB (termasuk syarat IF yang digunakan workbook).
- Ambang klasifikasi TB/U, BB/U, dan BB/TB.
- Formula IMT.

Namun, hal-hal berikut masih perlu diverifikasi:
1. Header dan makna pasti setiap referensi sel pada formula interpolasi (`DI`, `K`, `DP`, `DO`, `DW`, `DV`).
2. Apakah formula interpolasi tersebut dipakai untuk TB/U, BB/U, atau tahapan tabel referensi tertentu—perlu dicocokkan dengan nama kolom pada sheet.
3. Formula pembentukan umur dan cara memilih titik referensi.
4. Sumber tabel LMS, rentang usia, jenis kelamin, serta apakah ada interpolasi pada parameter LMS.
5. Apakah ada formula lain untuk kasus `L=0`, atau tabel BB/TB memang tidak memerlukan cabang tersebut.
6. Formula output rekap SKDN, BGM, Vitamin A, ASI-E, dan kategori lain.

**Kesimpulan revisi:** kita sekarang sudah memiliki sebagian rumus inti ASP, bukan hanya dugaan. Tetapi belum cukup untuk menyatakan seluruh mesin perhitungan ASP berhasil direplikasi. Implementasi sebaiknya menyalin perilaku formula asli terlebih dahulu, lalu memisahkan setiap penyempurnaan berbasis standar resmi sebagai aturan yang terdokumentasi dan diuji.

## 12. Formula NTOB

Formula yang diberikan untuk NTOB:

```excel
=IF('P1'!$CW9<'P1'!$DJ9+'P1'!$DW9+'P1'!$EW9+'P1'!$FJ9,1,0)
```

### 12.1 Perilaku formula yang dapat dipastikan

Formula mengambil nilai dari sheet `P1` pada baris 9, lalu membandingkan:

`CW9` dengan `DJ9 + DW9 + EW9 + FJ9`

Hasilnya berupa flag numerik:
- `1` jika `P1!CW9 < P1!DJ9 + P1!DW9 + P1!EW9 + P1!FJ9`.
- `0` jika kondisi tersebut tidak terpenuhi (termasuk jika nilainya sama).

Formula ini tidak menghitung selisih atau jumlah secara langsung; formula hanya menghasilkan indikator biner berdasarkan perbandingan tersebut.

### 12.2 Hal yang masih perlu dipastikan

Makna bisnis NTOB belum dapat ditentukan hanya dari formula. Perlu nama header/label kolom untuk `CW`, `DJ`, `DW`, `EW`, dan `FJ` pada sheet `P1`, serta konteks baris 9 (misalnya apakah baris tersebut mewakili bulan, kelompok umur, jenis kelamin, atau total). Jangan menetapkan arti variabel-variabel tersebut sebelum header-nya diperiksa.

---

## 13. Sumber tambahan: BU BIDAN_FORMAT UKUR MASTER KARANGTAWAR SEPTEMBER.xls

File tambahan ini merupakan workbook terpisah dari `ASP KARANGTAWAR 2025`. File
ini berhasil dibaca setelah dikonversi ke `.xlsx` untuk inspeksi struktur. Workbook
memiliki 14 sheet:

- `CONTOH`
- `Tambah Balita`
- `JANUARI`, `FEBRUARI`, `MARET`, `APRIL`, `MEI`, `JUNI`, `JULI`,
  `AGUSTUS`, `SEPTEMBER`, `OKTOBER`, `NOVEMBER`, `DESEMBER`

### 13.1 Sheet bulanan

Sheet bulanan berisi format input pengukuran. Header yang teridentifikasi pada
sebagian besar sheet meliputi:

| Field | Makna berdasarkan nama header |
|---|---|
| `No` | Nomor urut |
| `NIK` | Nomor identitas |
| `nama_anak` | Nama anak |
| `TANGGAL LAHIR` | Tanggal lahir (tersedia pada beberapa sheet) |
| `TANGGALUKUR` | Tanggal pengukuran |
| `BERAT` | Berat badan |
| `TINGGI` | Tinggi/panjang badan |
| `LILA` | Lingkar lengan atas |
| `lingkar_kepala` | Lingkar kepala |
| `Pitting_edema` | Penanda pemeriksaan edema |
| `CARAUKUR` | Cara/posisi pengukuran, misalnya `BERDIRI` atau `TERLENTANG` |
| `vita` | Isian Vitamin A |
| `asi_bulan_0` sampai `asi_bulan_6` | Isian ASI menurut bulan 0–6 |
| `kelas_ibu_balita` | Isian kelas ibu balita |
| `mbg` | Isian MBG |
| `KETERANGAN` | Catatan/status administratif |

**Variasi struktur:** header antarbulan tidak sepenuhnya seragam. Contohnya,
beberapa sheet awal tidak memiliki `TANGGAL LAHIR` pada posisi yang sama,
sementara sheet mulai Juni menampilkan kolom tersebut secara eksplisit. Jumlah
kolom yang terdeteksi juga bervariasi (21–23 kolom). Karena itu, proses impor
OpenASP harus membaca header dan memetakan nama field, bukan mengandalkan nomor
kolom tetap.

### 13.2 Sheet `Tambah Balita`

Sheet ini berisi data pendaftaran/penambahan balita. Header yang terlihat:

- `anak_ke`, `tgl_lahir`, `jenis_kelamin`
- `nomor_KK`, `NIK`, `nama_anak`
- `usia_hamil`, `berat_lahir`, `panjang_lahir`, `lingkar_kepala_lahir`
- `kia`, `kia_bayi_kecil`, `imd`
- `nama_ortu`, `nik_ortu`, `hp_ortu`, `alamat`, `rt`, `rw`
- `hapus`, `pindah`

Field-field tersebut merupakan struktur input yang terlihat pada workbook;
makna operasional dan validasi masing-masing field belum seluruhnya diketahui.

### 13.3 Hasil inspeksi formula

Pada 14 sheet yang diperiksa, tidak ditemukan formula Excel. Dengan demikian,
workbook ini diperlakukan sebagai **format input/master pengukuran**, bukan
sebagai sumber rumus perhitungan status antropometri. Ketiadaan formula pada
file ini tidak membuktikan bahwa tidak ada proses perhitungan di workbook ASP
lain atau sistem lain.

### 13.4 Implikasi untuk OpenASP

OpenASP sebaiknya menyediakan impor format bidan dengan strategi berikut:

1. Deteksi sheet bulan dan baca header masing-masing sheet.
2. Normalisasi variasi penamaan header dan format tanggal.
3. Normalisasi angka desimal yang dapat menggunakan koma atau titik.
4. Normalisasi nilai kategori seperti `YA`/`ya`, `TIDAK`, `BERDIRI`, dan
   `TERLENTANG` tanpa menghilangkan nilai sumber.
5. Cocokkan balita lintas bulan menggunakan identifier internal yang aman;
   NIK tidak boleh menjadi identifier yang terekspos pada UI publik atau log.
6. Validasi data kosong, duplikat, tanggal, satuan, dan nilai pengukuran sebelum
   data digabungkan ke riwayat balita.
7. Sediakan laporan baris yang gagal diimpor agar pengguna dapat memperbaiki
   sumbernya.

Jangan mengasumsikan bahwa seluruh sheet bulanan memiliki urutan kolom atau
kelengkapan field yang sama.

---

## 14. Pembedaan sumber data dan ruang lingkup

Dua workbook yang sudah dibahas memiliki fungsi yang berbeda dan harus tetap
dibedakan dalam analisis:

| Sumber | Peran yang didukung bukti | Bukan bukti untuk |
|---|---|---|
| `ASP KARANGTAWAR 2025` dan ekspor TXT terkait | Alur ASP, data induk/riwayat, rekap, label status, serta sebagian formula yang diberikan pengguna | Seluruh rumus dan seluruh aturan sudah terverifikasi |
| `BU BIDAN_FORMAT UKUR MASTER KARANGTAWAR SEPTEMBER.xls` | Format data input/master pengukuran bulanan dan pendaftaran balita | Formula Z-score, klasifikasi antropometri, atau SKDN |

Formula NTOB yang diberikan pengguna tetap dicatat pada Bagian 12. Namun,
file format bidan yang baru diperiksa tidak memiliki sheet `P1` maupun kolom
`CW`, `DJ`, `DW`, `EW`, dan `FJ` yang dirujuk formula tersebut. Oleh karena itu,
file ini tidak dapat dipakai untuk memetakan referensi sel NTOB. Makna bisnis
NTOB dan pemetaan kolomnya tetap **belum terverifikasi**.

---

## 15. Status akhir dokumen dan pekerjaan berikutnya

### Sudah didukung sumber

- Struktur umum data induk, pengukuran, dan riwayat bulanan dari ekspor ASP.
- Sebagian formula Z-score, klasifikasi, IMT, dan NTOB yang diberikan langsung
  oleh pengguna.
- Indikator dan label rekap yang terlihat pada ekspor ASP, termasuk kelompok
  SKDN dan indikator program.
- Struktur input bulanan dan pendaftaran balita dari workbook format bidan.
- Tidak ditemukannya formula Excel pada workbook format bidan yang diperiksa.

### Masih perlu diverifikasi

1. Formula dan pemetaan kolom lengkap untuk NTOB serta indikator SKDN lain.
2. Arti sel-sel dalam formula interpolasi dan konteks penggunaannya.
3. Perhitungan umur, pemilihan tabel referensi, dan interpolasi parameter.
4. Koreksi posisi pengukuran dan penanganan kasus batas.
5. Versi referensi antropometri dan kesesuaian hasilnya dengan pedoman resmi.
6. Rumus rekap, persentase, BGM, Vitamin A, ASI-E, serta indikator lainnya.
7. Rekonsiliasi data master bidan dengan data induk dan riwayat pada ASP.

### Urutan implementasi yang disarankan

1. Bangun parser/importer untuk format bidan dan data ASP.
2. Bentuk model data internal yang terpisah dari format Excel sumber.
3. Bangun modul perhitungan yang meniru formula ASP yang sudah terbukti, dengan
   penanda versi dan pengujian regresi.
4. Lengkapi aturan yang belum diketahui melalui formula/header/contoh hasil
   workbook ASP, bukan dengan menebak.
5. Bangun rekap dan dashboard setelah definisi indikator serta pembilang dan
   penyebutnya tervalidasi.
6. Lakukan validasi bersama tenaga gizi yang kompeten sebelum penggunaan
   operasional.

**Pernyataan batas:** dokumen ini adalah catatan reverse engineering dan dasar
spesifikasi teknis awal. Dokumen ini bukan validasi klinis, bukan pengganti
pedoman resmi, dan bukan bukti bahwa OpenASP sudah mereplikasi ASP sepenuhnya.

**Privasi:** workbook sumber berisi data pribadi anak dan keluarga, termasuk
NIK, nomor KK, identitas orang tua, nomor telepon, dan alamat. Jangan masukkan
baris data nyata ke dokumentasi, source code, issue tracker, tangkapan layar
publik, log, atau data demo. Gunakan data sintetis atau data yang telah
dianonimkan.
