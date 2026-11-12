import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import type { ImportIssue } from "../types"

/** Batas baris yang ditampilkan agar halaman tetap ringan pada file besar. */
const MAX_VISIBLE_ISSUES = 200

type ImportIssueListProps = {
  issues: readonly ImportIssue[]
}

export function ImportIssueList({ issues }: ImportIssueListProps) {
  if (issues.length === 0) return null

  // Error ditampilkan lebih dulu; urutan asli dipertahankan di dalam tiap kelompok.
  const sorted = [
    ...issues.filter((issue) => issue.severity === "error"),
    ...issues.filter((issue) => issue.severity === "warning"),
  ]
  const visible = sorted.slice(0, MAX_VISIBLE_ISSUES)
  const hidden = sorted.length - visible.length

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Tingkat</TableHead>
            <TableHead>Sheet</TableHead>
            <TableHead className="w-16">Baris</TableHead>
            <TableHead>Keterangan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((issue, index) => (
            <TableRow key={index}>
              <TableCell>
                <Badge
                  variant={
                    issue.severity === "error" ? "destructive" : "warning"
                  }
                >
                  {issue.severity === "error" ? "Error" : "Peringatan"}
                </Badge>
              </TableCell>
              <TableCell>{issue.sheet}</TableCell>
              <TableCell className="font-mono">{issue.row ?? "–"}</TableCell>
              <TableCell className="whitespace-normal">
                {issue.message}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hidden > 0 && (
        <p className="text-sm text-muted-foreground">
          …dan {hidden} catatan lainnya tidak ditampilkan.
        </p>
      )}
    </div>
  )
}
