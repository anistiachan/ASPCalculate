// Membuat tabel referensi WHO Child Growth Standards 2006 (parameter LMS) untuk mesin antropometri.
//
// Sumber: tabel "expanded tables" yang dipublikasikan WHO di cdn.who.int. Tabel tidak boleh
// diambil dari blog, forum, atau salinan tanpa asal-usul (docs/OPENASP-SPESIFIKASI-ANTROPOMETRI-v0.1.md).
//
// Langkah: unduh → verifikasi SHA-256 → validasi struktur → cocokkan kolom SD yang diterbitkan WHO
// dengan hasil hitung dari L, M, S → tulis JSON ke src/domain/anthropometry/references/who-2006/.
//
// Pakai:
//   node scripts/import-who-tables.mjs                 # mengunduh dari WHO
//   node scripts/import-who-tables.mjs --from <folder> # memakai berkas yang sudah diunduh
//
// Jika WHO mengganti sebuah berkas, hash tidak cocok dan skrip berhenti. Periksa perubahannya,
// perbarui hash di bawah, lalu catat di docs/OPENASP-VALIDASI-ANTROPOMETRI.md.

import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import * as XLSX from "xlsx"

const BASE =
  "https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators"

const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "domain",
  "anthropometry",
  "references",
  "who-2006"
)

/**
 * Spesifikasi tiap indikator: nama kolom kunci, rentang, dan langkah.
 *
 * `adjustedTails`: indikator berbasis berat. WHO menerbitkan kolom SD+4/SD-4 dengan metode
 * penyesuaian di luar ±3 SD (ekstrapolasi linear memakai jarak SD3–SD2), bukan rumus LMS
 * biasa. Panjang/tinggi menurut umur memakai rumus LMS biasa sampai ±4.
 */
const INDICATORS = {
  wfa: {
    keyHeader: "Day",
    keyName: "ageDays",
    start: 0,
    step: 1,
    count: 1857,
    adjustedTails: true,
  },
  lhfa: {
    keyHeader: "Day",
    keyName: "ageDays",
    start: 0,
    step: 1,
    count: 1857,
    adjustedTails: false,
  },
  bfa: {
    keyHeader: "Day",
    keyName: "ageDays",
    start: 0,
    step: 1,
    count: 1857,
    adjustedTails: true,
  },
  wfl: {
    keyHeader: "Length",
    keyName: "lengthCm",
    start: 45,
    step: 0.1,
    count: 651,
    adjustedTails: true,
  },
  wfh: {
    keyHeader: "Height",
    keyName: "heightCm",
    start: 65,
    step: 0.1,
    count: 551,
    adjustedTails: true,
  },
}

const SOURCES = [
  {
    indicator: "wfa",
    sex: "male",
    file: "wfa-boys.xlsx",
    path: "weight-for-age/expanded-tables/wfa-boys-zscore-expanded-tables.xlsx",
    sha256: "b5b4748c6bfa5230e2eddafa1767629c349178b08d457f400b59422b8bfef86c",
  },
  {
    indicator: "wfa",
    sex: "female",
    file: "wfa-girls.xlsx",
    path: "weight-for-age/expanded-tables/wfa-girls-zscore-expanded-tables.xlsx",
    sha256: "ee3ae12cb96c6c5541cdf43665c03ce6c984f877859a183a5f6104eb06a49a6e",
  },
  {
    indicator: "lhfa",
    sex: "male",
    file: "lhfa-boys.xlsx",
    path: "length-height-for-age/expandable-tables/lhfa-boys-zscore-expanded-tables.xlsx",
    sha256: "c4b1c9029ab9751a5f0888e32f35c7c0287a16d361885cf911ecf23b3f7f6b4f",
  },
  {
    indicator: "lhfa",
    sex: "female",
    file: "lhfa-girls.xlsx",
    path: "length-height-for-age/expandable-tables/lhfa-girls-zscore-expanded-tables.xlsx",
    sha256: "6aa2876319449a6b1f4d825848128902114ff53c67b92b86a0c5140846013059",
  },
  {
    indicator: "bfa",
    sex: "male",
    file: "bfa-boys.xlsx",
    path: "body-mass-index-for-age/expanded-tables/bfa-boys-zscore-expanded-tables.xlsx",
    sha256: "58dcb2abea0e04b1c4f8ad3511d05ec1bea03741f230ac127b93f929e4cc6fc8",
  },
  {
    indicator: "bfa",
    sex: "female",
    file: "bfa-girls.xlsx",
    path: "body-mass-index-for-age/expanded-tables/bfa-girls-zscore-expanded-tables.xlsx",
    sha256: "d3817262a383cdd02553b004f1c6110527d30b729c70501d032e71caadc17529",
  },
  {
    indicator: "wfl",
    sex: "male",
    file: "wfl-boys.xlsx",
    path: "weight-for-length-height/expanded-tables/wfl-boys-zscore-expanded-table.xlsx",
    sha256: "1a6e9a002d2692d038161bc6572a10f8b9fa0657163808141d2981a2132c59cc",
  },
  {
    indicator: "wfl",
    sex: "female",
    file: "wfl-girls.xlsx",
    path: "weight-for-length-height/expanded-tables/wfl-girls-zscore-expanded-table.xlsx",
    sha256: "ec116b8e618ad311d34a87231346badf16c75f5c4f82222ec846e05c582bf16a",
  },
  {
    indicator: "wfh",
    sex: "male",
    file: "wfh-boys.xlsx",
    path: "weight-for-length-height/expanded-tables/wfh-boys-zscore-expanded-tables.xlsx",
    sha256: "ed3b590f9c65937a138408b13618f33684bb6406a0c56d6a2ce3fd9053a3f59f",
  },
  {
    indicator: "wfh",
    sex: "female",
    file: "wfh-girls.xlsx",
    path: "weight-for-length-height/expanded-tables/wfh-girls-zscore-expanded-tables.xlsx",
    sha256: "fca340d5f04aa1556ac410b176b65b290e1b9ff467fc854a97f9b54ad94c9b8a",
  },
]

