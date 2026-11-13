/** Menyimpan byte sebagai berkas unduhan di browser tanpa mengirimnya ke server. */
export function downloadBytes(
  fileName: string,
  bytes: Uint8Array,
  mimeType: string
): void {
  const blob = new Blob([bytes as BlobPart], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  // Dilepas setelah klik diproses agar unduhan tidak batal.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
