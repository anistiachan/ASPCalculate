import { BackLink } from "@/components/molecules/back-link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type NotFoundCardProps = {
  title: string
  description: string
}

/** Ditampilkan saat data yang diminta tidak ada di penyimpanan perangkat ini. */
export function NotFoundCard({ title, description }: NotFoundCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <BackLink href="/children">Kembali ke daftar balita</BackLink>
      </CardContent>
    </Card>
  )
}
