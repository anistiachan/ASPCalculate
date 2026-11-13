# OPENASP — Mapping dan Analisis SKDN

**Versi:** 0.1  
**Status:** Draft reverse engineering — definisi dan formula belum seluruhnya diverifikasi.  
**Basis:** Struktur dan label pada bagian `DATA SKDN PER BULAN PER POSYANDU` dari workbook yang sebelumnya diberikan dan diekstrak.

## 1. Tujuan dan batasan

Dokumen ini memetakan struktur rekap SKDN pada workbook sumber sebagai dasar perancangan modul SKDN OpenASP.

Bedakan:
1. **Temuan workbook:** label, pengelompokan, dan nilai yang terlihat.
2. **Interpretasi awal:** arti yang tampak dari label workbook.
3. **Hal belum terverifikasi:** definisi operasional, formula, sumber data, dan aturan yang belum dapat dipastikan.

Workbook menjadi referensi workflow dan kompatibilitas, bukan satu-satunya sumber kebenaran definisi. Konfirmasi kepada pemilik proses/Bidan tetap diperlukan.

## 2. Struktur yang ditemukan

- Rekap per bulan: Januari–Desember.
- Rekap per Posyandu: P1–P10.
- Rincian jenis kelamin: `L` (laki-laki), `P` (perempuan), dan `L+P` (total).
- Indikator yang terlihat: K, D2, D25, D, N, T, O, B, dan 2T.
- Pada bagian yang berhasil diekstrak, baris berlabel `S` belum ditemukan secara eksplisit.

**Batasan ekstraksi:** hasil ekstraksi teks dapat mempertahankan label dan sebagian nilai, tetapi tidak selalu mempertahankan formula Excel, named range, macro, relasi antarsheet, atau perilaku workbook secara utuh. Karena itu, mapping ini belum menjadi spesifikasi formula final.

## 3. Mapping indikator workbook

| Kode | Label/keterangan yang ditemukan atau dipetakan | Interpretasi awal | Status |
|---|---|---|---|
| K-L | Jumlah balita (0–59 bln) yang punya KMS (L) | Balita laki-laki yang memiliki KMS | Ditemukan |
| K-P | Jumlah balita (0–59 bln) yang punya KMS (P) | Balita perempuan yang memiliki KMS | Ditemukan |
| K / K-L+P | Jumlah balita (0–59 bln) yang punya KMS (L+P) | Total balita yang memiliki KMS | Ditemukan |
| D2 | Jumlah baduta (0–23 bln) yang ditimbang | Balita usia 0–23 bulan yang ditimbang | Ditemukan |
| D25 | Jumlah balita (24–59 bln) yang ditimbang | Balita usia 24–59 bulan yang ditimbang | Ditemukan |
| D | Jumlah balita (0–59 bln) yang ditimbang | Total balita usia 0–59 bulan yang ditimbang | Ditemukan |
| N | Jumlah balita yang naik berat badannya | Balita yang tercatat mengalami kenaikan berat badan | Ditemukan |
| T | Jumlah balita yang tidak naik berat badannya | Balita yang tercatat tidak mengalami kenaikan berat badan | Ditemukan |
| O | Jumlah balita yang bulan lalu tidak menimbang | Balita yang tidak melakukan penimbangan pada bulan sebelumnya | Ditemukan |
| B | Jumlah balita yang baru pertama kali ditimbang | Balita yang baru pertama kali ditimbang | Ditemukan |
| 2T | Jumlah balita yang 2 kali berturut-turut tidak naik berat badannya | Balita dengan dua kejadian berturut-turut tidak naik berat badan | Ditemukan |
| S | Tidak ditemukan sebagai baris eksplisit pada bagian yang berhasil diekstrak | Sumber/jumlah sasaran belum diketahui dari bagian ini | Belum ditemukan |

Interpretasi di atas belum membuktikan aturan operasional lengkap. Contohnya, definisi “naik”, periode pembanding, dan perlakuan terhadap anak yang tidak hadir perlu diperiksa dari formula dan dikonfirmasi.

## 4. Contoh snapshot P1 — Januari

Pada ekstraksi yang sebelumnya dianalisis, contoh nilai Posyandu P1 bulan Januari adalah:

| Indikator | L | P | L+P |
|---|---:|---:|---:|
| K (punya KMS) | 52 | 37 | 89 |
| D (ditimbang) | 37 | 30 | 67 |
| N (BB naik) | 0 | 0 | 0 |
| T (BB tidak naik) | 0 | 0 | 0 |
| O (bulan lalu tidak menimbang) | 37 | 30 | 67 |
| B (baru pertama ditimbang) | 0 | 0 | 0 |

Pembagian D yang terlihat:
- D2: 29
- D25: 38
- D: 67

Angka ini merupakan snapshot hasil ekstraksi yang telah dibahas, bukan fixture produksi. Cocokkan kembali dengan workbook asli sebelum digunakan sebagai test case.

