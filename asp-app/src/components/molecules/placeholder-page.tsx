import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { NavItem } from "@/lib/constants/navigation"

type PlaceholderPageProps = {
  item: NavItem
}

/** Isi sementara halaman yang belum diimplementasikan (Phase 0). */
export function PlaceholderPage({ item }: PlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Belum tersedia
            <Badge variant="secondary">{item.plannedPhase}</Badge>
          </CardTitle>
          <CardDescription>{item.description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Halaman ini masih placeholder. Fiturnya direncanakan pada{" "}
          {item.plannedPhase}.
        </CardContent>
      </Card>
    </div>
  )
}