const SD_LEVELS = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
const EXPECTED_HEADER_TAIL = [
  "L",
  "M",
  "S",
  "SD4neg",
  "SD3neg",
  "SD2neg",
  "SD1neg",
  "SD0",
  "SD1",
  "SD2",
  "SD3",
  "SD4",
]

/**
 * Selisih terbesar yang masih dianggap pembulatan: WHO menerbitkan SD dengan 3 desimal,
 * M dengan 4, dan S dengan 5. Selisih lebih besar berarti rumus atau data salah dibaca.
 */
const SD_TOLERANCE = 0.002

function fail(message) {
  console.error(`\nGAGAL: ${message}`)
  process.exit(1)
}

const sha256Of = (bytes) => createHash("sha256").update(bytes).digest("hex")

/** Menghilangkan noise floating point tanpa mengubah digit yang diterbitkan WHO. */
const clean = (value) => Number(value.toPrecision(12))

async function obtainFiles() {
  const fromIndex = process.argv.indexOf("--from")
  if (fromIndex !== -1) {
    const dir = process.argv[fromIndex + 1]
    if (!dir || !existsSync(dir)) fail(`folder --from tidak ditemukan: ${dir}`)
    return { dir, downloaded: false }
  }

  // Folder baru dan kosong: berkas unduhan tidak dicampur dengan kode.
  const dir = mkdtempSync(join(tmpdir(), "who-tables-"))
  for (const source of SOURCES) {
    const url = `${BASE}/${source.path}`
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    })
    if (!response.ok)
      fail(`unduhan ${source.file} gagal: HTTP ${response.status} (${url})`)
    writeFileSync(
      join(dir, source.file),
      Buffer.from(await response.arrayBuffer())
    )
    console.log(`diunduh  ${source.file}`)
  }
  return { dir, downloaded: true }
}

