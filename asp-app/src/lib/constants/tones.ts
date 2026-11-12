/**
 * Warna pendamping berbasis token semantik. Setiap tone memasangkan tint pastel
 * dengan teks `ink` yang kontrasnya sudah diuji (>= 4,5:1) di design-tokens.test.ts.
 *
 * Warna tidak boleh menjadi satu-satunya pembawa makna: tone selalu dipakai
 * bersama label teks atau ikon.
 *
 * Kelas ditulis utuh (bukan dirangkai) agar terdeteksi oleh Tailwind.
 */
export type Tone =
  "green" | "pink" | "lavender" | "butter" | "sky" | "danger" | "neutral"

export const TONE_CLASSES: Record<Tone, { chip: string; panel: string }> = {
  green: {
    chip: "bg-tint-green text-ink-green",
    panel: "bg-tint-green text-ink-green",
  },
  pink: {
    chip: "bg-tint-pink text-ink-pink",
    panel: "bg-tint-pink text-ink-pink",
  },
  lavender: {
    chip: "bg-tint-lavender text-ink-lavender",
    panel: "bg-tint-lavender text-ink-lavender",
  },
  butter: {
    chip: "bg-tint-butter text-ink-butter",
    panel: "bg-tint-butter text-ink-butter",
  },
  sky: {
    chip: "bg-tint-sky text-ink-sky",
    panel: "bg-tint-sky text-ink-sky",
  },
  danger: {
    chip: "bg-tint-danger text-ink-danger",
    panel: "bg-tint-danger text-ink-danger",
  },
  neutral: {
    chip: "bg-muted text-foreground",
    panel: "bg-card text-card-foreground",
  },
}
