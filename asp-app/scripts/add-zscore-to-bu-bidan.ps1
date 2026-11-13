# Menambahkan kolom z-score dan status gizi (seperti sheet PSG) ke workbook Bu Bidan, lengkap dengan
# RUMUS Excel yang terisi otomatis dari tanggal ukur, BB, TB, jenis kelamin, dan tanggal lahir.
#
# Cara pakai (butuh Excel terpasang di Windows):
#   powershell -File scripts\add-zscore-to-bu-bidan.ps1 -Source "docs\BU BIDAN_....xls" -Output "docs\BU BIDAN_... (Z-SCORE).xlsx"
#
# - Berkas sumber TIDAK diubah: Excel menyimpannya sebagai berkas baru (.xlsx) lalu berkas baru itu diubah.
# - Rumus meniru mesin antropometri OpenASP (src/domain/anthropometry): umur dalam hari, koreksi posisi
#   ukur +/-0,7 cm, tabel WHO 2006 per hari dan per 0,1 cm, serta penyesuaian WHO di luar +/-3 SD untuk
#   BB/U dan BB/TB. Kategori mengikuti Permenkes 2/2020.
# - Tabel WHO dimuat dari berkas JSON di repositori ke sheet WHO_LHFA, WHO_WFA, WHO_WFL, WHO_WFH.
# - Jenis kelamin diambil dari sheet 'Tambah Balita' (lewat NIK) atau diketik langsung di kolom JK.
#   Tanggal lahir diambil dari kolom TANGGAL LAHIR sheet itu sendiri, atau dari 'Tambah Balita'.
# - Skrip ini tidak memuat data anak. Berkas asli dan hasilnya memuat data pribadi: jangan di-commit.
#
# Catatan: skrip sengaja hanya memakai karakter ASCII agar aman di Windows PowerShell 5.1.

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$Output,
  [int]$LastRow = 300,
  # Izinkan menimpa berkas hasil yang sudah ada. Tanpa ini skrip berhenti agar tidak menimpa berkas lain.
  [switch]$Overwrite
)

$ErrorActionPreference = 'Stop'

