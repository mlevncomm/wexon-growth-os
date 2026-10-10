# Wexon Growth OS - Arama masaüstü kurulumu
# "Wexon Growth" Windows kullanıcısında, o kullanıcıyla oturum açmışken çalıştırın.
# Her adım tekrar çalıştırılabilir: yapılmış olan atlanır. Yeniden başlatma gerekirse açılışta kaldığı yerden devam eder.
#
#   -Kontrol      : hiçbir şeyi değiştirmeden ne yapılacağını gösterir
#   -Adres        : uygulamanın açacağı Growth OS adresi
#   -Masaustu     : Wexon Growth OS masaüstü programının sihirbazından çalıştırılıyor (Chrome adımları atlanır)
#   -DevamKomutu  : yeniden başlatmadan sonra kurulumu sürdürecek komut
# Çıkış kodu: 0 = tamam, 10 = bilgisayar yeniden başlatılmalı, 1 = hata

param(
  [switch]$Kontrol,
  [switch]$Masaustu,
  [string]$Adres = "https://wexon-growth-os.vercel.app",
  [string]$DevamKomutu = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Uygulama = Join-Path $env:LOCALAPPDATA "WexonGrowthOS"
$Indirme  = Join-Path $Uygulama "indirilenler"
$Log      = Join-Path $Uygulama "kurulum.log"
New-Item -ItemType Directory -Force -Path $Uygulama, $Indirme | Out-Null

function Yaz([string]$m, [string]$renk = "Gray") {
  Write-Host $m -ForegroundColor $renk
  Add-Content -Path $Log -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $m) -Encoding UTF8
}
function Baslik([string]$m) { Write-Host ""; Yaz "== $m" "Cyan" }
function Tamam([string]$m) { Yaz "  [tamam] $m" "Green" }
function Uyari([string]$m) { Yaz "  [dikkat] $m" "Yellow" }
function Plan([string]$m) { Yaz "  [yapılacak] $m" "Magenta" }

Yaz "Wexon Growth OS arama kurulumu başladı · kullanıcı: $env:USERNAME · $(if ($Kontrol) { 'KONTROL MODU (değişiklik yok)' } else { 'kurulum' })" "White"

# ---------------------------------------------------------------------------
# VB-Audio sürücüleri: resmi siteden indirilir, imzası doğrulanır (dağıtım lisansı gerektirmez)
# ---------------------------------------------------------------------------
$Suruculer = @(
  @{
    Ad = "VB-CABLE (müşterinin sesi Ece'ye)"
    Url = "https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip"
    Kurulum = "VBCABLE_Setup_x64.exe"
    Arguman = "-i -h"
    Cihaz = '^CABLE Input'
  },
  @{
    Ad = "Hi-Fi Cable (Ece'nin sesi telefona)"
    Url = "https://download.vb-audio.com/Download_CABLE/HiFiCableAsioBridgeSetup_v1007.zip"
    Kurulum = "HiFiCableAsioBridgeSetup.exe"
    Arguman = ""
    Cihaz = '^Hi-Fi Cable Input'
  }
)
$Imzaci = 'BUREL|Vincent Burel'

# Cihaz eşleşmeleri (ilk bulunan kullanılır)
$MusteriKablosuCikis = '^CABLE Input'                                         # telefonun hoparlörü → buraya
$MusteriKablosuGiris = '^CABLE Output'                                        # Ece buradan dinler
$EceKablosuCikis     = '^(Hi-Fi Cable Input|CABLE-A Input|VoiceMeeter Input)' # Ece buraya konuşur
$EceKablosuGiris     = '^(Hi-Fi Cable Output|CABLE-A Output|VoiceMeeter Output)' # telefonun mikrofonu buradan

