param([Parameter(Mandatory = $true)][string]$StudioRoot)
$ErrorActionPreference = 'SilentlyContinue'

function Test-Port([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try { return $client.ConnectAsync('127.0.0.1', $Port).Wait(400) -and $client.Connected }
  catch { return $false }
  finally { $client.Dispose() }
}

function Start-Background([int]$Port, [string]$File, [string[]]$Arguments, [string]$WorkingDirectory) {
  if ((Test-Port $Port) -or -not (Test-Path -LiteralPath $File)) { return }
  Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -WindowStyle Hidden | Out-Null
}

$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
$python = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'
$installedWhisper = Join-Path $env:APPDATA 'lampstand-studio\ai\whisper\.venv\Scripts\python.exe'
$sourceWhisper = Join-Path $StudioRoot '.venv-whisper\Scripts\python.exe'
$whisperPython = if (Test-Path -LiteralPath $installedWhisper) { $installedWhisper } elseif (Test-Path -LiteralPath $sourceWhisper) { $sourceWhisper } else { $python }
Start-Background 11434 $ollama @('serve') $StudioRoot
Start-Background 8000 $whisperPython @('-m','uvicorn','whisper_server.app:app','--host','127.0.0.1','--port','8000') $StudioRoot
