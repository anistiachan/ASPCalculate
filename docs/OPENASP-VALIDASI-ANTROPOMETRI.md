# OpenASP — Dokumen Validasi Mesin Antropometri

**Versi:** 0.1 · **Tanggal:** 12 November 2026
**Status:** Implementasi teknis selesai. **Belum divalidasi oleh tenaga kesehatan.**
**Algoritma:** `openasp-anthro-0.1.0` · **Referensi:** WHO Child Growth Standards 2006 (tabel diunduh 2026-11-12)

> Dokumen ini ditulis untuk **tenaga gizi dan tenaga kesehatan yang meninjau** mesin perhitungan, serta pengembang yang memeliharanya. Bagian 1–4 menjelaskan apa yang sudah dibuktikan secara teknis. **Bagian 5 adalah daftar keputusan yang perlu Anda tinjau.** Selama tinjauan belum ada, aplikasi menampilkan peringatan di setiap hasil dan tidak boleh dipakai untuk keputusan layanan.

## 1. Apa yang dihitung

Untuk anak 0–59 bulan, dari tanggal lahir, jenis kelamin, tanggal ukur, berat, dan panjang/tinggi badan:

| Indikator | Singkatan | Metode z-score | Klasifikasi |
| --- | --- | --- | --- |
| Berat badan menurut umur | BB/U | LMS, **dengan penyesuaian di luar ±3 SD** | Permenkes 2/2020 |
| Panjang/tinggi badan menurut umur | PB/U, TB/U | LMS biasa | Permenkes 2/2020 |
| Berat badan menurut panjang/tinggi | BB/PB, BB/TB | LMS dengan interpolasi, **dengan penyesuaian** | Permenkes 2/2020 |
| Indeks massa tubuh menurut umur | IMT/U | LMS, **dengan penyesuaian** | Permenkes 2/2020 |

Z-score dibulatkan 2 desimal. Klasifikasi memakai nilai yang sudah dibulatkan itu.

## 2. Sumber data

Tabel diunduh dari berkas **"expanded tables"** yang dipublikasikan WHO di `cdn.who.int` (10 berkas: 5 indikator × laki-laki/perempuan). URL, ukuran, dan hash SHA-256 setiap berkas tercatat di `src/domain/anthropometry/references/who-2006/metadata.json`.

- **Tidak ada angka yang diketik atau disalin dari sumber tidak resmi.** Data dihasilkan oleh `scripts/import-who-tables.mjs`.
- Skrip **menolak berkas yang hash-nya berbeda** dari yang disematkan. Jika WHO mengganti berkas, impor berhenti sampai perubahannya ditinjau.
- Perintah membuat ulang: `npm run who:import`.
- Rentang: umur 0–1856 hari (BB/U, TB/U, IMT/U); panjang 45–110 cm (BB/PB); tinggi 65–120 cm (BB/TB).

**Catatan sumber kode.** Perilaku algoritma dipastikan dengan membaca paket WHO Anthro (`anthro` v1.1.0, lisensi GPL-3). Kode itu **tidak disalin**; implementasi OpenASP ditulis sendiri dari rumus yang terdokumentasi. Angka dari suite tes paket tersebut dikutip sebagai vektor uji (bagian 4).

## 3. Algoritma

Urutan perhitungan (`src/domain/anthropometry/compute.ts`):

1. **Umur** = jumlah hari kalender antara tanggal lahir dan tanggal ukur. Umur dalam bulan = hari ÷ 30,4375.
2. **Cakupan:** z-score hanya dihitung bila umur < 60 bulan (≤ 1826 hari). Di luar itu, hasil kosong dengan penjelasan.
3. **Standardisasi panjang/tinggi** (bagian 5, butir 1, 4, 5):
   - diukur berdiri pada umur < 731 hari → tambah 0,7 cm;
   - diukur telentang pada umur ≥ 731 hari → kurangi 0,7 cm;
   - berdiri pada bayi < 9 bulan → tidak dikoreksi, diberi catatan;
   - posisi tidak diketahui → tidak dikoreksi, diberi catatan.
   Nilai mentah selalu disimpan; yang dikoreksi hanya dipakai untuk perhitungan.
4. **IMT** = berat ÷ (tinggi terkoreksi dalam meter)².
5. **Z-score** dengan rumus LMS: `Z = ((y/M)^L − 1) / (L·S)`.
   Untuk BB/U, IMT/U, BB/PB-TB, bila |Z| > 3 dipakai penyesuaian WHO:
   `Z = 3 + (y − SD3) / (SD3 − SD2)` untuk Z > 3 dan `Z = −3 + (y − SD−3) / (SD−2 − SD−3)` untuk Z < −3.
   TB/U memakai rumus biasa (hasilnya identik karena L = 1 di seluruh tabel TB/U).
6. **BB/PB atau BB/TB:** tabel panjang bila umur < 731 hari, tabel tinggi bila ≥ 731 hari. Bila tinggi jatuh di antara dua baris tabel (0,1 cm), L, M, dan S diinterpolasi linear.
7. **Catatan (flag)** untuk hal yang perlu diperiksa ulang. Nilai tidak dihapus.
8. **Klasifikasi** Permenkes 2/2020 (batas "sampai dengan" inklusif, "lebih dari" eksklusif).