# ---------------------------------------------------------------------------
Baslik "1/6 Ön kontrol"
if (-not [Environment]::Is64BitOperatingSystem) { Yaz "Bu kurulum 64 bit Windows ister." "Red"; exit 1 }
$sesKodu = Join-Path $PSScriptRoot "WexonSes.cs"
if (-not (Test-Path $sesKodu)) { Yaz "WexonSes.cs bulunamadı; kurulum klasörünü bütün olarak kopyalayın." "Red"; exit 1 }
Add-Type -Path $sesKodu
function Cihazlar { [WexonGrowth.Ses]::Listele() }
function Bul([string]$desen, [bool]$cikis) { Cihazlar | Where-Object { $_.Cikis -eq $cikis -and $_.Ad -match $desen } | Select-Object -First 1 }
Tamam "Windows 64 bit · ses modülü yüklendi"

# ---------------------------------------------------------------------------
Baslik "2/6 Google Chrome"
$chrome = $null
if ($Masaustu) { Tamam "Masaüstü programı kendi tarayıcısını kullanır, Chrome gerekmez" } else {
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($chrome) { Tamam "Chrome bulundu: $chrome" }
elseif ($Kontrol) { Plan "Chrome kurulacak (winget ile)" }
else {
  Uyari "Chrome yok, kuruluyor (winget)…"
  try { winget install --id Google.Chrome -e --accept-package-agreements --accept-source-agreements --silent | Out-Null } catch {}
  $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $chrome) { Start-Process "https://www.google.com/chrome/"; Yaz "Chrome'u kurup bu kurulumu tekrar çalıştırın." "Red"; exit 1 }
  Tamam "Chrome kuruldu"
}
}

