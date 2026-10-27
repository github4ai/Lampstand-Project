$ErrorActionPreference = 'Stop'

$studioRoot = Split-Path $PSScriptRoot -Parent
$devPort = 5173
$devUrl = "http://127.0.0.1:$devPort"

# A shell that inherits this runs Electron as bare Node: no window, exit 0, no trace of why.
$env:ELECTRON_RUN_AS_NODE = $null
$env:LAMPSTAND_DEV_URL = $devUrl

function Test-PortOpen([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    return $client.ConnectAsync('127.0.0.1', $Port).Wait(400) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Test-DevServer {
  try {
    return (Invoke-WebRequest -Uri $devUrl -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200
  } catch {
    return $false
  }
}

if (Test-PortOpen 9656) {
  Write-Warning 'Port 9656 is already taken, so this window will read data from that gateway - the installed app - and will not see server-side edits. Close the installed app and run this again to develop against this working tree.'
}

# node directly rather than `pnpm exec vite`, so the process waited on and stopped is Vite itself.
$vite = Start-Process -FilePath 'node' -ArgumentList (Join-Path $studioRoot 'node_modules\vite\bin\vite.js'), '--host', '127.0.0.1', '--port', $devPort, '--strictPort' -WorkingDirectory $studioRoot -NoNewWindow -PassThru

Write-Host 'Starting the Vite dev server...'
$deadline = (Get-Date).AddSeconds(120)
while (-not (Test-DevServer)) {
  if ($vite.HasExited) { throw "Vite exited with code $($vite.ExitCode) before it answered on $devUrl." }
  if ((Get-Date) -gt $deadline) { throw "Vite did not answer on $devUrl within 120s." }
  Start-Sleep -Milliseconds 500
}

Write-Host 'Opening the app window. Edits now reach it as you save - no build, no installer, no new version.'
try {
  Start-Process -FilePath (Join-Path $studioRoot 'node_modules\electron\dist\electron.exe') -ArgumentList (Join-Path $studioRoot 'desktop\main.cjs') -WorkingDirectory $studioRoot -PassThru | Wait-Process
} finally {
  Stop-Process -Id $vite.Id -Force -ErrorAction SilentlyContinue
}
