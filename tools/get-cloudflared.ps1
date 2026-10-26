# Descarca cloudflared (oficial Cloudflare) in vendor/ pentru accesul telefoanelor de pe date mobile.
# Se ruleaza o data inainte de "npm run dist". Fisierul nu se pune in git.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'vendor'
New-Item -ItemType Directory -Force $dir | Out-Null
$out = Join-Path $dir 'cloudflared.exe'
$url = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
if (Test-Path $out) { Remove-Item $out -Force }
& curl.exe -L --fail --retry 5 --retry-delay 3 -C - -o $out $url
if ($LASTEXITCODE -ne 0) { if (Test-Path $out) { Remove-Item $out -Force }; throw "Descarcarea a esuat (curl $LASTEXITCODE)" }
$sig = Get-AuthenticodeSignature $out
if ($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'Cloudflare') {
  Remove-Item $out -Force
  throw "Semnatura cloudflared nu este valida: $($sig.Status) $($sig.SignerCertificate.Subject)"
}
Write-Output "cloudflared descarcat si verificat: $($sig.SignerCertificate.Subject)"
