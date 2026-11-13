/**
 * Tata letak sheet `PSG` workbook ASP Karangtawar 2025 ("Penentuan status gizi"), dibaca dari
 * berkas asli. Satu sheet = satu bulan penimbangan; satu baris = satu anak. Posisi kolom
 * tetap; bila tata letak berubah, deteksi header gagal dan import ditolak, bukan salah baca.
 *
 * Kolom z-score dan status gizi sheet ini diabaikan: OpenASP menghitung ulang dengan WHO 2006
 * dan Permenkes 2/2020.
 */

export const PSG_ADAPTER_ID = "asp-psg"

export const PSG_SHEET_NAME = "PSG"

/** Baris data pertama (nomor baris Excel). Baris terakhir ditentukan oleh isi kolom nama. */
export const PSG_FIRST_DATA_ROW = 9

/** Penanda header untuk mengenali sheet PSG (baris 6, nomor Excel). */
export const PSG_HEADER_ROW = 6
export const PSG_HEADER_CELLS = {
  name: { column: "C", text: "nama" },
  measureDate: { column: "E", text: "tgtimbang" },
  birthDate: { column: "H", text: "tgllahir" },
} as const

export const PSG_COLUMNS = {
  name: "C",
  sex: "D", // 1 = laki-laki, 2 = perempuan
  measureDay: "E",
  measureMonth: "F",
  measureYear: "G", // dua digit
  birthDay: "H",
  birthMonth: "I",
  birthYear: "J", // dua digit
  weightKg: "L",
  heightCm: "M",
  /** Nama Posyandu (di workbook asli diambil dari sheet CHEK). */
  posyandu: "AG",
} as const

/**
 * TB pada sheet P workbook hanya ISIAN untuk Januari, Februari, dan Agustus; bulan lain berupa
 * rumus perkiraan. Sheet PSG menarik nilai itu apa adanya, sehingga TB bulan lain mungkin
 * bukan hasil ukur.
 */
export const MEASURED_HEIGHT_MONTHS: readonly number[] = [1, 2, 8]
