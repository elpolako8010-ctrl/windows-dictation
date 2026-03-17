$ErrorActionPreference = 'Stop'

$appDir = Join-Path $PSScriptRoot 'apps\Windows-Dictation-0.1.0'
$exe = Join-Path $appDir 'Windows Dictation.exe'

if (-not (Test-Path -LiteralPath $exe)) {
  throw "Windows Dictation not found at: $exe"
}

Start-Process -FilePath $exe -WorkingDirectory $appDir