## 4. Bukti verifikasi teknis

### 4.1 Rumus dan data cocok dengan angka yang diterbitkan WHO sendiri

Tabel WHO memuat kolom SD−4 … SD+4 yang dihitung WHO. Skrip impor menghitung ulang semuanya dari L, M, S dan membandingkannya, untuk **setiap baris dan setiap tingkat SD** pada 10 tabel.

- **Selisih terbesar: 0,0005** — persis batas pembulatan 3 desimal WHO. Tidak ada yang melebihi.
- Kolom SD±4 indikator berat cocok dengan metode penyesuaian (bukan rumus biasa). Ini mengonfirmasi secara independen bahwa penyesuaian di luar ±3 SD diterapkan WHO pada BB/U, IMT/U, dan BB/PB-TB.
- Pemeriksaan serupa ada di tes otomatis `who-2006.test.ts` untuk 12 baris yang dikutip dari tabel WHO.

### 4.2 Vektor uji dari suite tes WHO Anthro

| Kasus | Hasil yang diharapkan WHO | Hasil OpenASP |
| --- | --- | --- |
| Perempuan, 1522 hari, 17 kg → BB/U | 0,24 | 0,24 |
| Laki-laki, 987 hari, 72,86 cm telentang → TB/U | −6,09 (ditandai) | −6,09 (ditandai) |
| Bayi 8 bulan berdiri, 60 cm → TB/U | −4,81, ditandai, tidak dikoreksi | −4,81, ditandai, tidak dikoreksi |
| Bayi 9 bulan berdiri, 60 cm → TB/U | −5,02, dikoreksi menjadi 60,7 | −5,02, dikoreksi menjadi 60,7 |
| Perempuan 24 bulan, 77,5 cm tanpa posisi → TB/U | −2,55 | −2,55 |
| Koreksi: 730 hari berdiri +0,7; 800 hari telentang −0,7 | sesuai | sesuai |
| Laki-laki 44 hari, 50 cm → TB/U | ((50/56,4833) − 1)/0,03492 | sama |
| Umur 59,9 bulan dihitung, 60 bulan tidak | sesuai | sesuai (1826 hari ya, 1827 hari tidak) |

Hasil kasus kedua dan keempat juga diperiksa di browser sungguhan (tes E2E), bukan hanya di unit test.

### 4.3 Ketahanan tes

Mesin sengaja dirusak pada lima titik (batas 731 hari, penyesuaian ±3 SD, batas klasifikasi, pemakaian penyesuaian pada TB/U, hari per bulan). Empat terdeteksi tes (2–15 tes gagal per kerusakan). Yang kelima adalah **mutasi ekuivalen**: tidak mengubah hasil karena L = 1 pada seluruh tabel TB/U (dicatat sebagai tes).

### 4.4 Yang TIDAK diverifikasi

- **WHO Anthro asli tidak dijalankan** (R tidak tersedia di lingkungan pengembangan). Pembandingnya adalah vektor dari suite tesnya dan angka SD yang diterbitkan WHO, bukan keluaran program itu pada data survei sungguhan. Disarankan menjalankan WHO Anthro (aplikasi atau paket R) pada sampel anak dan membandingkannya dengan OpenASP sebelum dipakai.
- **Perbandingan dengan lampiran Permenkes** (tabel per bulan) belum dilakukan (bagian 5, butir 2).
- **Tinjauan klinis** belum ada.

## 5. Keputusan yang perlu ditinjau tenaga kesehatan

Setiap butir menyebut apa yang dilakukan OpenASP sekarang dan pertanyaan untuk peninjau. Mohon tanggapi "setuju" atau "ubah menjadi …" untuk tiap butir.

