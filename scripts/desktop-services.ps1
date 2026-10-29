param(
  [Parameter(Mandatory = $true)][string]$StudioRoot,
  [string]$StateFile = '',
  [string]$WhisperPython = '',
  [int]$WhisperPort = 8000,
  [int]$OllamaPort = 11434
)
$ErrorActionPreference = 'SilentlyContinue'

function Test-Port([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try { return $client.ConnectAsync('127.0.0.1', $Port).Wait(400) -and $client.Connected }
  catch { return $false }
  finally { $client.Dispose() }
}

$script:started = @()

function Start-Background([string]$Id, [int]$Port, [string]$File, [string[]]$Arguments, [string]$WorkingDirectory) {
  # A port already answering belongs to somebody else, so it is never recorded and never stopped.
  if (-not $File -or (Test-Port $Port) -or -not (Test-Path -LiteralPath $File)) { return }
  $process = Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -WindowStyle Hidden -PassThru
  if ($process) {
    $script:started += [ordered]@{
      id = $Id
      pid = $process.Id
      name = [IO.Path]::GetFileNameWithoutExtension($File)
      port = $Port
    }
  }
}

# Which Python runs the transcription server is decided by the app, once, and handed in here.
$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
Start-Background 'ollama' $OllamaPort $ollama @('serve') $StudioRoot
Start-Background 'whisper' $WhisperPort $WhisperPython @('-m','uvicorn','whisper_server.app:app','--host','127.0.0.1','--port',$WhisperPort) $StudioRoot

if ($StateFile) {
  $directory = Split-Path -Parent $StateFile
  if ($directory -and -not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
  [ordered]@{ startedAt = (Get-Date).ToString('o'); services = @($script:started) } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $StateFile -Encoding UTF8
}
