import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TONE_CLASSES, type Tone } from "@/lib/constants/tones"

type StatCardProps = {
  label: string
  value: number
  /** Keterangan kecil di bawah angka, mis. persentase atau pembanding. */
  hint?: string
  tone?: Tone
}

/**
 * Kartu angka. Warna hanya mempertegas; makna dibawa label teks, sehingga tetap terbaca
 * tanpa warna. Angka besar memakai angka proporsional (bukan tabular): `tabular-nums`
 * membuat angka besar tampak renggang dan hanya cocok untuk kolom yang harus sejajar.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: StatCardProps) {
  return (
    <Card size="sm" className={TONE_CLASSES[tone].panel}>
      <CardHeader>
        <CardDescription className="label-caps text-current">
          {label}
        </CardDescription>
        {/* Varian group-data-[size=sm] diperlukan: CardTitle punya aturan ukuran sendiri untuk kartu kecil. */}
        <CardTitle className="font-heading text-3xl font-semibold group-data-[size=sm]/card:text-3xl">
          {value}
        </CardTitle>
        {hint && <p className="text-sm text-current">{hint}</p>}
      </CardHeader>
    </Card>
  )
}
