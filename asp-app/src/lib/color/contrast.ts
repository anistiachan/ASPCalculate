/** Rumus kontras WCAG 2.x untuk warna hex 6 digit (#rrggbb). */

function channel(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function parseHex(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
    throw new Error(`Warna hex 6 digit diharapkan, diterima: ${hex}`)
  }
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a
  )
  return (lighter + 0.05) / (darker + 0.05)
}

/** Warna hasil menumpuk `foreground` dengan opasitas `alpha` (0–1) di atas `background`. */
export function blend(
  foreground: string,
  background: string,
  alpha: number
): string {
  const fg = parseHex(foreground)
  const bg = parseHex(background)
  const mixed = fg.map((value, i) =>
    Math.round(value * alpha + bg[i] * (1 - alpha))
  )
  return `#${mixed.map((v) => v.toString(16).padStart(2, "0")).join("")}`
}
