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
import type { MonthlyRecap } from "@/domain/reporting/monthly-recap"

const ROWS = [
  { key: "yes", label: "Tercatat ya" },
  { key: "no", label: "Tercatat tidak" },
  { key: "unknown", label: "Tidak diisi" },
] as const

/** Hitungan isian Vitamin A. Bukan indikator cakupan: arti kolom di sumber belum dikonfirmasi. */
export function VitaminASummary({ recap }: { recap: MonthlyRecap }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3 className="font-heading text-xl font-semibold">Vitamin A</h3>
        </CardTitle>
        <CardDescription>
          Hitungan isian pada balita terdata yang punya pengukuran bulan ini.
          Ini bukan angka cakupan: arti kolom Vitamin A di sumber (jenis kapsul,
          dosis) belum dikonfirmasi. &quot;Tidak diisi&quot; tidak dianggap
          &quot;tidak&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Isian</TableHead>
              <TableHead className="text-right">Laki-laki</TableHead>
              <TableHead className="text-right">Perempuan</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map(({ key, label }) => (
              <TableRow key={key}>
                <TableCell>{label}</TableCell>
                <TableCell className="text-right font-mono">
                  {recap.vitaminA.M[key]}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {recap.vitaminA.F[key]}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {recap.vitaminA.ALL[key]}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
