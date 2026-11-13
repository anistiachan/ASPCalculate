import type { SheetSpec } from "../../parsers/sheet-table"

/**
 * Header yang benar-benar ditemukan pada workbook Bu Bidan (dinormalisasi oleh
 * `normalizeHeader`: huruf kecil, tanpa spasi dan tanda baca). Jangan menambah
 * alias untuk format lain di sini; buat adapter baru untuk format lain.
 */

export const BIDAN_ADAPTER_ID = "bu-bidan"

/**
 * Kolom hitungan yang ditambahkan scripts/add-zscore-to-bu-bidan.ps1 ke sheet bulanan (z-score dan
 * status gizi seperti PSG): hasil rumus Excel, bukan data masukan, jadi tidak diimpor. OpenASP
 * menghitung ulang dengan mesinnya sendiri. Kolom bantu rumus berawalan "bantu".
 */
const BANTU_PREFIX = ["bantu"] as const
const ZSCORE_COLUMNS = [
  "jk",
  "umurbln",
  "ztbu",
  "zbbu",
  "zbbtb",
  "statustbu",
  "statusbbu",
  "statusbbtb",
  "stunting",
] as const

/** Sheet `Tambah Balita` (data induk). Header berada di baris 2. */
export const CHILDREN_SPEC: SheetSpec = {
  fields: {
    rowNumber: ["no"],
    birthOrder: ["anakke"],
    birthDate: ["tgllahir"],
    sex: ["jeniskelamin"],
    nik: ["nik"],
    name: ["namaanak"],
    birthWeightKg: ["beratlahir"],
    birthLengthCm: ["panjanglahir"],
    birthHeadCircumferenceCm: ["lingkarkepalalahir"],
    deleteFlag: ["hapus"],
    movedFlag: ["pindah"],
  },
  // Dikenali tetapi tidak diimpor: data pribadi yang tidak dibutuhkan untuk
  // perhitungan, atau kolom yang maknanya belum dikonfirmasi pemilik format.
  ignoredHeaders: [
    "nomorkk",
    "namaortu",
    "nikortu",
    "hportu",
    "alamat",
    "rt",
    "rw",
    "usiahamil",
    "kia",
    "kiabayikecil",
    "imd",
  ],
  ignoredHeaderPrefixes: BANTU_PREFIX,
  required: ["nik", "name", "birthDate", "sex"],
}

const BREASTFEEDING_MONTHS = [0, 1, 2, 3, 4, 5, 6] as const

export const BREASTFEEDING_FIELDS = BREASTFEEDING_MONTHS.map((month) => ({
  month,
  field: `asiBulan${month}`,
}))

/** Sheet bulanan `JANUARI`–`DESEMBER`. `tanggallahir` hanya ada pada sebagian sheet. */
export const MEASUREMENT_SPEC: SheetSpec = {
  fields: {
    rowNumber: ["no"],
    nik: ["nik"],
    name: ["namaanak"],
    birthDate: ["tanggallahir"],
    measuredAt: ["tanggalukur"],
    weightKg: ["berat"],
    heightCm: ["tinggi"],
    lilaCm: ["lila"],
    headCircumferenceCm: ["lingkarkepala"],
    pittingEdema: ["pittingedema"],
    position: ["caraukur"],
    vitaminA: ["vita"],
    motherToddlerClass: ["kelasibubalita"],
    mbg: ["mbg"],
    note: ["keterangan"],
    ...Object.fromEntries(
      BREASTFEEDING_FIELDS.map(({ month, field }) => [
        field,
        [`asibulan${month}`],
      ])
    ),
  },
  ignoredHeaders: ZSCORE_COLUMNS,
  ignoredHeaderPrefixes: BANTU_PREFIX,
  required: ["nik", "measuredAt", "weightKg", "heightCm"],
}

export const CHILDREN_SHEET_NAME = "tambahbalita"
export const SAMPLE_SHEET_NAME = "contoh"

export const MONTH_SHEET_NAMES: ReadonlySet<string> = new Set([
  "januari",
  "februari",
  "maret",
  "april",
  "mei",
  "juni",
  "juli",
  "agustus",
  "september",
  "oktober",
  "november",
  "desember",
])