# ---------------------------------------------------------------------------
Baslik "3/6 Sanal ses kabloları"
$yenidenBaslat = $false
foreach ($s in $Suruculer) {
  if (Bul $s.Cihaz $true) { Tamam "$($s.Ad) zaten kurulu"; continue }
  if ($Kontrol) { Plan "$($s.Ad) indirilip kurulacak ($($s.Url))"; continue }
  Yaz "  $($s.Ad) indiriliyor…"
  $zip = Join-Path $Indirme ([IO.Path]::GetFileName($s.Url))
  $klasor = Join-Path $Indirme ([IO.Path]::GetFileNameWithoutExtension($s.Url))
  Invoke-WebRequest -Uri $s.Url -OutFile $zip -UseBasicParsing
  if (Test-Path $klasor) { Remove-Item $klasor -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $klasor -Force
  $exe = Join-Path $klasor $s.Kurulum
  $imza = Get-AuthenticodeSignature $exe
  if ($imza.Status -ne "Valid" -or $imza.SignerCertificate.Subject -notmatch $Imzaci) {
    Yaz "  $($s.Kurulum) imzası doğrulanamadı ($($imza.Status)). Güvenlik için kurulmadı." "Red"; exit 1
  }
  Tamam "İmza doğrulandı: VB-Audio (Vincent Burel)"
  Uyari "Yönetici izni ve Windows'un 'aygıt yazılımı yüklensin mi?' sorusu gelecek: Evet / Yükle deyin."
  $p = if ($s.Arguman) { Start-Process -FilePath $exe -ArgumentList $s.Arguman -Verb RunAs -Wait -PassThru } else { Start-Process -FilePath $exe -Verb RunAs -Wait -PassThru }
  Yaz "  Kurulum bitti (çıkış kodu $($p.ExitCode))"
  $yenidenBaslat = $true
}
if ($yenidenBaslat) {
  Start-Sleep -Seconds 3
  $eksik = $Suruculer | Where-Object { -not (Bul $_.Cihaz $true) }
  if ($eksik) {
    # Sürücüler yeniden başlatmadan sonra görünür → açılışta kurulum kendiliğinden devam etsin
    $devam = if ($DevamKomutu) { $DevamKomutu } else { "`"$(Join-Path $PSScriptRoot 'Wexon-Growth-OS-Kurulum.cmd')`"" }
    New-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce" -Name "WexonGrowthOSKurulum" -Value $devam -PropertyType String -Force | Out-Null
    Yaz "" ; Yaz "Sürücüler kuruldu. Bilgisayarı YENİDEN BAŞLATIN; tekrar oturum açınca kurulum kendiliğinden devam edecek." "Yellow"
    exit 10
  }
}

# ---------------------------------------------------------------------------
Baslik "4/6 Bu kullanıcının ses ayarları"
$mCikis = Bul $MusteriKablosuCikis $true
$eGiris = Bul $EceKablosuGiris $false
if ($Kontrol) {
  Yaz "  Şu anki cihazlar:"
  Cihazlar | ForEach-Object { Yaz "     $_" }
} elseif (-not $mCikis -or -not $eGiris) {
  Uyari "Gerekli kablolar görünmüyor. Bulunan cihazlar:"
  Cihazlar | ForEach-Object { Yaz "     $_" }
  Yaz "Bilgisayarı yeniden başlatıp kurulumu tekrar çalıştırın." "Red"; exit 1
}
$simdiCikis = [WexonGrowth.Ses]::Varsayilan($true, 2)
$simdiGiris = [WexonGrowth.Ses]::Varsayilan($false, 2)
if ($Kontrol) {
  $adOrBekle = { param($c, $varsayilan) if ($c) { $c.Ad } else { "$varsayilan (kurulumdan sonra)" } }
  Plan "Varsayılan çıkış + iletişim (telefonun hoparlörü) → $(& $adOrBekle $mCikis 'CABLE Input')"
  Plan "Varsayılan giriş + iletişim (telefonun mikrofonu) → $(& $adOrBekle $eGiris 'Hi-Fi Cable Output')"
  Plan "Arama sırasında ses kısma kapatılacak"
} else {
  if ($simdiCikis -ne $mCikis.Id) { [WexonGrowth.Ses]::VarsayilanYap($mCikis.Id) }
  if ($simdiGiris -ne $eGiris.Id) { [WexonGrowth.Ses]::VarsayilanYap($eGiris.Id) }
  Tamam "Varsayılan çıkış + iletişim: $($mCikis.Ad)"
  Tamam "Varsayılan giriş + iletişim: $($eGiris.Ad)"
  # Arama sırasında Windows diğer sesleri kısmasın ("Hiçbir şey yapma")
  New-Item -Path "HKCU:\Software\Microsoft\Multimedia\Audio" -Force | Out-Null
  Set-ItemProperty -Path "HKCU:\Software\Microsoft\Multimedia\Audio" -Name "UserDuckingPreference" -Value 3 -Type DWord
  Tamam "Arama sırasında ses kısma kapatıldı"
}

# ---------------------------------------------------------------------------
Baslik "5/6 Wexon Arama uygulaması"
if ($Masaustu) { Tamam "Wexon Growth OS masaüstü programı kurulu" } else {
$profil = Join-Path $Uygulama "Chrome"
$tercih = Join-Path $profil "Default\Preferences"
$mGiris = Bul $MusteriKablosuGiris $false
$origin = ([Uri]$Adres).GetLeftPart([UriPartial]::Authority)
if ($Kontrol) {
  Plan "Ayrı Chrome profili: $profil (ses tanıma mikrofonu → $(if ($mGiris) { $mGiris.Ad } else { 'CABLE Output' }), $origin için mikrofon izni)"
  Plan "Masaüstü ve Başlat menüsü: 'Wexon Arama' → $Adres/arama"
} else {
  # Ayrı profil: senin normal Chrome'una dokunmaz. Ses tanıma bu profilde CABLE Output'u dinler.
  if (-not (Test-Path $tercih)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $tercih) | Out-Null
    $pref = @{
      profile = @{
        exit_type = "Normal"
        content_settings = @{ exceptions = @{ media_stream_mic = @{ "$($origin):443,*" = @{ setting = 1 } } } }
      }
      browser = @{ check_default_browser = $false }
    }
    if ($mGiris) { $pref.media = @{ default_audio_capture_device = $mGiris.Id } }
    ($pref | ConvertTo-Json -Depth 10) | Set-Content -Path $tercih -Encoding UTF8
    Tamam "Chrome profili hazırlandı"
  } else { Tamam "Chrome profili zaten var" }

  # Simge
  $ikon = Join-Path $Uygulama "wexon.ico"
  if (-not (Test-Path $ikon)) {
    Add-Type -AssemblyName System.Drawing
    $bmp = New-Object System.Drawing.Bitmap 128, 128
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = "AntiAlias"; $g.TextRenderingHint = "AntiAlias"
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(11, 79, 74))), 4, 4, 120, 120)
    $font = New-Object System.Drawing.Font "Segoe UI", 56, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
    $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = "Center"; $fmt.LineAlignment = "Center"
    $g.DrawString("W", $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(61, 255, 154))), (New-Object System.Drawing.RectangleF 0, 4, 128, 128), $fmt)
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    $fs = [IO.File]::Create($ikon); $icon.Save($fs); $fs.Close()
    $g.Dispose(); $bmp.Dispose()
  }

  $kabuk = New-Object -ComObject WScript.Shell
  $ortak = "--user-data-dir=`"$profil`" --no-first-run --no-default-browser-check"
  function Kisayol([string]$yol, [string]$arg, [string]$aciklama) {
    $k = $kabuk.CreateShortcut($yol)
    $k.TargetPath = $chrome; $k.Arguments = $arg; $k.IconLocation = $ikon; $k.Description = $aciklama
    $k.WorkingDirectory = Split-Path $chrome
    $k.Save()
  }
  $masaustu = [Environment]::GetFolderPath("Desktop")
  $baslat = Join-Path ([Environment]::GetFolderPath("Programs")) "Wexon Growth OS"
  New-Item -ItemType Directory -Force -Path $baslat | Out-Null
  $uyg = "$ortak --app=`"$Adres/arama`" --window-size=1440,920"
  Kisayol (Join-Path $masaustu "Wexon Arama.lnk") $uyg "Ece ile işletmeleri ara"
  Kisayol (Join-Path $baslat "Wexon Arama.lnk") $uyg "Ece ile işletmeleri ara"
  Kisayol (Join-Path $baslat "Wexon Arama - Mikrofon ayarı.lnk") "$ortak chrome://settings/content/microphone" "Ses tanımanın dinlediği cihaz (CABLE Output olmalı)"
  Kisayol (Join-Path $baslat "Wexon Growth OS paneli.lnk") "$ortak --app=`"$Adres`" --window-size=1440,920" "Growth OS paneli"
  Tamam "Kısayollar: Masaüstü ve Başlat menüsü → 'Wexon Arama'"
}
}

# ---------------------------------------------------------------------------
Baslik "6/6 Telefon"
if (-not $Kontrol) {
  try { Start-Process "shell:AppsFolder\Microsoft.YourPhone_8wekyb3d8bbwe!App" } catch { Uyari "Telefon Bağlantısı açılamadı; Başlat menüsünden açın." }
}
Yaz ""
if ($Kontrol) { Yaz "KONTROL BİTTİ: hiçbir şey değiştirilmedi. Kurulum sonrası son adımlar:" "White" }
else { Yaz "KURULUM TAMAM. Son adımlar (bir kerelik):" "White" }
Yaz "  1. Telefon Bağlantısı'nda iPhone'u eşleştirin, Aramalar bölümünü açın." "White"
Yaz "  2. $(if ($Masaustu) { 'Wexon Growth OS programında' } else { "Masaüstündeki 'Wexon Arama'da" }) Growth OS'a giriş yapın." "White"
Yaz "  3. Arama ekranında Ses ayarları: Ece'nin sesi = $(if ($eGiris) { ($eGiris.Ad -replace 'Output','Input') } else { 'Hi-Fi Cable Input' }), müşteri = CABLE Output, kulaklık = kendi kulaklığınız." "White"
if (-not $Masaustu) { Yaz "  4. Kontrol: Başlat → Wexon Growth OS → 'Mikrofon ayarı' kısayolunda mikrofon CABLE Output görünmeli." "White" }
Yaz ""
Yaz "Günlük: $Log"
