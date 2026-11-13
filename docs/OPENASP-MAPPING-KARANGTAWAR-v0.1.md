# OPENASP — Mapping Workbook ASP Karangtawar 2025 (v0.1)

**Status:** Hasil membaca berkas asli `ASP KARANGTAWAR 2025.xls` (sheet, rumus, dan tabel ambang). Adapter import dan perhitungan SKDN sudah mengikutinya; hasilnya dibandingkan dengan sheet SKDN asli (lihat bagian "Hasil pembandingan").

Berkas asli memuat data pribadi anak dan **tidak boleh di-commit** (`.gitignore` mengabaikan `docs/*.xls*`). Dokumen ini tidak memuat data anak.

## Sheet pada workbook

| Sheet | Fungsi | Diimpor? |
| --- | --- | --- |
| `START` | Menu, kode wilayah, desa, bulan aktif | Tidak |
| `P1`–`P10` | **Input** per Posyandu: satu baris per anak, satu blok kolom per bulan | **Ya** |
| `SKDN` | Rekap per bulan = jumlah P1–P10 | Tidak (dihitung ulang, lalu dibandingkan) |
| `PSG` | Status gizi satu bulan, satu baris per anak (judul sheet: Dinkes Prov. Jatim, "z-score WHO-2005", tabel acuan sendiri) | **Ya, sebagai masukan** (nama, tanggal timbang dan lahir, BB, TB, Posyandu). Z-score dan status sheet diabaikan; OpenASP menghitung ulang dengan WHO 2006 + Permenkes 2/2020 |
| `Sasaran` | Daftar sasaran Vitamin A biru/merah dan ASI eksklusif per bulan | Aturannya dihitung ulang (halaman Daftar Pantauan); isian Vitamin A dan ASI dibaca dari sheet P |
| `EPPGBM` | Format ekspor e-PPGBM (NIK, nama orang tua, alamat, hasil ukur) | Belum |
| `NTOB`, `CHEK` | Pemeriksaan dan kerja antara | Tidak |

## Tata letak sheet Posyandu (baris data 9–308)

| Kolom | Isi |
| --- | --- |
| D, E, F | Anak ke-, berat lahir, panjang lahir |
| L | Nama Posyandu (contoh: JERUK, PEPAYA) |
| N | Nama anak |
| O | Jenis kelamin: **1 = laki-laki, 2 = perempuan** (header kolom dan rumus workbook) |
| P, R | Hari tanggal ukur (selalu 14 pada berkas contoh) dan tahun data (dua digit) |
| S, T, U | Tanggal lahir: hari, bulan, tahun (dua digit) |
| V/W, X/Y | BB/TB November dan Desember **tahun sebelumnya** |
| AE/AF, AH/AI, AO, AR, AU, AX, BA, BD/BE, BK, BN, BQ, BT | BB (dan TB bila ada) Januari … Desember |
| AJ/AK, BF/BG | Vitamin A biru/merah (Februari, Agustus): isi 1 bila diberikan |
| AL/AM, BH/BI | ASI eksklusif ya/tidak (Februari, Agustus) |

## Temuan penting

1. **TB bulan Maret–Juli dan September–Desember diisi RUMUS** (perkiraan: tinggi sebelumnya + tambahan menurut umur), bukan hasil ukur. Hanya TB Januari, Februari, dan Agustus yang isian. Adapter tidak mengimpor sel rumus.
2. **NIK tidak bisa dipakai.** Di sheet P kolom NIK berisi 0 atau kosong; di sheet EPPGBM semua NIK berakhiran `0000` (110 unik dari 111 anak). Anak dikenali dengan kunci **Posyandu + nama + tanggal lahir** (`importKey`), bukan NIK.
3. **Tanggal ukur hanya sampai bulan.** Hari diambil dari kolom tanggal ukur baris itu (atau 14). Umur dalam hari, sehingga z-score, bersifat perkiraan; ada peringatan di pratinjau.
4. **Cara ukur (berdiri/terlentang) tidak tercatat di sheet P**, hanya di sheet EPPGBM. Status TB/U dan BB/TB memakai nilai tanpa koreksi posisi; ada peringatan.
5. **Kolom "Bulan Pertama Timbang" (Z) kosong di berkas ini.** Akibatnya workbook menghitung K, B, dan O berbeda dari maksud kolom itu (lihat mapping SKDN v0.2). OpenASP memakai bulan pertama ditimbang dari riwayat.
6. **Bug rumus K bulan November:** sel menunjuk umur bulan September, bukan November. Tidak ditiru.
7. **Ukuran berkas 103 MB**: membaca di browser butuh ±30 detik dan ±2,5 GB memori, dan batas impor aplikasi 20 MB. Gunakan `npm run karangtawar:slim` (menghasilkan ±270 KB berisi hanya P1–P10 dan kolom yang dipakai; NIK, nama orang tua, alamat, RT/RW tidak ikut).

Data berkas saat dibaca: 111 anak (JERUK 89, PEPAYA 22), P3–P10 kosong, penimbangan Januari–Juni 2025.

