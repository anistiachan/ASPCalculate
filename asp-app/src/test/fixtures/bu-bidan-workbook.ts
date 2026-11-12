import type { SheetData, WorkbookData } from "@/features/excel-import/types"

/**
 * Fixture SINTETIS untuk format Bu Bidan. Semua nama, NIK, dan data pribadi di sini
 * dibuat-buat. Jangan menyalin baris dari workbook asli ke file ini.
 */

export const NIK_A = "3201000000000001"
export const NIK_B = "3201000000000002"
export const NIK_UNKNOWN = "3201000000000099"

export const NAME_A = "Anak Uji Satu"
export const NAME_B = "Anak Uji Dua"

/** Teks penanda untuk membuktikan data pribadi tidak ikut terimpor. */
export const PRIVATE_MARKERS = [
  "ALAMAT-UJI-RAHASIA",
  "ORTU-UJI-RAHASIA",
  "0800000000",
  "3201999999999999",
  "3201888888888888",
]

export const CHILD_HEADERS = [
  "No",
  "anak_ke",
  "tgl_lahir",
  "jenis_kelamin",
  "nomor_KK",
  "NIK",
  "nama_anak",
  "usia_hamil",
  "berat_lahir",
  "panjang_lahir",
  "lingkar_kepala_lahir",
  "kia",
  "kia_bayi_kecil",
  "imd",
  "nama_ortu",
  "nik_ortu",
  "hp_ortu",
  "alamat",
  "rt",
  "rw",
  "hapus",
  "pindah",
]

const MONTH_HEADERS_BASE = [
  "No",
  "NIK",
  "nama_anak",
  "TANGGALUKUR",
  "BERAT",
  "TINGGI",
  "LILA",
  "lingkar_kepala",
  "Pitting_edema",
  "CARAUKUR",
  "vita",
  "asi_bulan_0",
  "asi_bulan_1",
  "asi_bulan_2",
  "asi_bulan_3",
  "asi_bulan_4",
  "asi_bulan_5",
  "asi_bulan_6",
  "kelas_ibu_balita",
  "mbg",
  "KETERANGAN",
]

export const MONTH_HEADERS = MONTH_HEADERS_BASE

/** Sheet Juni–September memiliki TANGGAL LAHIR di antara nama_anak dan TANGGALUKUR. */
export const MONTH_HEADERS_WITH_BIRTH_DATE = [
  ...MONTH_HEADERS_BASE.slice(0, 3),
  "TANGGAL LAHIR",
  ...MONTH_HEADERS_BASE.slice(3),
]

/** Serial tanggal Excel (sistem 1900) untuk tanggal ISO `YYYY-MM-DD`. */
export function excelSerial(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number)
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000
}

export function toRow(
  headers: readonly string[],
  values: Record<string, unknown>
): unknown[] {
  return headers.map((header) => values[header] ?? null)
}

/** Sheet `Tambah Balita`: baris 1 judul, baris 2 header, data mulai baris 3. */
export function childrenSheet(rows: Record<string, unknown>[]): SheetData {
  return {
    name: "Tambah Balita",
    rows: [
      ["DATA BALITA BARU"],
      [...CHILD_HEADERS],
      ...rows.map((values) => toRow(CHILD_HEADERS, values)),
    ],
  }
}

/** Sheet bulanan: header di baris 1, data mulai baris 2. */
export function monthSheet(
  name: string,
  rows: Record<string, unknown>[],
  options: { withBirthDate?: boolean } = {}
): SheetData {
  const headers = options.withBirthDate
    ? MONTH_HEADERS_WITH_BIRTH_DATE
    : MONTH_HEADERS
  return {
    name,
    rows: [[...headers], ...rows.map((values) => toRow(headers, values))],
  }
}

export const CHILD_A_ROW = {
  No: 1,
  anak_ke: 1,
  tgl_lahir: "2023-03-15",
  jenis_kelamin: "L",
  nomor_KK: "3201999999999999",
  NIK: NIK_A,
  nama_anak: NAME_A,
  berat_lahir: "3,2",
  panjang_lahir: 49,
  nama_ortu: "ORTU-UJI-RAHASIA",
  nik_ortu: "3201888888888888",
  hp_ortu: "0800000000",
  alamat: "ALAMAT-UJI-RAHASIA",
  rt: "01",
  rw: "02",
}

export const CHILD_B_ROW = {
  No: 2,
  anak_ke: 2,
  tgl_lahir: excelSerial("2024-01-10"),
  jenis_kelamin: "P",
  NIK: NIK_B,
  nama_anak: NAME_B,
}

/** Workbook valid dengan dua anak dan beberapa sheet bulan, termasuk CONTOH dan template kosong. */
export function buildValidWorkbook(): WorkbookData {
  return {
    sheets: [
      {
        name: "CONTOH",
        rows: [
          [...MONTH_HEADERS],
          toRow(MONTH_HEADERS, {
            No: 1,
            NIK: NIK_UNKNOWN,
            nama_anak: "Contoh Pengisian",
            TANGGALUKUR: "2025-01-01",
            BERAT: 10,
            TINGGI: 80,
          }),
        ],
      },
      childrenSheet([CHILD_A_ROW, CHILD_B_ROW]),
      monthSheet("JANUARI", [
        {
          No: 1,
          NIK: NIK_A,
          nama_anak: NAME_A,
          TANGGALUKUR: excelSerial("2025-01-20"),
          BERAT: "11,2",
          TINGGI: 82.5,
          LILA: "14,5",
          CARAUKUR: "Terlentang",
          vita: "YA",
          asi_bulan_0: "tidak",
        },
        {
          No: 2,
          NIK: NIK_B,
          nama_anak: NAME_B,
          TANGGALUKUR: "20/01/2025",
          BERAT: 9.8,
          TINGGI: "75,5",
          CARAUKUR: "BERDIRI",
        },
      ]),
      monthSheet("FEBRUARI", [
        // Terdaftar tetapi belum diukur bulan ini: bukan kesalahan.
        { No: 1, NIK: NIK_A, nama_anak: NAME_A },
        { No: 2, NIK: NIK_B, nama_anak: NAME_B },
      ]),
      monthSheet(
        "JUNI",
        [
          {
            No: 1,
            "TANGGAL LAHIR": "2023-03-15",
            NIK: NIK_A,
            nama_anak: NAME_A,
            TANGGALUKUR: "2025-06-10",
            BERAT: 12.4,
            TINGGI: 88,
            CARAUKUR: "Berdiri",
          },
          {
            No: 2,
            "TANGGAL LAHIR": "2024-01-10",
            NIK: NIK_B,
            nama_anak: NAME_B,
            TANGGALUKUR: "2025-06-10",
            BERAT: 10.9,
            TINGGI: 80,
            CARAUKUR: "Terlentang",
          },
        ],
        { withBirthDate: true }
      ),
      // Template kosong: hanya header.
      monthSheet("OKTOBER", []),
    ],
  }
}
