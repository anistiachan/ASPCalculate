import type { LmsTable, ReferenceMetadata, ReferenceSet } from "./reference"

let cached: Promise<ReferenceSet> | null = null

/**
 * Memuat tabel referensi WHO 2006 secara lazy (sekitar 300 KB) agar tidak masuk bundle awal.
 * Hasilnya di-cache. Tabel dihasilkan oleh scripts/import-who-tables.mjs dari tabel resmi WHO;
 * jangan mengubah JSON-nya dengan tangan.
 */
export function loadWho2006References(): Promise<ReferenceSet> {
  cached ??= (async () => {
    const [wfa, lhfa, bfa, wfl, wfh, metadata] = await Promise.all([
      import("./who-2006/wfa.json"),
      import("./who-2006/lhfa.json"),
      import("./who-2006/bfa.json"),
      import("./who-2006/wfl.json"),
      import("./who-2006/wfh.json"),
      import("./who-2006/metadata.json"),
    ])
    return {
      wfa: wfa.default as LmsTable,
      lhfa: lhfa.default as LmsTable,
      bfa: bfa.default as LmsTable,
      wfl: wfl.default as LmsTable,
      wfh: wfh.default as LmsTable,
      metadata: metadata.default as ReferenceMetadata,
    }
  })()
  return cached
}
