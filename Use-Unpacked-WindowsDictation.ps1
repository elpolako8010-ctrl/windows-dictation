$ErrorActionPreference = 'Stop'

$appRoot = Join-Path $PSScriptRoot 'apps\Windows-Dictation-0.1.0'
$resDir = Join-Path $appRoot 'resources'
$asar = Join-Path $resDir 'app.asar'
$appDir = Join-Path $resDir 'app'

if (-not (Test-Path -LiteralPath $appDir)) {
  throw "Missing unpacked app dir: $appDir"
}

# Close Windows Dictation if it's running (required to unlock app.asar)
Get-Process -Name 'Windows Dictation' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 800

if (Test-Path -LiteralPath $asar) {
  $disabled = Join-Path $resDir ("app.asar.disabled.{0}" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
  Move-Item -LiteralPath $asar -Destination $disabled
  Write-Host "Disabled app.asar -> $disabled"
} else {
  Write-Host 'No app.asar found (already disabled).'
}

Write-Host 'Done. Start Windows Dictation again.'

