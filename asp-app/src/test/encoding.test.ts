import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { describe, expect, it } from "vitest"

/**
 * Menjaga berkas sumber tetap UTF-8 bersih. Windows PowerShell 5.1 membaca berkas tanpa
 * `-Encoding` sebagai ANSI lalu `Set-Content -Encoding utf8` menulisnya dengan BOM, yang
 * mengubah karakter seperti "–" menjadi "â€“" dan bisa lolos ke layar pengguna tanpa
 * ketahuan oleh tes lain. Ubah berkas dengan alat penyunting, bukan Get/Set-Content.
 */

const root = process.cwd()
const SOURCE_DIRS = ["src", "tests", "scripts"]
const EXTENSIONS = /\.(ts|tsx|css|mjs|json|md)$/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

// Berkas ini dikecualikan karena memuat pola mojibake sebagai teks pencarian.
const files = SOURCE_DIRS.flatMap((dir) => walk(join(root, dir))).filter(
  (f) => EXTENSIONS.test(f) && !f.endsWith("encoding.test.ts")
)

// Awalan khas teks UTF-8 yang terbaca sebagai Windows-1252: "â€" (– — … • “ ”), "Â" + simbol.
const MOJIBAKE = /â€|Â[ -¿]|Ã[\u0080-¿]/

describe("encoding berkas sumber", () => {
  it("memindai berkas dalam jumlah yang masuk akal", () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it.each(files.map((f) => [relative(root, f), f]))(
    "%s: UTF-8 tanpa BOM dan tanpa mojibake",
    (_name, file) => {
      const bytes = readFileSync(file)
      const hasBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
      expect(hasBom, "berkas memuat BOM").toBe(false)

      const text = bytes.toString("utf8")
      expect(text.includes("�"), "berkas memuat karakter pengganti").toBe(false)
      const found = text.match(MOJIBAKE)
      expect(found, `kemungkinan mojibake: ${found?.[0]}`).toBeNull()
    }
  )
})
