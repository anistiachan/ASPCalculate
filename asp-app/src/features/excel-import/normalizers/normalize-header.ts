/**
 * Menyeragamkan teks header agar pemetaan tidak bergantung pada huruf besar/kecil,
 * spasi, atau tanda baca: "TANGGAL LAHIR", "tanggal_lahir", dan "Tanggal-Lahir"
 * semuanya menjadi "tanggallahir".
 */
export function normalizeHeader(raw: unknown): string {
  if (raw === null || raw === undefined) return ""
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}
