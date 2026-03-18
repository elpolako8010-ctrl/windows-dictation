param(
  [int]$Port = 8765
)

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverScript = Join-Path $projectRoot 'server.ps1'
$url = "http://localhost:$Port/"

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $listener) {
  $log = Join-Path $projectRoot 'server.log'
  $err = Join-Path $projectRoot 'server.err.log'
  Start-Process powershell -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy','Bypass',
    '-File', $serverScript,
    '-Port', "$Port"
  ) -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err

  $ready = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null
      $ready = $true
      break
    } catch {
    }
  }
}

Start-Process $url
