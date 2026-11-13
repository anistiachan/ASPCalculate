import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

/**
 * Menjelaskan cara angka dihitung dan apa yang BELUM tersedia. Indikator program yang
 * definisinya belum ditetapkan (SKDN dan lainnya) sengaja tidak ditebak.
 */
export function DefinitionsNotice() {
  return (
    <Alert>
      <AlertTitle>Cara membaca laporan ini</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Balita terdata</strong> adalah anak di aplikasi ini yang
            sudah lahir dan belum berumur 60 bulan pada awal bulan.
          </li>
          <li>
            Anak yang diukur lebih dari sekali dalam sebulan dihitung sekali.
            Status gizi memakai pengukuran terakhir bulan itu yang berisi angka.
          </li>
          <li>
            Persen status gizi dihitung dari anak yang <strong>dinilai</strong>,
            bukan dari semua balita terdata.
          </li>
        </ul>
        <p className="mt-3 font-semibold">Belum tersedia:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            SKDN (S, K, D, N): definisinya belum ditetapkan pemilik program,
            sehingga tidak ditebak. Yang tampil di sini adalah angka dasarnya
            (terdata dan ditimbang).
          </li>
          <li>
            ASI eksklusif, kelas ibu balita, dan MBG: arti kolom di sumber belum
            dikonfirmasi.
          </li>
          <li>Rekap per Posyandu: data belum memuat nama Posyandu.</li>
          <li>Pemantauan kenaikan berat badan antar bulan.</li>
        </ul>
      </AlertDescription>
    </Alert>
  )
}