$Source = (Resolve-Path -LiteralPath $Source).Path
$Output = if ([System.IO.Path]::IsPathRooted($Output)) { $Output } else { Join-Path (Get-Location).Path $Output }
$Output = [System.IO.Path]::GetFullPath($Output)
if ($Source -eq $Output) { throw 'Berkas hasil harus berbeda dari berkas sumber.' }
if (Test-Path -LiteralPath $Output) {
  if (-not $Overwrite) { throw "Berkas hasil sudah ada: $Output (tambahkan -Overwrite untuk menimpa)." }
  # Dihapus dulu: Excel kadang gagal menimpa berkas .xlsx yang ada saat 'Simpan Sebagai'.
  Remove-Item -LiteralPath $Output -Force
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$whoDir = Join-Path $repoRoot 'src\domain\anthropometry\references\who-2006'

$MonthSheets = @('JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER')
$ChildrenSheet = 'Tambah Balita'
$ChildrenLastRow = 2000

# --- Utilitas -----------------------------------------------------------------------------------

function ColName([int]$n) {
  $s = ''
  while ($n -gt 0) {
    $r = ($n - 1) % 26
    $s = ([string][char](65 + $r)) + $s
    $n = [math]::Floor(($n - 1) / 26)
  }
  return $s
}

function RGBColor([int]$r, [int]$g, [int]$b) { return $r + ($g * 256) + ($b * 65536) }

# Tanggal dari sel: angka (tanggal Excel) atau teks "2026-01-07", "11-05-2026", "11/05/2026", atau
# teks bentuk JavaScript "Thu Jun 11 2026 00:00:00 GMT+0700 (...)".
function F-Clean([string]$ref) {
  # TRIM Excel hanya membuang spasi biasa; spasi tak terputus (kode 160) ikut dibuang di sini.
  return 'TRIM(SUBSTITUTE(' + $ref + ',CHAR(160),""))'
}

function F-Date([string]$ref) {
  $t = F-Clean $ref
  $tpl = 'IF(ISNUMBER({r}),INT({r}),IF({t}="","",IFERROR(IF(MID({t},5,1)="-",DATE(VALUE(LEFT({t},4)),VALUE(MID({t},6,2)),VALUE(MID({t},9,2))),IF(OR(MID({t},3,1)="-",MID({t},3,1)="/"),DATE(VALUE(MID({t},7,4)),VALUE(MID({t},4,2)),VALUE(LEFT({t},2))),IF(MID({t},4,1)=" ",DATE(VALUE(MID({t},12,4)),MATCH(MID({t},5,3),{"Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"},0),VALUE(MID({t},9,2))),""))),"")))'
  return $tpl.Replace('{r}', $ref).Replace('{t}', $t)
}

# Angka dari sel: angka asli, atau teks dengan koma/titik desimal ("17,2" atau "17.2"), tidak
# bergantung pada pengaturan bahasa Excel. Hanya nilai lebih dari nol yang dipakai.
function F-Number([string]$ref) {
  $c = F-Clean $ref
  $p = 'IF(ISNUMBER({r}),{r},IF({c}="","",NUMBERVALUE(SUBSTITUTE({c},",","."),"."," ")))'.Replace('{r}', $ref).Replace('{c}', $c)
  return 'IFERROR(IF(N(' + $p + ')>0,' + $p + ',""),"")'
}

# Z-score berbasis berat dengan penyesuaian WHO di luar +/-3 SD (sama dengan lmsZScoreAdjusted).
function F-ZAdjusted([string]$zm, [string]$y, [string]$L, [string]$M, [string]$S) {
  $tpl = 'IF({zm}="","",ROUND(IF({zm}>3,3+({y}-{M}*(1+{L}*{S}*3)^(1/{L}))/({M}*(1+{L}*{S}*3)^(1/{L})-{M}*(1+{L}*{S}*2)^(1/{L})),IF({zm}<-3,-3+({y}-{M}*(1-{L}*{S}*3)^(1/{L}))/({M}*(1-{L}*{S}*2)^(1/{L})-{M}*(1-{L}*{S}*3)^(1/{L})),{zm})),2))'
  return $tpl.Replace('{zm}', $zm).Replace('{y}', $y).Replace('{L}', $L).Replace('{M}', $M).Replace('{S}', $S)
}

# --- Mulai Excel --------------------------------------------------------------------------------

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
$wb = $null

try {
  $wb = $xl.Workbooks.Open($Source)
  # Simpan sebagai berkas baru (.xlsx): sumber tidak disentuh, dan batas rumus .xls tidak berlaku.
  $wb.SaveAs($Output, 51)
  # Buka ulang berkas .xlsx baru: selama masih terbuka dari .xls, Excel tetap memakai batas baris/kolom lama
  # dan menolak menyalin sheet referensi.
  $wb.Close($false)
  $wb = $xl.Workbooks.Open($Output)
  $xl.ScreenUpdating = $false
  $xl.Calculation = -4135   # manual selama menulis rumus

  # --- Sheet referensi WHO ----------------------------------------------------------------------
  # Tabel WHO dibuat Node sebagai berkas kecil, lalu sheet-nya disalin ke workbook hasil
  # (lebih andal daripada mengisi ribuan sel sekaligus lewat COM).
  $missing = [System.Reflection.Missing]::Value
  $whoTemp = Join-Path ([System.IO.Path]::GetTempPath()) ('who-ref-' + [guid]::NewGuid().ToString('N') + '.xlsx')
  & node (Join-Path $PSScriptRoot 'build-who-reference-workbook.mjs') $whoTemp | Out-Null
  if (-not (Test-Path -LiteralPath $whoTemp)) { throw 'Gagal membuat berkas referensi WHO (butuh Node.js di PATH).' }
  $whoBook = $xl.Workbooks.Open($whoTemp, 0, $true)
  $whoRows = @{}
  try {
    foreach ($sn in @('WHO_LHFA', 'WHO_WFA', 'WHO_WFL', 'WHO_WFH')) {
      $sheet = $whoBook.Worksheets.Item($sn)
      $whoRows[$sn] = $sheet.UsedRange.Rows.Count - 1
      $sheet.Copy($missing, $wb.Worksheets.Item($wb.Worksheets.Count))
      $copied = $wb.Worksheets.Item($wb.Worksheets.Count)
      $copied.Range('A1:G1').Font.Bold = $true
      $copied.Tab.Color = (RGBColor 150 150 150)
    }
  } finally {
    $whoBook.Close($false)
    Remove-Item -LiteralPath $whoTemp -Force -ErrorAction SilentlyContinue
  }
  $rLhfa = 'WHO_LHFA!$B$2:$G$' + ($whoRows['WHO_LHFA'] + 1)
  $rWfa = 'WHO_WFA!$B$2:$G$' + ($whoRows['WHO_WFA'] + 1)
  $rWfl = 'WHO_WFL!$B$2:$G$' + ($whoRows['WHO_WFL'] + 1)
  $rWfh = 'WHO_WFH!$B$2:$G$' + ($whoRows['WHO_WFH'] + 1)

  # --- Sheet 'Tambah Balita': kolom bantu NIK sebagai teks ---------------------------------------
  $tb = $wb.Worksheets.Item($ChildrenSheet)
  $tbHeaderRow = 2
  $tbLastCol = $tb.Cells.Item($tbHeaderRow, $tb.Columns.Count).End(-4159).Column
  $tbCols = @{}
  for ($c = 1; $c -le $tbLastCol; $c++) {
    $h = [string]$tb.Cells.Item($tbHeaderRow, $c).Value2
    if ($h) { $tbCols[$h.Trim().ToLower()] = $c }
  }
  foreach ($need in @('nik', 'tgl_lahir', 'jenis_kelamin')) {
    if (-not $tbCols.ContainsKey($need)) { throw "Kolom '$need' tidak ditemukan di sheet '$ChildrenSheet' (baris header 2)." }
  }
  $tbHelper = $tbLastCol + 1
  $tb.Cells.Item($tbHeaderRow, $tbHelper).Value2 = 'bantu_nik_teks'
  $nikL = ColName $tbCols['nik']
  $tbHelperRange = $tb.Range($tb.Cells.Item(3, $tbHelper), $tb.Cells.Item($ChildrenLastRow, $tbHelper))
  $tbHelperRange.NumberFormat = 'General'   # format Teks akan menyimpan rumus sebagai teks
  $tbHelperRange.Formula = '=IF(' + $nikL + '3="","",TRIM(SUBSTITUTE(' + $nikL + '3&"",CHAR(160),"")))'
  $tb.Columns.Item($tbHelper).Hidden = $true
  $q = "'" + $ChildrenSheet + "'"
  $hl = ColName $tbHelper
  $rNik = $q + '!$' + $hl + '$3:$' + $hl + '$' + $ChildrenLastRow
  $lahirL = ColName $tbCols['tgl_lahir']
  $rLahir = $q + '!$' + $lahirL + '$3:$' + $lahirL + '$' + $ChildrenLastRow
  $jkL = ColName $tbCols['jenis_kelamin']
  $rJk = $q + '!$' + $jkL + '$3:$' + $jkL + '$' + $ChildrenLastRow

  # --- Sheet petunjuk ---------------------------------------------------------------------------
  $guide = $wb.Worksheets.Add($missing, $tb)
  $guide.Name = 'PETUNJUK_ZSCORE'
  $guideLines = @(
    'Kolom z-score dan status gizi (seperti sheet PSG)',
    '',
    'Cara kerja',
    "1. Isi TANGGALUKUR, BERAT, TINGGI, dan CARAUKUR seperti biasa pada sheet bulan.",
    "2. Jenis kelamin (JK) dan tanggal lahir diambil dari sheet 'Tambah Balita' lewat NIK. Isi kolom NIK, tgl_lahir, dan jenis_kelamin (Laki-laki/Perempuan atau L/P) di sana untuk setiap anak.",
    "3. JK juga boleh diketik langsung (L atau P) pada sheet bulan bila anak belum ada di 'Tambah Balita'. Mengetik menimpa rumus pencarian.",
    "4. Pada sheet MEI sampai SEPTEMBER tanggal lahir diambil dari kolom TANGGAL LAHIR; pada sheet lain dari 'Tambah Balita'.",
    '5. Z TB/U, Z BB/U, Z BB/TB, status, dan STUNTING? terisi otomatis. STUNTING? = YA bila TB/U di bawah -2 SD (pendek atau sangat pendek).',
    '6. Bila belum bisa dihitung, kolom STUNTING? menjelaskan apa yang kurang (mis. isi JK, isi tgl lahir, isi TB).',
    '',
    'Aturan perhitungan',
    '- WHO Child Growth Standards 2006 dan Permenkes 2/2020, sama dengan aplikasi OpenASP (umur dalam hari; tabel ada di sheet WHO_*).',
    '- TB dikoreksi menurut CARAUKUR: berdiri di bawah 731 hari ditambah 0,7 cm; terlentang 731 hari ke atas dikurangi 0,7 cm.',
    '- Z-score hanya dihitung untuk umur di bawah 60 bulan.',
    '- Tanggal ukur boleh berbentuk 2026-01-07, 11-05-2026, atau tanggal Excel. Angka boleh memakai koma atau titik desimal.',
    '',
    'Catatan penting',
    '- Hasil ini belum divalidasi tenaga kesehatan dan tidak boleh dipakai untuk keputusan layanan gizi.',
    '- Jangan mengubah sheet WHO_* dan kolom berawalan bantu_ (tersembunyi).',
    '- Rumus disiapkan sampai baris 300 pada setiap sheet bulan.',
    '- Berkas ini memuat data pribadi anak. Simpan dan bagikan hanya kepada petugas yang berkepentingan.'
  )
  for ($i = 0; $i -lt $guideLines.Count; $i++) {
    $guide.Cells.Item($i + 1, 1).Value2 = $guideLines[$i]
  }
  $guide.Columns.Item(1).ColumnWidth = 140
  $guide.Columns.Item(1).WrapText = $true
  $guide.Range('A1').Font.Bold = $true
  $guide.Range('A1').Font.Size = 14
  foreach ($boldRow in @(3, 11, 17)) { $guide.Cells.Item($boldRow, 1).Font.Bold = $true }

  # --- Sheet bulanan ----------------------------------------------------------------------------
  $report = @()
  foreach ($name in $MonthSheets) {
    $ws = $wb.Worksheets.Item($name)
    $lastCol = $ws.Cells.Item(1, $ws.Columns.Count).End(-4159).Column
    $src = @{}
    for ($c = 1; $c -le $lastCol; $c++) {
      $h = [string]$ws.Cells.Item(1, $c).Value2
      if ($h) { $src[$h.Trim().ToUpper()] = $c }
    }
    foreach ($need in @('NIK', 'TANGGALUKUR', 'BERAT', 'TINGGI', 'CARAUKUR')) {
      if (-not $src.ContainsKey($need)) { throw "Kolom '$need' tidak ditemukan di sheet '$name'." }
    }
    $hasOwnBirth = $src.ContainsKey('TANGGAL LAHIR')

    # 9 kolom baru tepat setelah TINGGI.
    $visibleKeys = @('jk', 'umur', 'ztb', 'zbb', 'zbt', 'stb', 'sbb', 'sbt', 'stunt')
    $firstNew = $src['TINGGI'] + 1
    $ws.Range($ws.Cells.Item(1, $firstNew), $ws.Cells.Item(1, $firstNew + 8)).EntireColumn.Insert() | Out-Null

    $L = @{}   # kunci -> huruf kolom
    $L['nik'] = ColName $src['NIK']
    $L['ukur'] = ColName $src['TANGGALUKUR']
    $L['bb'] = ColName $src['BERAT']
    $L['tbmentah'] = ColName $src['TINGGI']
    $L['cara'] = ColName ($src['CARAUKUR'] + 9)
    if ($hasOwnBirth) { $L['lahirsheet'] = ColName $src['TANGGAL LAHIR'] }
    for ($i = 0; $i -lt 9; $i++) { $L[$visibleKeys[$i]] = ColName ($firstNew + $i) }

    # Kolom bantu di kanan (setelah kolom terakhir yang bergeser 9 kolom + 1 kolom kosong).
    $helperNames = @('tglukur', 'barisinduk', 'lahirinduk', 'jkinduk', 'tgllahir', 'jk', 'hari', 'hariz', 'bbnum',
      'tbraw', 'posisi', 'tb', 'ltbu', 'mtbu', 'stbu', 'lbbu', 'mbbu', 'sbbu', 'zmbbu', 'wfhpos', 'wfhbobot',
      'lbbtb', 'mbbtb', 'sbbtb', 'zmbbtb')
    $helperStart = $lastCol + 9 + 2
    if ($hasOwnBirth) { $helperNames = @('lahirsheet_h') + $helperNames }
    $helperKey = @{}
    for ($i = 0; $i -lt $helperNames.Count; $i++) {
      $L['h_' + $helperNames[$i]] = ColName ($helperStart + $i)
      $helperKey[$helperNames[$i]] = $helperStart + $i
    }
    function Ref([string]$k) { return $L[$k] + '2' }

    # Rumus baris 2 (disalin ke bawah oleh Excel sampai $LastRow).
    $f = @{}
    $f['h_tglukur'] = '=' + (F-Date (Ref 'ukur'))
    $f['h_barisinduk'] = '=IFERROR(MATCH(' + (F-Clean (Ref 'nik')) + '&"",' + $rNik + ',0),"")'
    $f['h_lahirinduk'] = '=IF(' + (Ref 'h_barisinduk') + '="","",INDEX(' + $rLahir + ',' + (Ref 'h_barisinduk') + '))'
    $f['h_jkinduk'] = '=IF(' + (Ref 'h_barisinduk') + '="","",LEFT(UPPER(' + (F-Clean ('INDEX(' + $rJk + ',' + (Ref 'h_barisinduk') + ')')) + '),1))'
    $induk = 'IF(' + (Ref 'h_lahirinduk') + '="","",' + (F-Date (Ref 'h_lahirinduk')) + ')'
    if ($hasOwnBirth) {
      $f['h_lahirsheet_h'] = '=' + (F-Date (Ref 'lahirsheet'))
      $f['h_tgllahir'] = '=IF(ISNUMBER(' + (Ref 'h_lahirsheet_h') + '),' + (Ref 'h_lahirsheet_h') + ',' + $induk + ')'
    } else {
      $f['h_tgllahir'] = '=' + $induk
    }
    $jkc = Ref 'jk'
    $jkClean = 'UPPER(' + (F-Clean $jkc) + ')'
    $f['h_jk'] = '=IF(LEFT(' + $jkClean + ',1)="L","L",IF(LEFT(' + $jkClean + ',1)="P","P",""))'
    $tu = Ref 'h_tglukur'; $tl = Ref 'h_tgllahir'
    $f['h_hari'] = '=IF(OR(' + $tu + '="",' + $tl + '=""),"",IF(' + $tu + '<' + $tl + ',"",' + $tu + '-' + $tl + '))'
    $hari = Ref 'h_hari'
    $f['h_hariz'] = '=IF(' + $hari + '="","",IF(AND(' + $hari + '<=1856,' + $hari + '/30.4375<60),' + $hari + ',""))'
    $hz = Ref 'h_hariz'
    $f['h_bbnum'] = '=' + (F-Number (Ref 'bb'))
    $f['h_tbraw'] = '=' + (F-Number (Ref 'tbmentah'))
    $cu = 'UPPER(' + (F-Clean (Ref 'cara')) + ')'
    $f['h_posisi'] = '=IF(LEFT(' + $cu + ',3)="BER","B",IF(OR(LEFT(' + $cu + ',3)="TER",LEFT(' + $cu + ',3)="TEL"),"T",""))'
    $raw = Ref 'h_tbraw'; $pos = Ref 'h_posisi'
    $f['h_tb'] = '=IF(OR(' + $raw + '="",' + $hari + '=""),"",IF(' + $pos + '="B",IF(' + $hari + '/30.4375<9,' + $raw + ',IF(' + $hari + '<731,' + $raw + '+0.7,' + $raw + ')),IF(' + $pos + '="T",IF(' + $hari + '>=731,' + $raw + '-0.7,' + $raw + '),' + $raw + ')))'
    $jk = Ref 'h_jk'; $bb = Ref 'h_bbnum'; $tbv = Ref 'h_tb'
    $sexCol = 'IF(' + $jk + '="L",{k},{k}+3)'
    function IdxAge([string]$rng, [int]$k) { return 'INDEX(' + $rng + ',' + $hz + '+1,' + $sexCol.Replace('{k}', [string]$k) + ')' }
    # TB/U: rumus LMS biasa.
    $needTbu = 'OR(' + $hz + '="",' + $tbv + '="",' + $jk + '="")'
    $f['h_ltbu'] = '=IF(' + $needTbu + ',"",' + (IdxAge $rLhfa 1) + ')'
    $f['h_mtbu'] = '=IF(' + $needTbu + ',"",' + (IdxAge $rLhfa 2) + ')'
    $f['h_stbu'] = '=IF(' + $needTbu + ',"",' + (IdxAge $rLhfa 3) + ')'
    # BB/U.
    $needBbu = 'OR(' + $hz + '="",' + $bb + '="",' + $jk + '="")'
    $f['h_lbbu'] = '=IF(' + $needBbu + ',"",' + (IdxAge $rWfa 1) + ')'
    $f['h_mbbu'] = '=IF(' + $needBbu + ',"",' + (IdxAge $rWfa 2) + ')'
    $f['h_sbbu'] = '=IF(' + $needBbu + ',"",' + (IdxAge $rWfa 3) + ')'
    $lb = Ref 'h_lbbu'; $mb = Ref 'h_mbbu'; $sb = Ref 'h_sbbu'
    $f['h_zmbbu'] = '=IF(' + $lb + '="","",((' + $bb + '/' + $mb + ')^' + $lb + '-1)/(' + $sb + '*' + $lb + '))'
    # BB/PB (umur < 731 hari) atau BB/TB, dengan interpolasi 0,1 cm seperti WHO Anthro.
    $f['h_wfhpos'] = '=IF(OR(' + $hz + '="",' + $bb + '="",' + $tbv + '="",' + $jk + '=""),"",IF(' + $hz + '<731,IF(AND(' + $tbv + '>=45,' + $tbv + '<=110),ROUND((TRUNC(' + $tbv + '*10)/10-45)/0.1,0)+1,""),IF(AND(' + $tbv + '>=65,' + $tbv + '<=120),ROUND((TRUNC(' + $tbv + '*10)/10-65)/0.1,0)+1,"")))'
    $wp = Ref 'h_wfhpos'
    $f['h_wfhbobot'] = '=IF(' + $wp + '="","",(' + $tbv + '-TRUNC(' + $tbv + '*10)/10)/0.1)'
    $wbt = Ref 'h_wfhbobot'
    function IdxLen([string]$rng, [int]$k) {
      $c = $sexCol.Replace('{k}', [string]$k)
      $lo = 'INDEX(' + $rng + ',' + $wp + ',' + $c + ')'
      $up = 'INDEX(' + $rng + ',' + $wp + '+1,' + $c + ')'
      return 'IF(' + $wbt + '>0,' + $lo + '+' + $wbt + '*(' + $up + '-' + $lo + '),' + $lo + ')'
    }
    foreach ($pair in @(@('h_lbbtb', 1), @('h_mbbtb', 2), @('h_sbbtb', 3))) {
      $k = [int]$pair[1]
      $f[$pair[0]] = '=IF(' + $wp + '="","",IFERROR(IF(' + $hz + '<731,' + (IdxLen $rWfl $k) + ',' + (IdxLen $rWfh $k) + '),""))'
    }
    $lt = Ref 'h_lbbtb'; $mt = Ref 'h_mbbtb'; $st = Ref 'h_sbbtb'
    $f['h_zmbbtb'] = '=IF(' + $lt + '="","",((' + $bb + '/' + $mt + ')^' + $lt + '-1)/(' + $st + '*' + $lt + '))'

    # Kolom terlihat.
    $f['jk'] = '=IF(OR(' + (Ref 'h_jkinduk') + '="L",' + (Ref 'h_jkinduk') + '="P"),' + (Ref 'h_jkinduk') + ',"")'
    $f['umur'] = '=IF(' + $hari + '="","",INT(' + $hari + '/30.4375))'
    $lu = Ref 'h_ltbu'; $mu = Ref 'h_mtbu'; $su = Ref 'h_stbu'
    $f['ztb'] = '=IF(' + $lu + '="","",ROUND(((' + $tbv + '/' + $mu + ')^' + $lu + '-1)/(' + $su + '*' + $lu + '),2))'
    $f['zbb'] = '=' + (F-ZAdjusted (Ref 'h_zmbbu') $bb $lb $mb $sb)
    $f['zbt'] = '=' + (F-ZAdjusted (Ref 'h_zmbbtb') $bb $lt $mt $st)
    $zt = Ref 'ztb'; $zb = Ref 'zbb'; $zw = Ref 'zbt'
    $f['stb'] = '=IF(' + $zt + '="","",IF(' + $zt + '<-3,"Sangat pendek",IF(' + $zt + '<-2,"Pendek",IF(' + $zt + '<=3,"Normal","Tinggi"))))'
    $f['sbb'] = '=IF(' + $zb + '="","",IF(' + $zb + '<-3,"Berat badan sangat kurang",IF(' + $zb + '<-2,"Berat badan kurang",IF(' + $zb + '<=1,"Berat badan normal","Risiko berat badan lebih"))))'
    $f['sbt'] = '=IF(' + $zw + '="","",IF(' + $zw + '<-3,"Gizi buruk",IF(' + $zw + '<-2,"Gizi kurang",IF(' + $zw + '<=1,"Gizi baik",IF(' + $zw + '<=2,"Berisiko gizi lebih",IF(' + $zw + '<=3,"Gizi lebih","Obesitas"))))))'
    $diag = 'IF(AND(' + $tu + '="",' + $bb + '="",' + $raw + '=""),"",IF(' + $raw + '="","isi TB",IF(' + $tu + '="","tgl ukur tidak terbaca",IF(' + $tl + '="","isi tgl lahir (Tambah Balita)",IF(' + $hari + '="","tgl ukur sebelum tgl lahir",IF(' + $hz + '="","umur 60 bulan atau lebih",IF(' + $jk + '="","isi JK (L/P)",IF(' + $tbv + '="","cek TB","cek data"))))))))'
    $f['stunt'] = '=IF(' + $zt + '<>"",IF(' + $zt + '<-2,"YA","TIDAK"),' + $diag + ')'

    # Tulis judul kolom.
    $titles = @{
      jk = 'JK'; umur = 'UMUR (bln)'; ztb = 'Z TB/U'; zbb = 'Z BB/U'; zbt = 'Z BB/TB'
      stb = 'STATUS TB/U'; sbb = 'STATUS BB/U'; sbt = 'STATUS BB/TB'; stunt = 'STUNTING?'
    }
    foreach ($k in $visibleKeys) { $ws.Range($L[$k] + '1').Value2 = $titles[$k] }
    foreach ($h in $helperNames) { $ws.Range($L['h_' + $h] + '1').Value2 = 'bantu_' + $h }
    [void]$ws.Range($L['jk'] + '1').AddComment("Jenis kelamin diambil dari sheet 'Tambah Balita' (lewat NIK). Boleh diketik L atau P untuk anak yang belum ada di sana. Wajib ada agar z-score terhitung.")
    [void]$ws.Range($L['stunt'] + '1').AddComment('YA bila TB/U di bawah -2 SD (pendek atau sangat pendek), TIDAK bila tidak. Bila belum bisa dihitung, kolom ini menjelaskan data apa yang kurang. Hasil belum divalidasi tenaga kesehatan.')

    # Tulis rumus ke baris 2 sampai $LastRow. Kolom di sheet asli berformat Teks (@); rumus yang ditulis ke sel
    # berformat Teks disimpan sebagai teks biasa dan tidak dihitung, jadi format diset ke General dulu.
    foreach ($k in $visibleKeys) {
      $rg = $ws.Range($L[$k] + '2:' + $L[$k] + $LastRow)
      $rg.NumberFormat = 'General'
      $rg.Formula = $f[$k]
    }
    foreach ($h in $helperNames) {
      $rg = $ws.Range($L['h_' + $h] + '2:' + $L['h_' + $h] + $LastRow)
      $rg.NumberFormat = 'General'
      $rg.Formula = $f['h_' + $h]
    }

    # Tampilan: warna seperti sheet PSG, border, format angka, lebar kolom.
    $colors = @{
      jk = (RGBColor 255 242 204); umur = (RGBColor 255 255 0)
      ztb = (RGBColor 221 217 196); zbb = (RGBColor 221 217 196); zbt = (RGBColor 221 217 196)
      stb = (RGBColor 242 220 219); sbb = (RGBColor 253 233 217); sbt = (RGBColor 218 238 243)
      stunt = (RGBColor 242 242 242)
    }
    $widths = @{ jk = 5; umur = 8; ztb = 9; zbb = 9; zbt = 9; stb = 15; sbb = 24; sbt = 20; stunt = 24 }
    foreach ($k in $visibleKeys) {
      $col = $L[$k]
      $hdr = $ws.Range($col + '1')
      $hdr.Font.Bold = $true
      $hdr.HorizontalAlignment = -4108
      $hdr.WrapText = $true
      $hdr.Interior.Color = $colors[$k]
      $body = $ws.Range($col + '2:' + $col + $LastRow)
      $body.Interior.Color = $colors[$k]
      $body.HorizontalAlignment = -4108
      $body.Borders.LineStyle = 1
      $hdr.Borders.LineStyle = 1
      $ws.Columns.Item($firstNew + [array]::IndexOf($visibleKeys, $k)).ColumnWidth = $widths[$k]
    }
    foreach ($k in @('ztb', 'zbb', 'zbt')) { $ws.Range($L[$k] + '2:' + $L[$k] + $LastRow).NumberFormat = '0.00' }

    # JK boleh diketik (L atau P) untuk menimpa rumus pencarian dari 'Tambah Balita'.
    $jkRange = $ws.Range($L['jk'] + '2:' + $L['jk'] + $LastRow)

    # Aturan format kondisional: rumus relatif terhadap SEL AKTIF, jadi sel pertama dipilih dulu.
    $ws.Activate()
    $missing = [System.Reflection.Missing]::Value
    function Add-Rule([string]$rangeText, [string]$formula) {
      $first = $rangeText.Split(':')[0]
      $ws.Range($first).Select() | Out-Null
      $fc = $ws.Range($rangeText).FormatConditions.Add(2, $missing, $formula)
      $fc.Font.Bold = $true
      $fc.Font.Color = (RGBColor 192 0 0)
      return $fc
    }
    $row2 = '2'
    $null = Add-Rule ($L['stb'] + '2:' + $L['stb'] + $LastRow) ('=AND(' + $L['stb'] + $row2 + '<>"",' + $L['stb'] + $row2 + '<>"Normal")')
    $null = Add-Rule ($L['sbb'] + '2:' + $L['sbb'] + $LastRow) ('=AND(' + $L['sbb'] + $row2 + '<>"",' + $L['sbb'] + $row2 + '<>"Berat badan normal")')
    $null = Add-Rule ($L['sbt'] + '2:' + $L['sbt'] + $LastRow) ('=AND(' + $L['sbt'] + $row2 + '<>"",' + $L['sbt'] + $row2 + '<>"Gizi baik")')
    # STUNTING? = YA: merah tebal dengan latar merah muda (kolomnya sendiri berlatar netral).
    $fcStunt = Add-Rule ($L['stunt'] + '2:' + $L['stunt'] + $LastRow) ('=' + $L['stunt'] + $row2 + '="YA"')
    $fcStunt.Interior.Color = (RGBColor 255 199 206)
    # Kolom JK kosong padahal ada data ukur: tandai agar diisi.
    $ws.Range($L['jk'] + '2').Select() | Out-Null
    $fcJk = $jkRange.FormatConditions.Add(2, $missing, '=AND(' + $L['jk'] + '2="",' + $L['tbmentah'] + '2<>"")')
    $fcJk.Interior.Color = (RGBColor 255 235 156)

    # Sembunyikan kolom bantu.
    $firstHelper = $helperStart
    $lastHelper = $helperStart + $helperNames.Count - 1
    $ws.Range($ws.Cells.Item(1, $firstHelper), $ws.Cells.Item(1, $lastHelper)).EntireColumn.Hidden = $true

    $report += [pscustomobject]@{
      Sheet = $name; KolomBaru = ($L['jk'] + '..' + $L['stunt']); LahirSendiri = $hasOwnBirth
      Bantu = ($L['h_' + $helperNames[0]] + '..' + $L['h_' + $helperNames[-1]])
    }
  }

  $xl.Calculation = -4105   # otomatis
  $xl.CalculateFull()
  $xl.ScreenUpdating = $true
  $wb.Save()

  # Periksa galat rumus (#NAME?, #VALUE!, dan sejenisnya).
  $errors = 0
  foreach ($name in $MonthSheets) {
    $ws = $wb.Worksheets.Item($name)
    try {
      $cells = $ws.UsedRange.SpecialCells(-4123, 16)
      $errors += $cells.Count
      Write-Host ("GALAT rumus di " + $name + ": " + $cells.Count + " sel (contoh " + $cells.Item(1).Address($false, $false) + ")")
    } catch { }
  }
  $report | Format-Table -AutoSize | Out-String | Write-Host
  Write-Host ("Selesai. Berkas: " + $Output)
  Write-Host ("Jumlah sel berisi galat rumus: " + $errors)
}
finally {
  if ($wb -ne $null) { $wb.Close($false) }
  $xl.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
}
