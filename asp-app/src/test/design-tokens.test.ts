import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { blend, contrastRatio } from "@/lib/color/contrast"

/**
 * Menguji aturan docs/design/skill.md yang bisa diukur: WCAG 2.2 AA untuk teks
 * (4,5:1) dan komponen/fokus (3:1), skala tipografi, radius, dan font.
 * Token dibaca langsung dari globals.css agar tidak ada salinan yang bisa melenceng.
 */

const root = process.cwd()
const css = readFileSync(join(root, "src/app/globals.css"), "utf8")

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`Blok ${selector} tidak ditemukan`)
  const end = css.indexOf("\n}", start)
  return css.slice(start, end)
}

const rootBlock = block(":root")
const tokens = Object.fromEntries(
  [...rootBlock.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(
    (match) => [match[1], match[2]]
  )
)

const token = (name: string): string => {
  const value = tokens[name]
  if (!value) throw new Error(`Token --${name} tidak ada di :root`)
  return value
}

const TEXT_MIN = 4.5 // WCAG 1.4.3
const NON_TEXT_MIN = 3 // WCAG 1.4.11 dan indikator fokus

/** [teks, latar] yang dipakai komponen. */
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-hover"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["foreground", "muted"],
  ["primary", "background"], // tautan/teks teal
  ["primary", "card"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["sidebar-primary-foreground", "sidebar-primary"],
  ["success-ink", "card"],
  ["success-ink", "background"],
  ["warning-ink", "card"],
  ["warning-ink", "background"],
  ["destructive", "card"], // teks error langsung di atas putih
  ["ink-green", "tint-green"],
  ["ink-pink", "tint-pink"],
  ["ink-lavender", "tint-lavender"],
  ["ink-butter", "tint-butter"],
  ["ink-sky", "tint-sky"],
  ["ink-danger", "tint-danger"],
]

describe("kontras teks (WCAG 1.4.3, minimal 4,5:1)", () => {
  it.each(TEXT_PAIRS)("%s di atas %s", (foreground, background) => {
    expect(
      contrastRatio(token(foreground), token(background))
    ).toBeGreaterThanOrEqual(TEXT_MIN)
  })

  const TINTS = ["green", "pink", "lavender", "butter", "sky", "danger"]
  it.each(TINTS)(
    "teks sekunder (muted-foreground) tetap terbaca di atas tint %s",
    (tint) => {
      expect(
        contrastRatio(token("muted-foreground"), token(`tint-${tint}`))
      ).toBeGreaterThanOrEqual(TEXT_MIN)
    }
  )

  it("state hover yang memakai opasitas juga lolos", () => {
    // Button destructive: bg-destructive/20 di atas permukaan, teks ink-danger.
    for (const surface of ["background", "card"]) {
      const hover = blend(token("destructive"), token(surface), 0.2)
      expect(contrastRatio(token("ink-danger"), hover)).toBeGreaterThanOrEqual(
        TEXT_MIN
      )
    }
  })

  it("token success dan warning bawaan skill TIDAK boleh dipakai sebagai teks", () => {
    // Dicatat agar pengganti `-ink` tidak dihapus: keduanya di bawah 4,5:1 di atas putih.
    expect(contrastRatio(token("success"), token("card"))).toBeLessThan(
      TEXT_MIN
    )
    expect(contrastRatio(token("warning"), token("card"))).toBeLessThan(
      TEXT_MIN
    )
  })
})

describe("kontras non-teks (WCAG 1.4.11, minimal 3:1)", () => {
  it.each(["background", "card", "sidebar", "muted"])(
    "batas kontrol (--input) terlihat di atas %s",
    (surface) => {
      expect(
        contrastRatio(token("input"), token(surface))
      ).toBeGreaterThanOrEqual(NON_TEXT_MIN)
    }
  )

  it.each(["success", "warning", "danger"])(
    "ikon status %s terlihat di atas putih",
    (name) => {
      expect(contrastRatio(token(name), token("card"))).toBeGreaterThanOrEqual(
        NON_TEXT_MIN
      )
    }
  )
})

describe("indikator fokus keyboard (skill: visible focus states)", () => {
  const SURFACES = [
    "background",
    "card",
    "muted",
    "accent",
    "secondary",
    "sidebar",
    "sidebar-accent",
    "tint-green",
    "tint-pink",
    "tint-lavender",
    "tint-butter",
    "tint-sky",
    "tint-danger",
  ]

  it.each(SURFACES)("--ring terlihat di atas %s", (surface) => {
    expect(contrastRatio(token("ring"), token(surface))).toBeGreaterThanOrEqual(
      NON_TEXT_MIN
    )
  })

  it("--sidebar-ring terlihat di atas permukaan sidebar", () => {
    for (const surface of ["sidebar", "sidebar-accent"]) {
      expect(
        contrastRatio(token("sidebar-ring"), token(surface))
      ).toBeGreaterThanOrEqual(NON_TEXT_MIN)
    }
  })

  it("aturan :focus-visible global ada dan tidak bisa dikalahkan outline-none", () => {
    // Harus berada di luar @layer agar menang atas utilitas Tailwind yang berlapis.
    const rule = css.slice(css.lastIndexOf(":focus-visible {"))
    expect(rule).toContain("outline: 2px solid var(--ring)")
    const before = css.slice(0, css.lastIndexOf(":focus-visible {"))
    const openLayers = (before.match(/@layer[^{]*\{/g) ?? []).length
    expect(openLayers).toBeGreaterThan(0) // ada layer lain...
    // ...tetapi aturan fokus ditulis setelah semuanya ditutup (kedalaman kurung nol).
    const depth =
      (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length
    expect(depth).toBe(0)
  })
})

describe("tipografi (skill: 14/16/18/24/32/40)", () => {
  const SCALE_REM = new Set([0.875, 1, 1.125, 1.5, 2, 2.5])
  const themeBlock = css.slice(
    css.indexOf("@theme {"),
    css.indexOf("\n}", css.indexOf("@theme {"))
  )
  const sizes = [
    ...themeBlock.matchAll(/--text-[a-z0-9]+:\s*([\d.]+)rem/g),
  ].map((match) => Number(match[1]))

  it("semua ukuran teks Tailwind dipetakan ke skala skill", () => {
    expect(sizes.length).toBeGreaterThanOrEqual(8)
    for (const size of sizes) expect(SCALE_REM.has(size)).toBe(true)
  })

  it("tidak ada ukuran di bawah 14px", () => {
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0.875)
  })

  const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8")
  const fontToken = (name: string) =>
    css.match(new RegExp(`--font-${name}:\\s*([^;]+);`))?.[1] ?? ""

  it("memuat font ramah (Nunito, Fredoka) dan Space Mono untuk label", () => {
    expect(layout).toContain("Nunito")
    expect(layout).toContain("Fredoka")
    expect(layout).toContain("Space_Mono")
  })

  it("teks isi memakai font sans bulat (Nunito), bukan serif atau font display", () => {
    const sans = fontToken("sans")
    expect(sans).toContain("--font-nunito")
    expect(sans).not.toMatch(/serif-display|fredoka/)
    // Fallback harus sans-serif, bukan serif.
    expect(sans).toMatch(/sans-serif\s*$/)
    expect(sans).not.toMatch(/(?<!sans-)serif/)
  })

  it("judul memakai Fredoka dengan Nunito sebagai cadangan, label memakai Space Mono", () => {
    const heading = fontToken("heading")
    expect(heading).toContain("--font-fredoka")
    expect(heading.indexOf("--font-fredoka")).toBeLessThan(
      heading.indexOf("--font-nunito")
    )
    expect(fontToken("mono")).toContain("--font-space-mono")
  })

  it("tidak memuat font yang tidak dipakai (hemat unduhan)", () => {
    expect(layout).not.toContain("Noto_Serif_Display")
    expect(layout).not.toContain("Atkinson")
  })

  it("teks UI sehari-hari (text-sm) minimal 16px dan teks isi (text-base) minimal 18px", () => {
    const size = (name: string) =>
      Number(
        themeBlock.match(new RegExp(`--text-${name}:\\s*([\\d.]+)rem`))?.[1]
      )
    expect(size("sm")).toBeGreaterThanOrEqual(1)
    expect(size("base")).toBeGreaterThanOrEqual(1.125)
  })
})

describe("kursor penunjuk (elemen yang bisa diklik harus tampak bisa diklik)", () => {
  // Hanya blok @layer base yang berisi aturan kursor.
  const cursorRule = css.match(
    /(button:not\(:disabled\)[^{]*)\{\s*cursor:\s*pointer;\s*\}/
  )?.[1]

  it("ada aturan cursor: pointer untuk tombol, tautan, dan kontrol file", () => {
    expect(cursorRule).toBeDefined()
    for (const selector of [
      "button:not(:disabled)",
      '[role="button"]',
      "a[href]",
      "select:not(:disabled)",
      'input[type="file"]',
    ]) {
      expect(cursorRule).toContain(selector)
    }
  })

  it("elemen nonaktif tidak ikut tampak bisa diklik", () => {
    expect(cursorRule).toContain(":not(:disabled)")
    expect(cursorRule).toContain(':not([aria-disabled="true"])')
  })
})

describe("ukuran target sentuh (WCAG 2.5.8, minimal 24px)", () => {
  const button = readFileSync(
    join(root, "src/components/ui/button.tsx"),
    "utf8"
  )
  const sizeBlock = button.slice(
    button.indexOf("size: {"),
    button.indexOf("defaultVariants")
  )
  const px = (tailwindUnit: string) => Number(tailwindUnit) * 4

  it("semua ukuran tombol setidaknya 32px dan tombol utama 40px", () => {
    // Hanya nilai di awal tiap definisi ukuran (mis. "h-10 ..."), bukan ukuran ikon di dalamnya.
    const heights = [...sizeBlock.matchAll(/"(?:h|size)-(\d+)\b/g)].map((m) =>
      px(m[1])
    )
    expect(heights.length).toBeGreaterThan(0)
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(32)
    expect(sizeBlock).toMatch(/default:\s*"h-10/)
  })
})

describe("radius (skill: sm 4px, md 8px)", () => {
  it("sm = 0.25rem dan md = 0.5rem", () => {
    expect(css).toMatch(/--radius-sm:\s*0\.25rem/)
    expect(css).toMatch(/--radius-md:\s*0\.5rem/)
  })

  it("tidak ada radius theme yang melebihi 8px", () => {
    const radii = [...css.matchAll(/--radius-[a-z0-9]+:\s*([\d.]+)rem/g)].map(
      (match) => Number(match[1])
    )
    expect(radii.length).toBeGreaterThan(0)
    expect(Math.max(...radii)).toBeLessThanOrEqual(0.5)
  })
})
