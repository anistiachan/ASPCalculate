# OPENASP — Mapping SKDN v0.2 (dari rumus workbook asli)

**Status:** Draf. Aturan di bawah dibaca langsung dari rumus workbook `ASP KARANGTAWAR 2025.xls` (sheet SKDN dan P1), menggantikan tebakan dari label di v0.1. Belum disetujui pemilik proses/Bidan dan belum dicocokkan dengan pedoman resmi.

Workbook asli berisi data pribadi anak dan **tidak boleh di-commit** (`.gitignore` mengabaikan `docs/*.xls*`). Dokumen ini hanya memuat rumus dan tabel ambang, tanpa data anak.

## Struktur

- Sheet `SKDN` = jumlah sheet `P1`–`P10` (10 Posyandu × 12 bulan × L/P/L+P). Tiap sel mengambil total kolom di sheet Posyandu (baris 309 untuk laki-laki, 619 untuk perempuan).
- Sheet `P1`…`P10`: satu baris per anak, satu blok kolom per bulan. Satu anak hanya tercatat di satu Posyandu.
- Umur = selisih **bulan kalender** dari bulan lahir (bukan bulan penuh).

## Aturan per anak per bulan

| Kode | Aturan (rumus workbook) | Implementasi OpenASP |
| --- | --- | --- |
| K | Punya minimal satu berat badan di tahun itu, bulan pertama ditimbangnya ≤ bulan laporan, umur < 61 | `classifyChild().K` |
| D | Berat badan bulan itu terisi | `.D` |
| D2 / D25 | D dengan umur 0–23 / 24–59 bulan | `.D2`, `.D25` |
| N | Ditimbang bulan ini **dan** bulan lalu, umur < 61, `ROUND(BB − BB bulan lalu, 1)` ≥ ambang umur/jenis kelamin | `.N` |
| T | Ditimbang bulan ini dan bulan lalu, bukan N | `.T` |
| 2T | T bulan ini dan T bulan lalu | `.T2` |
| B | Bulan ini adalah bulan pertama anak ditimbang | `.B` |
| O | Ditimbang bulan ini, bukan bulan pertama, dan bulan lalu tidak ditimbang | `.O` |

Ambang kenaikan minimal ada di `src/domain/reporting/skdn-thresholds.ts` (disalin dari tabel `GJ:GL` sheet P1): 1 bln 0,8 · 2 bln 0,9 · 3 bln 0,8 · 4 bln 0,6 · 5 bln 0,5 · 6 bln 0,4 · 7 bln 0,4 L/0,3 P · 8–10 bln 0,3 · 11 bln 0,3 L/0,2 P · ≥ 12 bln 0,2 (kg).

## Yang menjawab pertanyaan v0.1

- **K bukan "punya KMS".** Rumusnya menghitung anak yang pernah ditimbang (sejak bulan pertama ditimbang). Karena itu K bisa dihitung dari data aplikasi.
- **N/T:** pembanding = penimbangan bulan kalender sebelumnya; tidak ada toleransi selain ambang tabel; pembulatan 1 desimal.
- **B:** pertama kali ditimbang dalam data workbook (satu tahun). OpenASP memakai seluruh riwayat di perangkat.
- **Data ganda sebulan:** workbook hanya punya satu berat per bulan; OpenASP memakai penimbangan terakhir bulan itu.
- **2T:** dua bulan kalender berturut-turut; bulan tanpa penimbangan memutus rangkaian.
- **D2/D25:** umur pada bulan laporan (kalender); 23 bulan = D2, 24 bulan = D25.

## Masih perlu dikonfirmasi ke Bidan

1. Batas umur K memakai `< 61` (rumus) padahal label "0–59 bln". OpenASP memakai rumus (`SKDN_MAX_AGE_EXCLUSIVE`).
2. **S (sasaran)** tidak ada di rumus yang dibaca; `S ≠ K`. Tidak dihitung.
3. Baris `BGM`/`BBK` di sheet SKDN mengambil dari sheet `PSG`: belum dipelajari.
4. Tabel ambang kenaikan berat badan: cocokkan dengan pedoman resmi. Baris umur 68–69 bulan (perempuan 0,1) di luar rentang dan tidak dipakai.
5. Rekap per Posyandu butuh kolom nama Posyandu pada data (belum ada).
6. Pembandingan hasil OpenASP dengan angka workbook pada data yang sama belum dilakukan; butuh adapter import workbook Karangtawar.

## Kode

`src/domain/reporting/skdn.ts` (aturan), `skdn-thresholds.ts` (tabel), `skdn.test.ts` (tes: bulan pertama, bulan kosong, 2T, data ganda, batas 23/24 dan 60/61 bulan, lintas tahun, invarian N+T+O+B = D). Tampil di halaman Laporan dan sheet "SKDN (Draf)" pada Excel, selalu berlabel draf.