## Hasil pembandingan SKDN (lokal)

Adapter + modul SKDN dijalankan pada berkas ringkas dan dibandingkan dengan sheet SKDN asli, per bulan dan per jenis kelamin (L, P, L+P): 9 indikator × 12 bulan × 3 = 324 angka.

- **321 sama persis**, memakai mode `workbookParity` (meniru kolom Z yang kosong).
- **3 selisih**, semuanya K November (bug rumus workbook di atas).
- Tanpa mode kesetaraan, K, B, dan O berbeda **karena aturan yang disengaja** (bulan pertama ditimbang dari riwayat), sedangkan D, D2, D25, N, T, dan 2T tetap sama.

Pembandingan ini berjalan lokal saja (`karangtawar-compare.local.test.ts`, dilewati tanpa variabel lingkungan `KARANGTAWAR_SLIM` dan `KARANGTAWAR_EXPECTED`) agar repository tidak memuat data nyata. Tes di repo memakai berkas sintetis `samples/contoh-karangtawar.xlsx`.

## Daftar keluaran menu dan sasaran (halaman Daftar Pantauan)

Menu keluaran workbook (sheet PSG dan Sasaran) dibuat ulang dari data per anak, dengan mesin WHO 2006 + Permenkes 2/2020, **bukan** tabel acuan sheet PSG. Anggota daftar di dekat batas bisa berbeda tipis dari workbook.

| Menu workbook | Definisi di OpenASP | Rumus workbook (PSG) |
| --- | --- | --- |
| Sangat Pendek / Pendek | TB/U < −3 SD / −3 sampai < −2 SD | `X` / `W` |
| BGM | BB/U < −3 SD (berat badan sangat kurang) | `Y` |
| BBK | BB/U −3 sampai < −2 SD | `AH` |
| Sangat Kurus / Kurus | BB/PB-TB < −3 SD (gizi buruk) / −3 sampai < −2 SD (gizi kurang) | `AA` / `Z` |
| Gemuk | BB/PB-TB > +2 SD (gizi lebih dan obesitas) | `AB` |
| Calon Balita Kurus | BB/PB-TB −2 sampai < −1,8 SD (ambang bantu milik workbook, bukan Permenkes) | `AD` |
| Balita Bermasalah | salah satu dari sangat pendek, pendek, BGM, kurus, sangat kurus, gemuk, calon kurus; **BBK tidak termasuk** | `AC` |

Sasaran (sheet Sasaran, umur bulan kalender): **Vitamin A biru** 6–11 bulan, **Vitamin A merah** 12–60 bulan, **ASI eksklusif** 0–6 bulan. Vitamin A "sudah" bila ada isian pada bulan itu, selain itu "belum tercatat" (kosong tidak dianggap "tidak"). ASI-E (Ya/Tdk) disimpan pada umur anak saat putaran Februari/Agustus (0–6 bulan).

Daftar memuat nama anak. Excel unduhan daftar menyebutnya terang-terangan, tidak memuat NIK atau tanggal lahir, dan nama ditulis sebagai sel teks (bukan rumus).

## Sheet PSG: impor, ukur ulang, dan rekap P1

**Impor PSG** (`adapters/psg`). Satu sheet PSG = satu bulan. Dikenali dari sheet bernama `PSG` dengan header `NAMA` (C6), `Tg.Timbang` (E6), `Tgl.Lahir` (H6). Kolom yang dibaca: C nama, D jenis kelamin (1 = L, 2 = P), E/F/G tanggal timbang (hari, bulan, tahun dua digit), H/I/J tanggal lahir, L BB, M TB, AG Posyandu. Kunci anak sama dengan adapter sheet P (`KT|POSYANDU|NAMA|tanggal lahir`), jadi PSG dan P1–P10 menyatu pada anak yang sama. Berkas yang memuat sheet P dan PSG sekaligus dibaca lewat sheet P (data sumber, bukan hasil hitungan).

**Template dan contoh PSG.** Template PSG kosong yang rapi (pita judul, header hijau, kolom berwarna untuk hasil hitungan, validasi isian untuk sex, tanggal, BB 1–30 kg, dan TB 35–130 cm) tersedia di halaman Import (`public/templates/template-psg.xlsx`). Petugas hanya mengisi nama, sex, tanggal timbang, tanggal lahir, BB, TB, dan Posyandu. Contoh sintetis: `samples/contoh-psg-valid.xlsx` dan `samples/contoh-psg-bermasalah.xlsx`. Ketiganya dibuat `npm run samples:generate` (skrip `generate-psg-files.mjs`, memakai `exceljs` sebagai devDependency karena SheetJS edisi gratis tidak bisa menulis gaya sel).

Pratinjau import juga memberi **peringatan kewajaran** (tidak menolak) untuk BB di luar 1–30 kg dan TB di luar 35–130 cm, mis. TB 814 cm yang seharusnya 81,4.

