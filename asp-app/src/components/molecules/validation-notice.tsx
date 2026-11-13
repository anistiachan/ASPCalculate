import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL } from "@/domain/anthropometry/constants"

/**
 * Peringatan wajib di setiap tampilan hasil status gizi selama mesin antropometri belum
 * divalidasi tenaga kesehatan (docs/OPENASP-VALIDASI-ANTROPOMETRI.md, bagian 6).
 */
export function ValidationNotice() {
  if (ANTHROPOMETRY_VALIDATED_BY_HEALTH_PROFESSIONAL) return null
  return (
    <Alert variant="warning" role="note">
      <AlertTitle>Hasil masih dalam tahap uji</AlertTitle>
      <AlertDescription>
        Perhitungan ini belum divalidasi oleh tenaga kesehatan dan tidak boleh
        dipakai untuk keputusan layanan gizi. Pastikan hasil penting
        dikonfirmasi dengan tenaga gizi atau kesehatan yang berwenang.
      </AlertDescription>
    </Alert>
  )
}