## 5. Temuan dan pertanyaan yang belum terjawab

### 5.1 S belum ditemukan

Kemungkinan yang perlu diperiksa:
1. S dicatat pada sheet lain.
2. S berasal dari master data sasaran/wilayah.
3. Workbook tidak menampilkan S pada bagian rekap tersebut.
4. Label atau posisi S berbeda dan belum tertangkap dalam ekstraksi.

**Jangan mengasumsikan S = K.** Keduanya harus diperlakukan sebagai konsep terpisah sampai sumber dan definisinya ditemukan.

### 5.2 N dan T

Perlu diverifikasi:
- Apakah N/T ditentukan dengan membandingkan berat badan bulan berjalan dan bulan sebelumnya?
- Bagaimana anak yang baru pertama kali ditimbang dikategorikan?
- Bagaimana anak yang tidak hadir bulan sebelumnya diperlakukan?
- Bagaimana data pengukuran ganda dalam satu bulan ditangani?
- Apakah ada aturan pembulatan atau toleransi perubahan berat badan?

### 5.3 O, B, dan 2T

Perlu diverifikasi:
- Apa aturan tepat untuk O (tidak menimbang bulan lalu)?
- Apakah B berarti pertama kali ditimbang sepanjang riwayat atau pertama kali di Posyandu tersebut?
- Apakah 2T mensyaratkan dua bulan kalender berturut-turut?
- Bagaimana jika ada satu bulan tanpa pengukuran?

### 5.4 D2 dan D25

Workbook menunjukkan kelompok usia 0–23 bulan dan 24–59 bulan. Perlu dikonfirmasi:
- Usia dihitung pada tanggal pengukuran atau tanggal lain?
- Apakah menggunakan bulan penuh atau pembulatan tertentu?
- Bagaimana perlakuan anak tepat pada batas 24 bulan?
- Apakah pembagian usia ini hanya berlaku untuk D atau indikator lain juga?

### 5.5 Jenis kelamin dan total

Perlu dipastikan:
- Apakah semua indikator memiliki rincian L/P/L+P?
- Apakah total selalu penjumlahan L dan P?
- Bagaimana data dengan jenis kelamin kosong/tidak diketahui diperlakukan?

## 6. Definisi dan status sementara untuk OpenASP

| Indikator | Status definisi OpenASP | Tindakan |
|---|---|---|
| S | `PENDING` | Cari sumber pada sheet/master lain dan konfirmasi |
| K | `PARTIALLY_MAPPED` | Konfirmasi makna KMS dan aturan sasaran aktif |
| D | `PARTIALLY_MAPPED` | Konfirmasi aturan hadir/ditimbang dan data ganda |
| N | `PARTIALLY_MAPPED` | Verifikasi formula dan pembanding berat badan |
| T | `PARTIALLY_MAPPED` | Verifikasi formula dan kasus khusus |
| O | `PARTIALLY_MAPPED` | Verifikasi arti “bulan lalu tidak menimbang” |
| B | `PARTIALLY_MAPPED` | Verifikasi definisi pertama kali ditimbang |
| 2T | `PARTIALLY_MAPPED` | Verifikasi aturan dua periode berturut-turut |
| D2 | `PARTIALLY_MAPPED` | Konfirmasi kelompok usia 0–23 bulan |
| D25 | `PARTIALLY_MAPPED` | Konfirmasi kelompok usia 24–59 bulan |

`PARTIALLY_MAPPED` berarti label/struktur ditemukan, tetapi definisi operasional atau formula belum lengkap.

## 7. Rancangan model data awal

Model ini ilustratif dan belum mengunci seluruh aturan bisnis.

```ts
type Sex = "MALE" | "FEMALE" | "UNKNOWN";

interface SkdnMonthlySummary {
  id: string;
  posyanduId: string;
  period: string; // YYYY-MM

  // S belum ditemukan pada bagian workbook yang dianalisis.
  s?: number;

  k: number;
  d: number;
  n: number;

  // Indikator tambahan dari workbook.
  t?: number;
  o?: number;
  b?: number;
  twoT?: number;

  d2?: number;
  d25?: number;

  sourceWorkbook?: string;
  sourceSheet?: string;
  importedAt?: string;
}

interface SkdnSexBreakdown {
  summaryId: string;
  sex: Sex;
  s?: number;
  k?: number;
  d?: number;
  n?: number;
  t?: number;
  o?: number;
  b?: number;
  twoT?: number;
  d2?: number;
  d25?: number;
}
```

Catatan desain:
- Bedakan nilai nol dari nilai tidak tersedia. `0` berarti diketahui tidak ada; nilai kosong berarti tidak diketahui atau tidak disediakan.
- Jika data per anak tersedia, rekap idealnya dihitung dari data dasar.
- Jika import hanya menyediakan angka agregat, simpan sebagai imported summary dan catat asalnya.
- Hindari menyimpan total yang dapat dihitung ulang tanpa validasi konsistensi.

