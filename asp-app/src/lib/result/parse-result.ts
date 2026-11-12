/** Hasil parsing nilai mentah dari sumber eksternal. Tidak melempar error. */
export type ParseResult<T> =
  { ok: true; value: T } | { ok: false; reason: string }

export function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value }
}

export function fail<T = never>(reason: string): ParseResult<T> {
  return { ok: false, reason }
}

/** Sel kosong: null, undefined, atau teks yang hanya berisi spasi. */
export function isBlank(raw: unknown): boolean {
  return raw === null || raw === undefined || String(raw).trim() === ""
}
