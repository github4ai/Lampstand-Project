$ErrorActionPreference = 'Stop'

$studioRoot = Split-Path $PSScriptRoot -Parent
$aiRoot = Split-Path $studioRoot -Parent
$logRoot = Join-Path $env:TEMP 'aios-studio'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

function Test-LocalPort([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync('127.0.0.1', $Port)
    return $task.Wait(400) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Wait-LocalPort([int]$Port, [int]$Seconds = 12) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-LocalPort $Port) { return $true }
    Start-Sleep -Milliseconds 300
  }
  return $false
}

function Start-LocalService {
  param(
    [string]$Name,
    [int]$Port,
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [hashtable]$Environment = @{}
  )

  if (Test-LocalPort $Port) {
    Write-Host "[ready] $Name on port $Port"
    return
  }
  if (-not (Test-Path -LiteralPath $FilePath)) {
    Write-Warning "$Name could not start because $FilePath was not found."
    return
  }

  foreach ($entry in $Environment.GetEnumerator()) {
    [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
  }
  try {
    $safeName = $Name.ToLowerInvariant().Replace(' ', '-')
    Start-Process -FilePath $FilePath -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory `
      -RedirectStandardOutput (Join-Path $logRoot "$safeName.log") `
      -RedirectStandardError (Join-Path $logRoot "$safeName.err.log") -WindowStyle Hidden | Out-Null
  } finally {
    foreach ($entry in $Environment.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable($entry.Key, $null, 'Process')
    }
  }

  if (Wait-LocalPort $Port) { Write-Host "[started] $Name on port $Port" }
  else { Write-Warning "$Name did not become ready. Check $logRoot\$safeName.err.log" }
}

$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
$legacyPython = Join-Path $aiRoot 'ai-env\Scripts\python.exe'
$whisperPython = Join-Path $studioRoot '.venv-whisper\Scripts\python.exe'
$node = (Get-Command node.exe).Source
$npm = (Get-Command npm.cmd).Source

Start-LocalService -Name 'Ollama' -Port 11434 -FilePath $ollama -Arguments @('serve') -WorkingDirectory $studioRoot
Start-LocalService -Name 'Original AIOS API' -Port 8765 -FilePath $legacyPython `
  -Arguments @('-m', 'uvicorn', 'AIOS.api.app:app', '--host', '127.0.0.1', '--port', '8765') -WorkingDirectory $aiRoot
Start-LocalService -Name 'Local Whisper' -Port 8000 -FilePath $whisperPython `
  -Arguments @('-m', 'uvicorn', 'whisper_server.app:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory $studioRoot
Start-LocalService -Name 'Unified AIOS Gateway' -Port 8766 -FilePath $node `
  -Arguments @('server/index.mjs') -WorkingDirectory $studioRoot -Environment @{ AIOS_API_PORT = '8766' }
Start-LocalService -Name 'AIOS Studio Web' -Port 5173 -FilePath $npm `
  -Arguments @('run', 'dev', '--', '--host', 'localhost', '--port', '5173') -WorkingDirectory $studioRoot

Write-Host ''
Write-Host 'AIOS Studio: http://localhost:5173/'
Write-Host "Logs: $logRoot"
