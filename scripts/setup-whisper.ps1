$ErrorActionPreference = 'Stop'

$python = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\python.exe'
if (-not (Test-Path -LiteralPath $python)) {
  throw 'Python 3.11 was not found. Install it from the Microsoft Store or with winget.'
}

& $python -m venv .venv-whisper
& .\.venv-whisper\Scripts\python.exe -m pip install --upgrade pip
& .\.venv-whisper\Scripts\python.exe -m pip install -r whisper_server\requirements.txt

Write-Host 'Local Whisper is installed. Run npm run whisper to start it.'