Peringatan impor: cara ukur tidak tercatat, dan **TB di workbook hanya hasil ukur untuk Januari, Februari, dan Agustus**; sheet PSG menarik TB bulan lain dari rumus perkiraan sheet P, sehingga status stunting bulan itu bisa berdasarkan TB perkiraan. Pratinjau memberi peringatan, dan hasilnya perlu diverifikasi dengan ukur ulang.

**Hasil pemeriksaan setelah impor.** Begitu Simpan, halaman Import menampilkan "Hasil pemeriksaan" untuk anak dari berkas itu (per bulan bila berkas memuat beberapa bulan): jumlah anak yang diperiksa, daftar anak yang perlu perhatian (status tidak normal atau data dicurigai salah) dengan z-score dan statusnya, tombol **Unduh hasil PSG dengan z-score dan status**, tombol unduh daftar ukur ulang, dan tautan ke Daftar Pantauan. Data yang sama tetap bisa dibuka kapan saja di Daftar Pantauan.

**Ukur ulang (halaman Daftar Pantauan).**
1. Bagian "Perlu diukur ulang" memuat anak berstatus pendek atau sangat pendek (untuk diverifikasi) dan ukuran yang dicurigai salah: tinggi turun lebih dari 1 cm, berat turun lebih dari 1 kg, nilai di luar rentang wajar, atau z-score di luar batas WHO (TB/U ±6, BB/U −6 sampai +5, BB/TB ±5). Ambang bersifat sementara, perlu dikonfirmasi tenaga gizi.
2. Tombol "Unduh daftar ukur ulang" menghasilkan Excel dengan kolom kosong `BB baru`, `TB baru`, `Tgl ukur ulang` dan kolom `Kode` (jangan diubah).
3. Petugas mengisi **hasil ukur ulang nyata**, lalu berkas diimpor kembali. Baris ditolak bila tanggal kosong, BB atau TB tidak lengkap, nilai di luar rentang wajar, tanggal tidak setelah ukuran semula, di masa depan, atau sudah ada pengukuran pada tanggal itu. Selisih besar dari ukuran semula (TB lebih dari 3 cm atau BB lebih dari 2 kg) wajib dikonfirmasi per baris.
4. Pratinjau menampilkan angka lama → baru dan TB/U semula → hasil ukur ulang. Setelah disetujui, angka disimpan sebagai **pengukuran baru** pada tanggal ukur ulang; ukuran lama tidak ditimpa atau dihapus, dan catatan baris menyimpan ukuran semula.

Aplikasi sengaja **tidak** menyediakan perubahan otomatis atau angka acak agar anak tidak berstatus pendek: angka hanya berubah dari hasil ukur ulang nyata.

**Rekap P1** (kartu "Rekap format P1 beberapa bulan"). Mengekspor satu sheet per Posyandu (P1, P2, …) pada posisi kolom yang sama dengan workbook, sehingga bisa dibaca kembali oleh adapter Karangtawar (diuji putaran penuh). Tampilannya meniru sheet P1 asli: judul "HASIL PENGUKURAN ANTROPOMETRI BALITA", header tiga baris (6–8), blok per bulan (Umur, BB, TB), blok Februari dan Agustus berwarna dengan Vitamin A biru/merah dan ASI-E Ya/Tdk, panel beku sampai kolom N, dan blok **STATUS PERTUMBUHAN** (BV–CG) berisi huruf N/T/B/O per bulan. Kolom Umur (bulan kalender) dan STATUS PERTUMBUHAN diisi OpenASP sebagai nilai (bukan rumus), memakai aturan SKDN draf; sel umur hitam berarti 61 bulan atau lebih. Kolom kode wilayah, NIK, Buku KIA, nama ortu, RT, dan RW dibiarkan kosong (tidak disimpan OpenASP), dan kolom "Bln Pertma Timbang" (Z) sengaja tidak diisi karena artinya belum dikonfirmasi Bidan. **Template P1** kosong (tombol di halaman Import) memakai tampilan yang sama dengan 100 baris bernomor dan validasi isian (sex, tanggal lahir, BB 1–30 kg, TB 35–130 cm); `exceljs` dipakai untuk menulis gaya sel dan dimuat malas hanya saat tombol unduh ditekan. Keterbatasan format: TB hanya diekspor untuk Januari, Februari, Agustus, serta November dan Desember tahun sebelumnya; tanggal ukur hanya sampai bulan; bila sebulan ada beberapa pengukuran, yang terakhir dipakai. Sel hasil ukur ulang diberi komentar sel.

## Belum dikerjakan

- Ekspor e-PPGBM (sheet EPPGBM: NIK, data orang tua, alamat, cara ukur) karena memuat data pribadi sensitif dan NIK di berkas ini tidak andal.
- Selisih daftar OpenASP dengan sheet PSG belum dibandingkan; perlu tinjauan tenaga kesehatan karena tabelnya berbeda.
- Konfirmasi Bidan: nilai kolom Z, batas umur K, arti ASI-E, dan apakah ambang calon balita kurus (−1,8 SD) masih dipakai.