function parseTable(source, spec, bytes) {
  const workbook = XLSX.read(bytes, { type: "buffer" })
  if (workbook.SheetNames.length !== 1) {
    fail(
      `${source.file}: diharapkan 1 sheet, ditemukan ${workbook.SheetNames.length}`
    )
  }
  const rows = XLSX.utils.sheet_to_json(
    workbook.Sheets[workbook.SheetNames[0]],
    {
      header: 1,
      defval: null,
      blankrows: false,
    }
  )

  const expectedHeader = [spec.keyHeader, ...EXPECTED_HEADER_TAIL]
  if (JSON.stringify(rows[0]) !== JSON.stringify(expectedHeader)) {
    fail(
      `${source.file}: header tidak sesuai.\n  diharapkan ${JSON.stringify(expectedHeader)}\n  ditemukan  ${JSON.stringify(rows[0])}`
    )
  }
  const dataRows = rows.slice(1)
  if (dataRows.length !== spec.count) {
    fail(
      `${source.file}: diharapkan ${spec.count} baris, ditemukan ${dataRows.length}`
    )
  }

  const table = { l: [], m: [], s: [] }
  let maxDeviation = 0
  let zeroL = 0

  dataRows.forEach((row, index) => {
    if (
      row.length !== expectedHeader.length ||
      row.some((v) => typeof v !== "number" || !Number.isFinite(v))
    ) {
      fail(`${source.file}: baris ${index + 2} memuat nilai bukan angka`)
    }
    const [key, l, m, s, ...published] = row

    const expectedKey = Math.round((spec.start + index * spec.step) * 10) / 10
    if (Math.abs(key - expectedKey) > 1e-9) {
      fail(
        `${source.file}: kunci baris ${index + 2} = ${key}, diharapkan ${expectedKey}`
      )
    }
    if (m <= 0 || s <= 0)
      fail(`${source.file}: M atau S tidak positif pada baris ${index + 2}`)
    if (l === 0) zeroL++

    // Hitung SD dari L, M, S dan bandingkan dengan SD yang diterbitkan WHO.
    const plainSd = (k) =>
      l === 0 ? m * Math.exp(s * k) : m * Math.pow(1 + l * s * k, 1 / l)
    SD_LEVELS.forEach((k, i) => {
      let computed
      if (spec.adjustedTails && k === 4)
        computed = plainSd(3) + (plainSd(3) - plainSd(2))
      else if (spec.adjustedTails && k === -4)
        computed = plainSd(-3) - (plainSd(-2) - plainSd(-3))
      else computed = plainSd(k)
      const deviation = Math.abs(computed - published[i])
      if (deviation > maxDeviation) maxDeviation = deviation
      if (deviation > SD_TOLERANCE) {
        fail(
          `${source.file}: SD${k} baris ${index + 2}: hitung ${computed.toFixed(4)} ≠ WHO ${published[i]} (selisih ${deviation.toFixed(4)})`
        )
      }
    })

    table.l.push(clean(l))
    table.m.push(clean(m))
    table.s.push(clean(s))
  })

  return { table, maxDeviation, zeroL }
}

async function main() {
  const { dir, downloaded } = await obtainFiles()
  const retrievedAt = new Date().toISOString().slice(0, 10)

  const byIndicator = {}
  const sources = []
  const checks = []

  for (const source of SOURCES) {
    const bytes = readFileSync(join(dir, source.file))
    const hash = sha256Of(bytes)
    if (hash !== source.sha256) {
      fail(
        `${source.file}: hash berbeda dari yang disematkan.\n  disematkan ${source.sha256}\n  sekarang   ${hash}\n` +
          "WHO mungkin mengganti berkas. Periksa perubahannya sebelum memperbarui hash."
      )
    }

    const spec = INDICATORS[source.indicator]
    const { table, maxDeviation, zeroL } = parseTable(source, spec, bytes)
    byIndicator[source.indicator] ??= {}
    byIndicator[source.indicator][source.sex] = table
    sources.push({
      indicator: source.indicator,
      sex: source.sex,
      url: `${BASE}/${source.path}`,
      sha256: hash,
      bytes: bytes.length,
    })
    checks.push({
      file: source.file,
      maxSdDeviation: Number(maxDeviation.toFixed(5)),
      rowsWithLZero: zeroL,
    })
    console.log(
      `valid    ${source.file}  baris=${spec.count}  selisih SD terbesar=${maxDeviation.toFixed(5)}  L=0: ${zeroL}`
    )
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })
  for (const [indicator, spec] of Object.entries(INDICATORS)) {
    const payload = {
      indicator,
      keyName: spec.keyName,
      start: spec.start,
      step: spec.step,
      count: spec.count,
      male: byIndicator[indicator].male,
      female: byIndicator[indicator].female,
    }
    writeFileSync(
      join(OUTPUT_DIR, `${indicator}.json`),
      JSON.stringify(payload) + "\n"
    )
  }

  const metadata = {
    standard: "WHO Child Growth Standards 2006",
    tableType: "Expanded tables (parameter LMS dan nilai SD)",
    retrievedAt,
    importScript: "scripts/import-who-tables.mjs",
    sdToleranceUsed: SD_TOLERANCE,
    tables: Object.fromEntries(
      Object.entries(INDICATORS).map(([indicator, s]) => [
        indicator,
        { keyName: s.keyName, start: s.start, step: s.step, count: s.count },
      ])
    ),
    sources,
    validation: checks,
  }
  writeFileSync(
    join(OUTPUT_DIR, "metadata.json"),
    JSON.stringify(metadata, null, 2) + "\n"
  )

  console.log(
    `\nSelesai. ${downloaded ? "Diunduh dari WHO" : `Dibaca dari ${dir}`}; JSON ditulis ke ${OUTPUT_DIR}`
  )
}

await main()
