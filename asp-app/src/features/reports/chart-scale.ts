export type ChartScale = {
  /** Selisih antar garis bantu (bilangan bulat "bersih": 1, 2, 5, 10, 20, 50, ...). */
  step: number
  /** Jumlah interval sumbu Y. */
  intervals: number
  /** Nilai tertinggi sumbu Y (= step × intervals). */
  yMax: number
}

const MAX_INTERVALS = 5
const MIN_INTERVALS = 2

/**
 * Skala sumbu Y untuk jumlah (bilangan bulat). Memilih langkah "bersih" terkecil yang
 * cukup untuk menampung nilai dalam paling banyak 5 interval, sehingga semua garis bantu
 * jatuh di bilangan bulat dan tidak ada ruang kosong berlebihan di atas batang tertinggi.
 */
export function niceScale(maxValue: number): ChartScale {
  const max = Math.max(0, Math.ceil(maxValue))

  let step = 1
  // Urutan 1, 2, 5, 10, 20, 50, 100, ...
  for (let exponent = 0; ; exponent++) {
    const base = 10 ** exponent
    const candidate = [1, 2, 5]
      .map((m) => m * base)
      .find((s) => s * MAX_INTERVALS >= max)
    if (candidate !== undefined) {
      step = candidate
      break
    }
  }

  const intervals = Math.max(MIN_INTERVALS, Math.ceil(max / step))
  return { step, intervals, yMax: step * intervals }
}
