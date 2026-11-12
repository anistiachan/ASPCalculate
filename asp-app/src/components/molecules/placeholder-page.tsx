import { PageHeader } from "@/components/molecules/page-header"
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

/** Isi sementara halaman yang belum diimplementasikan. */
export function PlaceholderPage({ item }: PlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <PageHeader item={item} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Belum tersedia
            <Badge variant="warning">{item.plannedPhase}</Badge>
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
