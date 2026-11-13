import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { readWorkbook } from "@/infrastructure/excel/workbook-reader"
import {
  indexMeasurementsByChild,
  type SexGroup,
} from "@/domain/reporting/monthly-recap"
import { buildSkdn, SKDN_CODES, type SkdnCode } from "@/domain/reporting/skdn"

import { planImport } from "../../services/plan-import"
import { validateBatch } from "../../validators/validate-batch"
import { karangtawarAdapter } from "./karangtawar-adapter"

/*
 * Pembandingan LOKAL dengan workbook asli. Dilewati bila variabel lingkungan tidak ada,
 * sehingga tidak berjalan di CI dan repository tidak memuat data nyata.
 *
 *   KARANGTAWAR_SLIM     = berkas ringkas hasil `npm run karangtawar:slim`
 *   KARANGTAWAR_EXPECTED = JSON angka agregat sheet SKDN: { kode: { M|F|ALL: [12 bulan] } }
 *   KARANGTAWAR_YEAR     = tahun data (bawaan 2025)
 */
const slim = process.env.KARANGTAWAR_SLIM
const expectedPath = process.env.KARANGTAWAR_EXPECTED
const year = Number(process.env.KARANGTAWAR_YEAR ?? 2025)

describe.skipIf(!slim || !expectedPath)(
  "SKDN OpenASP vs workbook Karangtawar (lokal)",
  () => {
    it("menghitung ulang angka sheet SKDN", () => {
      const workbook = readWorkbook(readFileSync(slim!))
      const validated = validateBatch(
        karangtawarAdapter.parse(workbook, "karangtawar-ringkas.xlsx")
      )
      let counter = 0
      const plan = planImport(
        validated,
        { children: [], measurements: [] },
        {
          batchId: "b",
          now: "2026-01-01T00:00:00.000Z",
          newId: () => `id${++counter}`,
        }
      )
      const byChild = indexMeasurementsByChild(plan.newMeasurements)

      const expected = JSON.parse(
        readFileSync(expectedPath!, "utf8")
      ) as Record<SkdnCode, Record<SexGroup, number[]>>

      const rows: string[] = []
      let mismatches = 0
      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, "0")}`
        const actual = buildSkdn(month, plan.newChildren, byChild, {
          workbookParity: true,
        })
        const cells = SKDN_CODES.map((code) => {
          // Laki-laki, perempuan, dan jumlah dibandingkan sekaligus.
          const diffs = (["M", "F", "ALL"] as const).flatMap((group) => {
            const want = expected[code][group][m - 1]
            const got = actual.counts[code][group]
            return want === got ? [] : [`${group}:${got}≠${want}`]
          })
          // Selisih yang sudah dipahami: rumus K bulan November di workbook memakai umur bulan
          // September (sel CS menunjuk BJ, seharusnya BP), sehingga tidak ditiru.
          const knownWorkbookBug = code === "K" && m === 11
          if (!knownWorkbookBug) mismatches += diffs.length
          return `${code}:${actual.counts[code].ALL}${diffs.length ? `[${diffs.join(",")}]` : ""}`
        })
        rows.push(`${month}  ${cells.join("  ")}`)
      }
      const byCode: Record<string, number> = {}
      for (const issue of validated.issues) {
        const key = `${issue.severity}:${issue.code}:${issue.field ?? "-"}`
        byCode[key] = (byCode[key] ?? 0) + 1
      }
      // Laporan dimasukkan ke pesan kegagalan karena keluaran konsol disembunyikan saat lolos.
      const report =
        `\nMasalah: ${JSON.stringify(byCode)}\n` +
        `anak=${plan.newChildren.length} pengukuran=${plan.newMeasurements.length} ` +
        `error=${validated.counts.errors} peringatan=${validated.counts.warnings}\n` +
        rows.join("\n") +
        `\nSelisih: ${mismatches}`
      expect(plan.newChildren.length, report).toBeGreaterThan(0)
      expect(mismatches, report).toBe(0)
    })
  }
)
