param(
  [ValidateSet('Start','Stop','Repair','Status','Backup')][string]$Action = 'Start',
  [string]$BackupRoot = 'I:\AI\Lampstand Project Backups'
)

$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$logRoot = Join-Path $env:TEMP 'aios-studio'
$ports = [ordered]@{ Ollama = 11434; 'Legacy local API' = 9655; 'Local Whisper' = 8000; 'Lampstand Gateway' = 9656; 'Lampstand Project Web' = 5173 }

function Test-AiosPort([int]$Port) {
  $client = [Net.Sockets.TcpClient]::new()
  try { $task = $client.ConnectAsync('127.0.0.1', $Port); return $task.Wait(500) -and $client.Connected }
  catch { return $false }
  finally { $client.Dispose() }
}

function Show-AiosStatus {
  $rows = foreach ($entry in $ports.GetEnumerator()) {
    [pscustomobject]@{ Service = $entry.Key; Port = $entry.Value; Status = if (Test-AiosPort $entry.Value) { 'Ready' } else { 'Offline' } }
  }
  Write-Host ''
  foreach ($row in $rows) { Write-Host ("[{0}] {1} on port {2}" -f $row.Status.ToLowerInvariant(), $row.Service, $row.Port) }
  Write-Host ''
  return -not ($rows.Status -contains 'Offline')
}

function Start-Aios {
  & (Join-Path $PSScriptRoot 'start-local.ps1')
  $ready = Show-AiosStatus
  if ($ready) { Start-Process 'http://localhost:5173/' | Out-Null }
  else { Write-Warning "Some services need attention. Use Repair-Lampstand-Studio.cmd or check $logRoot." }
}

function Stop-Aios {
  foreach ($entry in $ports.GetEnumerator() | Sort-Object Value -Descending) {
    $connections = Get-NetTCPConnection -LocalPort $entry.Value -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
      $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
      if ($process) {
        Write-Host "[stopping] $($entry.Key) (PID $($process.Id))"
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
    }
  }
  Write-Host 'Lampstand Project services stopped. Your saved work and libraries were not changed.'
}

function Backup-Aios {
  $stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
  $target = Join-Path $BackupRoot $stamp
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  $aiRoot = Split-Path $studioRoot -Parent
  $pinokioHome = $null
  try { $pinokioHome = (Get-Content -Raw (Join-Path $env:USERPROFILE '.pinokio\config.json') | ConvertFrom-Json).home } catch { }
  $sources = @(
    @{ Path = (Join-Path $studioRoot 'data'); Name = 'Studio Data' },
    @{ Path = (Join-Path $aiRoot 'Knowledge'); Name = 'Knowledge' },
    @{ Path = (Join-Path $aiRoot 'Index'); Name = 'Index' },
    @{ Path = (Join-Path $aiRoot 'Libraries'); Name = 'Libraries' }
  )
  if ($pinokioHome) {
    $sources += @{ Path = (Join-Path $pinokioHome 'api\wan.git\app\outputs'); Name = 'Generated Media\WanGP' }
    $sources += @{ Path = (Join-Path $pinokioHome 'api\comfy.git\app\output'); Name = 'Generated Media\ComfyUI' }
  }
  $manifest = @()
  foreach ($source in $sources) {
    if (-not (Test-Path -LiteralPath $source.Path)) { continue }
    $destination = Join-Path $target $source.Name
    $destinationParent = Split-Path $destination -Parent
    New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
    Copy-Item -LiteralPath $source.Path -Destination $destination -Recurse -Force
    $files = Get-ChildItem -LiteralPath $destination -File -Recurse
    $manifest += [pscustomobject]@{ Name = $source.Name; Source = $source.Path; Files = $files.Count; Bytes = ($files | Measure-Object Length -Sum).Sum }
  }
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $target 'backup-manifest.json') -Encoding UTF8
  Write-Host "Lampstand libraries and application data backed up to $target"
}

switch ($Action) {
  'Start' { Start-Aios }
  'Repair' { Write-Host 'Repairing Lampstand Project services...'; Start-Aios }
  'Stop' { Stop-Aios }
  'Status' { [void](Show-AiosStatus) }
  'Backup' { Backup-Aios }
}
