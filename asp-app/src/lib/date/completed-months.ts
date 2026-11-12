/**
 * Umur dalam bulan penuh antara dua tanggal ISO (`YYYY-MM-DD`), mengikuti
 * definisi Permenkes 2/2020: umur 2 bulan 29 hari dihitung 2 bulan. Sebuah bulan
 * dianggap penuh saat tanggal harian lahir tercapai.
 *
 * HANYA untuk tampilan (daftar, filter kelompok umur). Aturan umur yang dipakai
 * untuk memilih tabel referensi pertumbuhan masih harus dikunci di Phase 3, dan
 * fungsi ini tidak boleh dipakai sebagai masukan perhitungan z-score.
 *
 * Mengembalikan null jika `on` lebih awal daripada `birthDate`.
 */
export function completedMonths(birthDate: string, on: string): number | null {
  if (on < birthDate) return null

  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number)
  const [year, month, day] = on.split("-").map(Number)

  const months = (year - birthYear) * 12 + (month - birthMonth)
  return day < birthDay ? months - 1 : months
}

/** Tanggal hari ini (zona waktu perangkat) sebagai `YYYY-MM-DD`. */
export function todayIso(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
