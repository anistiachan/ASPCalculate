# OpenASP: Definisi dan Asumsi Laporan (Phase 4)

Dokumen ini mencatat apa yang dihitung dashboard dan laporan bulanan, asumsi yang dipakai, dan apa yang sengaja belum dibuat. Kode: `src/domain/reporting/`.

## Yang dihitung

| Angka | Definisi |
| --- | --- |
| Balita terdata (bulan M) | Anak yang lahir pada atau sebelum hari terakhir bulan M **dan** berumur kurang dari 60 bulan penuh pada tanggal 1 bulan M. |
| Ditimbang | Anak terdata yang punya pengukuran di bulan M dengan berat badan terisi. |
| Diukur panjang/tinggi | Sama, dengan panjang/tinggi badan terisi. |
| Persen ditimbang | Ditimbang ÷ terdata. Bila terdata = 0, tampil "–" (bukan 0%). |
| Status gizi | Anak dihitung **satu kali per bulan**, dari pengukuran terakhir bulan itu yang punya berat atau tinggi. Kategori memakai mesin antropometri Phase 3. |
| Dinilai / Tidak dapat dihitung | Anak yang indikatornya bisa / tidak bisa dihitung (data kurang, di luar rentang, dll). |
| Persen kategori | Jumlah kategori ÷ **dinilai**, bukan ÷ semua anak. |
| Vitamin A | "Tercatat ya", "tercatat tidak", dan "tidak diisi" dibedakan. Kolom kosong tidak dianggap "tidak". |

Semua angka dipecah menurut jenis kelamin (laki-laki, perempuan, jumlah).

## Berkas Excel

Berisi sheet Ringkasan, Status Gizi, Vitamin A, dan Catatan. Hanya angka agregat: tanpa nama, NIK, atau catatan pengguna. Persen berupa sel numerik berformat `0.0%`. Catatan memuat peringatan belum divalidasi, versi, dan daftar "belum tersedia".

## Belum tersedia (dan alasannya)

- **SKDN resmi:** K, D, D2, D25, N, T, O, B, 2T tampil sebagai **draf** menurut rumus workbook asli ([OPENASP-MAPPING-SKDN-v0.2.md](OPENASP-MAPPING-SKDN-v0.2.md)), belum disetujui Bidan. **S (sasaran)** tidak ada sumbernya sehingga tidak dihitung dan tidak disamakan dengan K.
- **ASI eksklusif, kelas ibu, MBG:** data belum ada di sumber (workbook Bu Bidan) atau definisinya belum dikonfirmasi.
- **Rekap per Posyandu:** data belum memuat nama Posyandu.

## Yang dibutuhkan untuk melanjutkan

1. Sumber S (sasaran) dan persetujuan Bidan atas aturan SKDN draf (daftar di bagian "Masih perlu dikonfirmasi" pada mapping v0.2).
2. Konfirmasi sumber data ASI eksklusif, kelas ibu, MBG, dan nama Posyandu.
3. Tinjauan tertulis tenaga kesehatan atas `OPENASP-VALIDASI-ANTROPOMETRI.md`.

## Catatan grafik

Grafik kolom dibuat dengan SVG sendiri (bukan Recharts seperti di rencana arsitektur) agar mengikuti aturan skill dataviz dan kontrol aksesibilitas penuh. Palet (`--viz-*` di `globals.css`) divalidasi dengan `validate_palette.js`: biru (kurang) dan oranye (lebih) lolos semua uji termasuk simulasi buta warna. Abu-abu netral (normal) sengaja di bawah kontras 3:1, sehingga **tabel pendamping wajib** ada di setiap grafik dan batang. Belum ada tema gelap, jadi varian gelap palet belum diperlukan.