| # | Topik | Yang dilakukan sekarang | Pertanyaan untuk peninjau |
| --- | --- | --- | --- |
| 1 | **Batas panjang → tinggi** | Mengikuti WHO Anthro: di bawah **731 hari** dipakai panjang (telentang), mulai 731 hari dipakai tinggi (berdiri). Permenkes menulis "0 sampai 24 bulan". | Apakah batas 731 hari dapat diterima, atau perlu 24 bulan penuh (≈ 730 hari)? Selisihnya hanya 1 hari, tetapi menentukan tabel dan koreksi. Data WHO sendiri turun ±0,7 cm tepat di hari 731. |
| 2 | **Umur untuk mencari tabel** | Umur dalam **hari** (cara WHO Anthro). Permenkes mendefinisikan umur dalam bulan penuh (2 bulan 29 hari = 2 bulan) dan lampirannya per bulan. | Apakah hasil berbasis hari dapat diterima? Z-score bisa sedikit berbeda dari pembacaan tabel Permenkes per bulan, terutama dekat ambang. |
| 3 | **Pembulatan z-score** | Dibulatkan **2 desimal**, lalu diklasifikasi. Contoh: −2,004 menjadi −2,00 → "normal". | Apakah klasifikasi pada nilai terbulatkan sudah sesuai praktik di lapangan? |
| 4 | **Bayi < 9 bulan diukur berdiri** | Mengikuti WHO: posisi dianggap tidak wajar, **tidak dikoreksi**, diberi catatan. | Apakah pesan dan perlakuan ini sesuai? Perlukah dicegah saat input? |
| 5 | **Posisi ukur tidak diketahui** | Tidak dikoreksi, diberi catatan bahwa hasil bisa meleset sekitar 0,7 cm. | Apakah posisi wajib diisi pada input? |
| 6 | **Edema pitting** | Kamus kode di workbook belum dikonfirmasi, jadi isian **tidak ditafsirkan**: kosong = tidak ada edema (default WHO); terisi = diberi catatan, perhitungan tetap jalan. Bila edema dipastikan ada, z-score berbasis berat tidak dihitung. | Apa arti kode pada kolom `Pitting_edema`? Bagaimana edema harus diperlakukan pada status gizi? |
| 7 | **Ambang nilai tidak wajar** | Mengikuti WHO: BB/U di luar [−6, +5], TB/U di luar ±6, BB/PB-TB dan IMT/U di luar ±5 diberi catatan "periksa kembali". Nilai tetap ditampilkan. | Apakah ambang ini sesuai? |
| 8 | **Rentang kewajaran input** (peringatan di formulir) | Angka **sementara buatan pengembang**: berat 1–30 kg, tinggi 35–130 cm, LILA 5–25 cm, lingkar kepala 25–60 cm. Hanya peringatan, tidak memblokir. | Apakah rentang ini masuk akal? Mohon beri angka yang disarankan. |
| 9 | **IMT/U** | Memakai kategori yang sama dengan BB/PB-TB (gizi buruk … obesitas). Permenkes mencatat bahwa diagnosis gizi buruk/kurang dalam tata laksana memakai BB/PB atau BB/TB. | Perlukah catatan ini tampil di layar? |
| 10 | **BB/U tinggi** | Di atas +1 SD disebut "risiko berat badan lebih", bukan "gemuk" atau "obesitas" (sesuai Permenkes). | Apakah pesannya cukup jelas bagi kader? |
| 11 | **Beda dengan workbook ASP** | Workbook memakai batas "normal" sampai +2 SD untuk TB/U, BB/U, dan BB/TB serta label "S.Pendek", "BB Lbh", "Gemuk". OpenASP memakai **batas dan istilah Permenkes** (BB/U normal sampai +1; TB/U normal sampai +3; BB/TB enam kategori). Label lama tidak dipakai. | Apakah laporan ke Puskesmas/Dinas perlu label lama untuk kompatibilitas? |
| 12 | **Cakupan umur** | Z-score hanya untuk umur 0–59 bulan. Anak ≥ 60 bulan menampilkan penjelasan, bukan angka. | Apakah ini sesuai kebutuhan Posyandu? |
| 13 | **Warna kategori** | Hijau = baik, kuning = waspada, merah = perlu perhatian. Selalu disertai teks kategori. | Apakah pengelompokan ini (mis. "Tinggi" = waspada) wajar? |

## 6. Cara menyatakan mesin "tervalidasi"

Penanda `ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL` di `src/domain/anthropometry/constants.ts` bernilai `false`; selama itu peringatan tampil di tiap hasil. Ubah menjadi `true` hanya bila semua berikut terpenuhi:

1. Semua 13 butir di bagian 5 sudah ditanggapi tertulis (setuju atau diubah), dan perubahannya sudah diterapkan serta diuji.
2. Hasil OpenASP dibandingkan dengan WHO Anthro asli pada sampel anak, dan selisihnya dicatat di dokumen ini beserta toleransi numerik yang disepakati.
3. Nama peninjau, jabatan, dan tanggal tinjauan dicatat di dokumen ini.
4. Naikkan `ALGORITHM_VERSION` bila ada perubahan perilaku.

Tes `constants.test.ts` sengaja mewajibkan nilai `false`; mengubahnya berarti mengubah tes itu dengan sadar, di commit yang sama dengan catatan tinjauan.

## 7. Memperbarui tabel referensi

1. Jalankan `npm run who:import`. Bila hash berubah, skrip berhenti dan menampilkan hash lama dan baru.
2. Periksa apa yang berubah di sumber WHO. Perbarui hash di skrip hanya setelah ditinjau.
3. Jalankan `npm test`: tes membandingkan baris-baris yang dikutip dari tabel WHO.
4. Catat perubahan di bagian ini.

## 8. Cakupan dan keterbatasan

- Hanya empat indikator dan hanya anak 0–59 bulan. LILA dan lingkar kepala disimpan tetapi belum dihitung z-score-nya.
- Satu pengukuran dinilai sendiri-sendiri. Belum ada pemantauan tren pertumbuhan (kenaikan/penurunan antar pengukuran), grafik kurva, atau flat growth.
- Hasil tidak menggantikan penilaian tenaga kesehatan, konfirmasi pengukuran, maupun tata laksana sesuai pedoman klinis.