## 8. Alur perhitungan konseptual

Jika data per anak tersedia:

```text
Master Child
    +
Measurement History
    +
Posyandu Assignment
    +
Reporting Period
    ↓
Eligibility / Period Rules
    ↓
Per-child SKDN Classification
    ↓
Aggregation by Posyandu + Month + Sex
    ↓
Monthly SKDN Report
```

Klasifikasi per anak perlu memiliki jejak/alasan yang dapat diperiksa, terutama untuk N, T, O, B, dan 2T.

Jika hanya tersedia workbook rekap agregat, OpenASP dapat mengimpor hasilnya sebagai laporan historis. Jangan merekonstruksi data per anak dari angka agregat.

## 9. Pertanyaan konfirmasi untuk Bidan/pemilik workbook

### S — Sasaran
1. Di sheet mana S dicatat?
2. Apa definisi S yang digunakan?
3. Apakah S mencakup seluruh balita 0–59 bulan di wilayah Posyandu?
4. Bagaimana memperlakukan anak pindah, pendatang, atau tidak aktif?

### K — Kepemilikan KMS
5. Apakah K berarti seluruh balita yang memiliki KMS atau balita yang terdaftar/tercatat?
6. Apakah anak yang memiliki KMS tetapi tidak hadir tetap masuk K?
7. Bagaimana memperlakukan KMS hilang atau data belum lengkap?

### D — Ditimbang
8. Apakah D hanya menghitung anak yang benar-benar ditimbang pada bulan tersebut?
9. Apakah anak yang hanya diukur panjang/tinggi badan tetapi tidak ditimbang masuk D?
10. Bagaimana jika satu anak ditimbang lebih dari sekali dalam satu bulan?

### N dan T — Perubahan berat badan
11. Apa pembanding untuk menentukan N dan T?
12. Bagaimana anak yang baru pertama kali ditimbang diklasifikasikan?
13. Bagaimana jika bulan sebelumnya tidak hadir atau tidak memiliki hasil pengukuran?
14. Apakah ada aturan pembulatan atau toleransi perubahan berat badan?

### O, B, dan 2T
15. Apa aturan tepat untuk O?
16. Apakah B berarti pertama kali ditimbang sepanjang riwayat atau pertama kali di Posyandu tersebut?
17. Bagaimana menentukan 2T jika ada bulan tanpa penimbangan?

### Kelompok usia dan rincian
18. Bagaimana usia dihitung untuk D2 dan D25?
19. Apakah batas 24 bulan mengikuti usia pada tanggal pengukuran?
20. Apakah semua indikator dirinci menurut L/P dan total?

## 10. Kriteria penerimaan modul SKDN

- [ ] Semua indikator yang tampil pada workbook telah dipetakan.
- [ ] S ditemukan sumbernya atau ditandai tidak tersedia secara eksplisit.
- [ ] Definisi operasional K, D, N, T, O, B, 2T, D2, dan D25 dikonfirmasi.
- [ ] Formula asli Excel diperiksa jika tersedia.
- [ ] Kasus anak baru pertama kali ditimbang telah diuji.
- [ ] Kasus tidak hadir pada bulan sebelumnya telah diuji.
- [ ] Kasus data ganda dalam satu bulan telah diuji.
- [ ] Batas usia 23/24 bulan telah diuji.
- [ ] Rekap L, P, dan L+P konsisten.
- [ ] Hasil OpenASP dibandingkan dengan workbook pada sampel yang sama.
- [ ] Pemilik proses/Bidan menyetujui definisi dan hasil uji.

## 11. Keputusan implementasi sementara

1. Pertahankan kode dan label yang ditemukan di workbook.
2. Jangan mengarang nilai atau formula S.
3. Jangan menyimpulkan `S = K`.
4. Jangan mengunci formula N/T/O/B/2T hanya berdasarkan label.
5. Bangun import yang dapat menyimpan rekap historis tanpa mengklaim telah menghitung ulang.
6. Pisahkan definisi SKDN dari UI agar aturan dapat diperbarui tanpa membongkar tampilan.
7. Tandai hasil perhitungan yang belum tervalidasi sebagai draft/internal, bukan hasil resmi.

## 12. Riwayat perubahan

| Versi | Perubahan |
|---|---|
| 0.1 | Pemetaan awal label dan struktur SKDN berdasarkan hasil ekstraksi workbook; mencatat indikator yang ditemukan dan pertanyaan validasi. |

---

**Catatan akhir:** dokumen ini merupakan hasil reverse engineering awal terhadap workbook yang diberikan, bukan pedoman resmi SKDN. Verifikasi formula pada workbook asli dan minta konfirmasi pemilik proses/Bidan sebelum menjadikan aturan ini sebagai perhitungan produksi.
