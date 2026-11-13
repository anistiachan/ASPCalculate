/**
 * Tata letak sheet Posyandu (`P1`…`P10`) workbook ASP Karangtawar 2025, dibaca dari berkas
 * asli (lihat docs/OPENASP-MAPPING-KARANGTAWAR-v0.1.md). Posisi kolom tetap; bila pemilik
 * mengubah tata letak, deteksi header gagal dan import ditolak, bukan salah baca.
 *
 * Hanya sel ISIAN yang dibaca. Sel TB bulan Maret–Juli dan September–Desember diisi RUMUS di
 * workbook (perkiraan tinggi = tinggi sebelumnya + tambahan umur), bukan hasil ukur, jadi
 * sengaja tidak diimpor.
 */

export const KARANGTAWAR_ADAPTER_ID = "asp-karangtawar"

/** Baris data pertama (nomor baris Excel) dan terakhir pada sheet Posyandu. */
export const FIRST_DATA_ROW = 9
export const LAST_DATA_ROW = 308

/** Huruf kolom Excel → indeks kolom berbasis nol. */
export function columnIndex(letters: string): number {
  let index = 0
  for (const char of letters.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64)
  }
  return index - 1
}

export const CHILD_COLUMNS = {
  birthOrder: "D",
  birthWeightKg: "E",
  birthLengthCm: "F",
  posyandu: "L",
  name: "N",
  sex: "O", // 1 = laki-laki, 2 = perempuan
  firstMeasureDay: "P",
  birthDay: "S",
  birthMonth: "T",
  birthYear: "U", // dua digit
  referenceYear: "R", // dua digit: tahun data pada baris itu
} as const

/** Penanda header untuk mengenali sheet Posyandu (baris 7, nomor Excel). */
export const HEADER_ROW = 7
export const HEADER_CELLS = { posyandu: "L", name: "N" } as const

export type MonthColumns = {
  /** 1–12 untuk tahun data; 0 = tahun sebelumnya (diberi `yearOffset`). */
  month: number
  yearOffset: 0 | -1
  weight: string
  /** Hanya kolom TB yang berisi isian (bukan rumus). */
  height: string | null
  vitaminABlue: string | null
  vitaminARed: string | null
  /** ASI eksklusif "Ya" dan "Tdk" (hanya putaran Februari dan Agustus). */
  asiYes: string | null
  asiNo: string | null
}

const month = (
  m: number,
  weight: string,
  height: string | null = null,
  vitaminABlue: string | null = null,
  vitaminARed: string | null = null,
  asiYes: string | null = null,
  asiNo: string | null = null
): MonthColumns => ({
  month: m,
  yearOffset: 0,
  weight,
  height,
  vitaminABlue,
  vitaminARed,
  asiYes,
  asiNo,
})

export const MONTH_COLUMNS: readonly MonthColumns[] = [
  { ...month(11, "V", "W"), yearOffset: -1 }, // November tahun sebelumnya
  { ...month(12, "X", "Y"), yearOffset: -1 }, // Desember tahun sebelumnya
  month(1, "AE", "AF"),
  month(2, "AH", "AI", "AJ", "AK", "AL", "AM"),
  month(3, "AO"),
  month(4, "AR"),
  month(5, "AU"),
  month(6, "AX"),
  month(7, "BA"),
  month(8, "BD", "BE", "BF", "BG", "BH", "BI"),
  month(9, "BK"),
  month(10, "BN"),
  month(11, "BQ"),
  month(12, "BT"),
]

/** Hari penimbangan bila kolom tanggal ukur kosong atau tidak masuk akal. */
export const DEFAULT_MEASURE_DAY = 14
