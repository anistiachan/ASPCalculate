import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  SKDN_CODES,
  SKDN_LABELS,
  type SkdnMonthly,
} from "@/domain/reporting/skdn"

/** Peringatan wajib selama aturan SKDN belum disetujui pemilik proses/Bidan. */
export function SkdnDraftNotice() {
  return (
    <Alert variant="warning" role="note">
      <AlertTitle>SKDN: draf, belum disetujui Bidan</AlertTitle>
      <AlertDescription>
        Aturan hitung mengikuti rumus workbook ASP Karangtawar 2025 dan belum
        dikonfirmasi pemilik proses. Jangan dipakai sebagai laporan resmi.
      </AlertDescription>
    </Alert>
  )
}

/** Rekap SKDN draf satu bulan, menurut jenis kelamin. */
export function SkdnSummary({ skdn }: { skdn: SkdnMonthly }) {
  return (
    <section aria-labelledby="skdn-heading" className="space-y-3">
      <h2 id="skdn-heading" className="font-heading text-2xl font-semibold">
        SKDN (draf)
      </h2>
      <SkdnDraftNotice />
      <Card>
        <CardHeader>
          <CardTitle>
            <h3 className="font-heading text-xl font-semibold">
              Penimbangan dan kenaikan berat badan
            </h3>
          </CardTitle>
          <CardDescription>
            Dihitung dari seluruh riwayat penimbangan di perangkat ini. Anak
            yang ditimbang lebih dari sekali dalam sebulan memakai penimbangan
            terakhir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Laki-laki
                </TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Perempuan
                </TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-semibold">S</TableCell>
                <TableCell className="whitespace-normal">
                  Sasaran: sumbernya belum ditemukan, tidak dihitung
                </TableCell>
                <TableCell className="hidden text-right font-mono md:table-cell">
                  –
                </TableCell>
                <TableCell className="hidden text-right font-mono md:table-cell">
                  –
                </TableCell>
                <TableCell className="text-right font-mono">–</TableCell>
              </TableRow>
              {SKDN_CODES.map((code) => {
                const counts = skdn.counts[code]
                const { code: shown, label } = SKDN_LABELS[code]
                return (
                  <TableRow key={code}>
                    <TableCell className="font-semibold">{shown}</TableCell>
                    <TableCell className="whitespace-normal">{label}</TableCell>
                    <TableCell className="hidden text-right font-mono md:table-cell">
                      {counts.M}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono md:table-cell">
                      {counts.F}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {counts.ALL}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  )
}
