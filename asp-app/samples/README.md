# File contoh import

File Excel **sintetis** untuk mencoba halaman **Import Excel**. Semua nama, NIK, dan angka dibuat-buat. Angka berat dan tinggi hanya perkiraan kasar agar tampak masuk akal, bukan data pertumbuhan, dan tidak boleh dipakai sebagai acuan perhitungan.

| File                              | Isi                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `contoh-bu-bidan-valid.xlsx`      | 10 anak, pengukuran Januari, Juni, dan September. Seharusnya diimpor tanpa error maupun peringatan.                                       |
| `contoh-bu-bidan-valid.xls`       | Isi sama, format Excel lama (.xls), untuk menguji dukungan format tersebut.                                                               |
| `contoh-bu-bidan-bermasalah.xlsx` | Sengaja berisi error dan peringatan agar terlihat bagaimana pratinjau menampilkannya.                                                     |
| `contoh-karangtawar.xlsx`         | Format ASP Karangtawar: 6 anak di Posyandu JERUK dan PEPAYA, penimbangan Januari–Maret 2026, Vitamin A dan ASI Februari.                  |
| `contoh-p1-valid.xlsx`            | Template P1 yang diisi: 8 anak fiktif di JERUK dan PEPAYA, Januari–Agustus 2026, Vitamin A dan ASI-E; satu pendek dan satu sangat pendek. |
| `contoh-p1-bermasalah.xlsx`       | Template P1 dengan sex salah, tanggal lahir 31 Februari, tanpa Posyandu/tahun, berat negatif, BB 105 dan TB 814, dan data ganda.          |
| `contoh-psg-valid.xlsx`           | Sheet PSG bulanan (Februari 2026): 4 anak fiktif, satu pendek dan satu sangat pendek, untuk mencoba alur ukur ulang.                      |
| `contoh-psg-bermasalah.xlsx`      | Sheet PSG dengan sex salah, tanggal lahir/timbang tidak valid, tanpa Posyandu, data ganda, dan TB 814 cm (salah ketik).                   |

## Yang bisa dicoba

**File valid**

- Pratinjau: 10 anak dan 26 pengukuran, 0 error, 0 peringatan.
- Sheet `CONTOH` dilewati. Sheet Februari berisi 9 anak yang belum diukur (bukan kesalahan).
- Tanggal ukur memakai tiga gaya (sel tanggal Excel, teks `DD/MM/YYYY`, teks `YYYY-MM-DD`) dan angka memakai titik maupun koma desimal.
- Setelah disimpan, impor file yang sama sekali lagi: tidak ada data baru. Semuanya terhitung "sudah ada".

**File bermasalah**

- Error: kode jenis kelamin numerik, NIK kosong, NIK ganda di data induk, berat bukan angka, NIK pengukuran tidak ada di data induk, tanggal ukur sebelum tanggal lahir, berat nol.
- Peringatan: baris bertanda pindah, nama dan tanggal lahir berbeda, cara ukur tidak dikenal, pitting edema terisi, kolom tidak dikenal, pengukuran ganda.
- Baris yang valid tetap bisa disimpan.

## Membuat ulang

```bash
npm run samples:generate
```

Skripnya ada di `scripts/generate-sample-workbooks.mjs`. Tes `src/test/samples.test.ts` memastikan file di folder ini tetap sesuai tabel di atas.
