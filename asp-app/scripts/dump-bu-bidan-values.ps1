# Membuang NILAI sel (hasil rumus, bukan rumusnya) sheet bulanan dan 'Tambah Balita' workbook Bu Bidan ke
# berkas JSON, lewat Excel. Dipakai untuk verifikasi LOKAL rumus z-score
# (src/test/bu-bidan-zscore-compare.local.test.ts). Perlu lewat Excel karena berkas hasil yang disimpan Excel
# bisa terproteksi (label sensitivitas) sehingga tidak terbaca pustaka lain.
#
#   powershell -File scripts\dump-bu-bidan-values.ps1 -Workbook "<berkas.xlsx>" -Output "<nilai.json>"
#
# JSON berisi data pribadi anak. Simpan di luar repositori dan hapus setelah dipakai.
# Skrip sengaja hanya memakai karakter ASCII agar aman di Windows PowerShell 5.1.

param(
  [Parameter(Mandatory = $true)][string]$Workbook,
  [Parameter(Mandatory = $true)][string]$Output
)

$ErrorActionPreference = 'Stop'
$Workbook = (Resolve-Path -LiteralPath $Workbook).Path
$Output = if ([System.IO.Path]::IsPathRooted($Output)) { $Output } else { Join-Path (Get-Location).Path $Output }

$names = @('Tambah Balita', 'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER')

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$wb = $null
try {
  $wb = $xl.Workbooks.Open($Workbook, 0, $true)
  $result = [ordered]@{}
  foreach ($name in $names) {
    $ws = $wb.Worksheets.Item($name)
    $used = $ws.UsedRange
    $values = $used.Value2
    $rows = $used.Rows.Count
    $cols = $used.Columns.Count
    $list = New-Object System.Collections.ArrayList
    for ($r = 1; $r -le $rows; $r++) {
      $line = New-Object System.Collections.ArrayList
      for ($c = 1; $c -le $cols; $c++) {
        $cell = $values[$r, $c]
        [void]$line.Add($cell)
      }
      [void]$list.Add($line.ToArray())
    }
    # Baris pertama UsedRange bisa bukan baris 1 sheet; simpan awalnya agar nomor baris benar.
    $result[$name] = [ordered]@{ firstRow = $used.Row; firstCol = $used.Column; rows = $list.ToArray() }
  }
  $json = $result | ConvertTo-Json -Depth 6 -Compress
  [System.IO.File]::WriteAllText($Output, $json, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host ('Nilai sel dibuang ke: ' + $Output)
}
finally {
  if ($wb -ne $null) { $wb.Close($false) }
  $xl.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}
