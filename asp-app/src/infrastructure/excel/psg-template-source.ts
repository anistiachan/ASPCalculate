/** Lokasi berkas template PSG statis (dibuat scripts/generate-psg-files.mjs). */
export const PSG_TEMPLATE_URL = "/templates/template-psg.xlsx"

/**
 * Mengambil berkas template PSG dari situs ini sendiri (bukan layanan luar; tidak memuat data
 * anak). Dipakai untuk unduhan template dan sebagai dasar tampilan hasil PSG.
 */
export async function fetchPsgTemplate(): Promise<Uint8Array> {
  const response = await fetch(PSG_TEMPLATE_URL)
  if (!response.ok) throw new Error("Template PSG tidak ditemukan.")
  return new Uint8Array(await response.arrayBuffer())
}
