param([Parameter(Mandatory = $true)][string]$StudioRoot)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$lampstandData = Join-Path $env:APPDATA 'lampstand-studio'
$aiRoot = Join-Path $lampstandData 'ai'
$logRoot = Join-Path $lampstandData 'logs'
$logFile = Join-Path $logRoot 'standard-ai-install.log'
$statusFile = Join-Path $aiRoot 'standard-ai-status.json'
$readyFile = Join-Path $aiRoot 'standard-ai.ready'

New-Item -ItemType Directory -Force -Path $aiRoot, $logRoot | Out-Null

function Write-SetupLog([string]$Message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
  Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

function Set-SetupStatus([string]$State, [string]$Step, [string]$Message) {
  [ordered]@{
    state = $State
    step = $Step
    message = $Message
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding UTF8
  Write-SetupLog "[$State] $Step - $Message"
}

function Find-Executable([string]$Name, [string[]]$Candidates) {
  foreach ($candidate in $Candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command -and $command.Source -notlike '*\WindowsApps\python.exe') { return $command.Source }
  return $null
}

function Install-WithWinget([string]$PackageId, [string]$Label) {
  $winget = Find-Executable 'winget.exe' @((Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\winget.exe'))
  if (-not $winget) { throw "Windows App Installer (winget) is required to install $Label." }
  Set-SetupStatus 'installing' $Label "Installing $Label silently."
  & $winget install --id $PackageId --exact --silent --scope user --accept-package-agreements --accept-source-agreements --disable-interactivity
  if ($LASTEXITCODE -ne 0) { throw "$Label installation failed with exit code $LASTEXITCODE." }
}

try {
  if (Test-Path -LiteralPath $readyFile) {
    Set-SetupStatus 'ready' 'complete' 'Standard AI is already installed.'
    exit 0
  }

  Set-SetupStatus 'installing' 'starting' 'Preparing the local AI services.'

  $ollama = Find-Executable 'ollama.exe' @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'),
    (Join-Path $env:ProgramFiles 'Ollama\ollama.exe')
  )
  if (-not $ollama) {
    Install-WithWinget 'Ollama.Ollama' 'Ollama'
    $ollama = Find-Executable 'ollama.exe' @(
      (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'),
      (Join-Path $env:ProgramFiles 'Ollama\ollama.exe')
    )
  }
  if (-not $ollama) { throw 'Ollama was installed but ollama.exe could not be found.' }

  $python = Find-Executable 'python.exe' @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe')
  )
  if (-not $python) {
    Install-WithWinget 'Python.Python.3.11' 'Python 3.11'
    $python = Find-Executable 'python.exe' @((Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'))
  }
  if (-not $python) { throw 'Python was installed but python.exe could not be found.' }

  $venvRoot = Join-Path $aiRoot 'whisper\.venv'
  $venvPython = Join-Path $venvRoot 'Scripts\python.exe'
  if (-not (Test-Path -LiteralPath $venvPython)) {
    Set-SetupStatus 'installing' 'local-whisper' 'Creating the private speech-to-text environment.'
    & $python -m venv $venvRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not create the Local Whisper environment.' }
  }

  Set-SetupStatus 'installing' 'local-whisper' 'Installing Local Whisper and downloading its speech model.'
  & $venvPython -m pip install --disable-pip-version-check --upgrade pip
  & $venvPython -m pip install --disable-pip-version-check -r (Join-Path $StudioRoot 'whisper_server\requirements.txt')
  if ($LASTEXITCODE -ne 0) { throw 'Local Whisper package installation failed.' }
  & $venvPython -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"
  if ($LASTEXITCODE -ne 0) { throw 'The Local Whisper model download failed.' }

  $ollamaReady = $false
  try { $ollamaReady = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2).StatusCode -eq 200 } catch {}
  if (-not $ollamaReady) {
    Start-Process -FilePath $ollama -ArgumentList @('serve') -WindowStyle Hidden | Out-Null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      Start-Sleep -Seconds 1
      try {
        if ((Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2).StatusCode -eq 200) { break }
      } catch {}
    }
  }

  foreach ($model in @('qwen3:8b', 'translategemma:4b')) {
    Set-SetupStatus 'installing' 'ollama-models' "Downloading $model."
    & $ollama pull $model
    if ($LASTEXITCODE -ne 0) { throw "The Ollama model $model could not be downloaded." }
  }

  $whisperReady = $false
  try { $whisperReady = (Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 2).StatusCode -eq 200 } catch {}
  if (-not $whisperReady) {
    Start-Process -FilePath $venvPython -ArgumentList @('-m','uvicorn','whisper_server.app:app','--host','127.0.0.1','--port','8000') -WorkingDirectory $StudioRoot -WindowStyle Hidden | Out-Null
  }

  Set-Content -LiteralPath $readyFile -Value (Get-Date).ToUniversalTime().ToString('o') -Encoding UTF8
  Set-SetupStatus 'ready' 'complete' 'Standard AI is installed and ready.'
} catch {
  Set-SetupStatus 'failed' 'setup' $_.Exception.Message
  exit 1
}
