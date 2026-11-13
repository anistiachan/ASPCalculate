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
import type { MonthlyRecap, SexCounts } from "@/domain/reporting/monthly-recap"
import { formatPercent } from "@/lib/format/format"

function CountRow({ label, counts }: { label: string; counts: SexCounts }) {
  return (
    <TableRow>
      <TableCell className="whitespace-normal">{label}</TableCell>
      <TableCell className="text-right font-mono">{counts.M}</TableCell>
      <TableCell className="text-right font-mono">{counts.F}</TableCell>
      <TableCell className="text-right font-mono font-semibold">
        {counts.ALL}
      </TableCell>
    </TableRow>
  )
}

/** Cakupan penimbangan bulan itu menurut jenis kelamin. */
export function CoverageSummary({ recap }: { recap: MonthlyRecap }) {
  const percent = (group: keyof SexCounts) =>
    formatPercent(recap.weighed[group], recap.eligible[group])

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="font-heading text-xl font-semibold">
            Cakupan penimbangan
          </h3>
        </CardTitle>
        <CardDescription>
          Balita terdata adalah anak yang sudah lahir dan belum berumur 60 bulan
          pada awal bulan. Anak yang ditimbang lebih dari sekali dalam sebulan
          dihitung sekali.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keterangan</TableHead>
              <TableHead className="text-right">Laki-laki</TableHead>
              <TableHead className="text-right">Perempuan</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <CountRow label="Balita terdata" counts={recap.eligible} />
            <CountRow label="Ditimbang (ada berat)" counts={recap.weighed} />
            <CountRow
              label="Diukur panjang/tinggi"
              counts={recap.heightMeasured}
            />
            <TableRow>
              <TableCell className="whitespace-normal">
                Persen ditimbang (ditimbang ÷ terdata)
              </TableCell>
              <TableCell className="text-right font-mono">
                {percent("M")}
              </TableCell>
              <TableCell className="text-right font-mono">
                {percent("F")}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {percent("ALL")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
