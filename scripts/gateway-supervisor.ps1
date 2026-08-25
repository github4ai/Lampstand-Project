$ErrorActionPreference = 'Continue'

$studioRoot = Split-Path $PSScriptRoot -Parent
$node = (Get-Command node.exe).Source
$logRoot = Join-Path $env:TEMP 'aios-studio'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$mutex = [Threading.Mutex]::new($false, 'Local\AIOSStudioGatewaySupervisor')
$ownsMutex = $false

try {
  $ownsMutex = $mutex.WaitOne(0)
} catch [Threading.AbandonedMutexException] {
  $ownsMutex = $true
}

if (-not $ownsMutex) {
  Write-Host 'The AIOS gateway supervisor is already running.'
  exit 0
}

$processLog = Join-Path $logRoot "gateway-process-$PID.log"
$processErrorLog = Join-Path $logRoot "gateway-process-$PID.err.log"
$gatewayPort = if ($env:AIOS_API_PORT) { [int]$env:AIOS_API_PORT } else { 9656 }

function Test-GatewayPort {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync('127.0.0.1', $gatewayPort)
    return $task.Wait(500) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

try {
  while ($true) {
    if (Test-GatewayPort) {
      Start-Sleep -Seconds 2
      continue
    }
    try {
      & $node (Join-Path $studioRoot 'server\index.mjs') `
        1>> $processLog `
        2>> $processErrorLog
    } catch {
      Write-Error $_
    }
    Start-Sleep -Seconds 2
  }
} finally {
  if ($ownsMutex) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
