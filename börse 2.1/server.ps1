param(
  [int]$Port = 8765
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexPath = Join-Path $projectRoot 'index.html'
$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
$listener.Start()

function Write-Log {
  param([string]$Message)
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Write-Output "[$timestamp] $Message"
}

function Send-Bytes {
  param(
    [System.Net.HttpListenerContext]$Context,
    [byte[]]$Bytes,
    [string]$ContentType,
    [int]$StatusCode = 200
  )

  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = $ContentType
  $Context.Response.ContentLength64 = $Bytes.Length
  $Context.Response.Headers['Cache-Control'] = 'no-store'
  $Context.Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
  $Context.Response.OutputStream.Close()
}

function Send-Json {
  param(
    [System.Net.HttpListenerContext]$Context,
    $Object,
    [int]$StatusCode = 200
  )

  $json = $Object | ConvertTo-Json -Depth 8
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  Send-Bytes -Context $Context -Bytes $bytes -ContentType 'application/json; charset=utf-8' -StatusCode $StatusCode
}

function Invoke-TradingViewScan {
  param(
    [string]$Market,
    [string]$Ticker
  )

  $body = @{
    symbols = @{
      tickers = @($Ticker)
      query = @{ types = @() }
    }
    columns = @('close', 'change', 'currency')
  } | ConvertTo-Json -Depth 6

  Invoke-RestMethod -Uri ("https://scanner.tradingview.com/{0}/scan" -f $Market) -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 20
}

function Get-EurToUsdRate {
  $fx = Invoke-RestMethod -Uri 'https://open.er-api.com/v6/latest/EUR' -TimeoutSec 20
  [double]$fx.rates.USD
}

function Get-QuotePayload {
  $assetMap = @(
    @{ id = 'aixtron'; market = 'germany'; ticker = 'XETR:AIXA' },
    @{ id = 'ltc-properties'; market = 'america'; ticker = 'NYSE:LTC' },
    @{ id = 'bmw'; market = 'germany'; ticker = 'XETR:BMW' },
    @{ id = 'mercedes'; market = 'germany'; ticker = 'XETR:MBG' },
    @{ id = 'orlen'; market = 'germany'; ticker = 'FWB:PKN' },
    @{ id = 'bitcoin'; market = 'crypto'; ticker = 'BINANCE:BTCEUR' },
    @{ id = 'ethereum'; market = 'crypto'; ticker = 'BINANCE:ETHEUR' },
    @{ id = 'solana'; market = 'crypto'; ticker = 'BINANCE:SOLEUR' },
    @{ id = 'dogecoin'; market = 'crypto'; ticker = 'BINANCE:DOGEEUR' }
  )

  $eurToUsd = Get-EurToUsdRate
  $quotes = @{}

  foreach ($asset in $assetMap) {
    try {
      $response = Invoke-TradingViewScan -Market $asset.market -Ticker $asset.ticker
      if (-not $response.data -or -not $response.data.Count) {
        $quotes[$asset.id] = @{ error = 'no-data' }
        continue
      }

      $raw = $response.data[0].d
      $price = [double]$raw[0]
      $changePercent = [double]$raw[1]
      $currency = [string]$raw[2]

      switch ($currency) {
        'EUR' {
          $price = $price * $eurToUsd
          $currency = 'USD'
        }
        'USD' {
          $currency = 'USD'
        }
        default {
          $quotes[$asset.id] = @{ error = "unsupported-currency:$currency" }
          continue
        }
      }

      $quotes[$asset.id] = @{
        price = [math]::Round($price, 4)
        changePercent = [math]::Round($changePercent, 4)
        currency = $currency
        source = $asset.ticker
      }
    } catch {
      Write-Log "Quote error $($asset.id): $($_.Exception.Message)"
      $quotes[$asset.id] = @{ error = $_.Exception.Message }
    }
  }

  return @{
    updatedAt = (Get-Date).ToString('o')
    quotes = $quotes
  }
}

Write-Log "Server started at $prefix"

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
      $path = $context.Request.Url.AbsolutePath.TrimEnd('/')
      if ([string]::IsNullOrWhiteSpace($path)) { $path = '/' }
      Write-Log "Request $path"

      if ($path -eq '/api/quotes') {
        $payload = Get-QuotePayload
        Send-Json -Context $context -Object $payload
        continue
      }

      if ($path -eq '/' -or $path -eq '/index.html') {
        $content = [System.IO.File]::ReadAllBytes($indexPath)
        Send-Bytes -Context $context -Bytes $content -ContentType 'text/html; charset=utf-8'
        continue
      }

      Send-Json -Context $context -Object @{ error = 'not-found'; path = $path } -StatusCode 404
    } catch {
      Write-Log "Error $($_.Exception.Message)"
      Send-Json -Context $context -Object @{ error = $_.Exception.Message } -StatusCode 500
    }
  }
} finally {
  if ($listener.IsListening) { $listener.Stop() }
  $listener.Close()
}
