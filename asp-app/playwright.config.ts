import { defineConfig } from "@playwright/test"

/**
 * Tes end-to-end memakai browser Edge yang sudah ada di Windows (tidak mengunduh
 * browser). Jalankan `npm run build` dulu: server yang diuji adalah hasil build produksi.
 */
// Port bisa diganti dengan E2E_PORT bila bentrok dengan aplikasi lain.
const PORT = Number(process.env.E2E_PORT ?? 3217)

export default defineConfig({
  testDir: "tests/e2e",
  // Setiap tes memakai konteks browser baru, jadi IndexedDB-nya terisolasi.
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "msedge",
    locale: "id-ID",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/dashboard`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
