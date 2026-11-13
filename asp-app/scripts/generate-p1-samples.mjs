// Membuat samples/contoh-p1-valid.xlsx dan samples/contoh-p1-bermasalah.xlsx dengan mengisi
// template P1. Pembangkitnya berupa tes Vitest (src/test/generate-p1-samples.local.test.ts)
// karena memakai kode TypeScript aplikasi; tes itu dilewati kecuali GENERATE_SAMPLES=1.
//
// Jalankan: npm run samples:generate

import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const vitest = join(root, "node_modules", "vitest", "vitest.mjs")

const result = spawnSync(
  process.execPath,
  [vitest, "run", "src/test/generate-p1-samples.local.test.ts"],
  {
    cwd: root,
    env: { ...process.env, GENERATE_SAMPLES: "1" },
    stdio: "inherit",
  }
)
if (result.status !== 0) process.exit(result.status ?? 1)
console.log("dibuat: samples/contoh-p1-valid.xlsx")
console.log("dibuat: samples/contoh-p1-bermasalah.xlsx")
