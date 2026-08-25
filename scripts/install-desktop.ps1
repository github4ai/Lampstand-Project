param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path $PSScriptRoot -Parent
$desktop = [Environment]::GetFolderPath('Desktop')
$programsRoot = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'
$programs = Join-Path $programsRoot 'Lampstand Project'
$legacyPrograms = Join-Path $programsRoot 'AIOS Studio'
$shell = New-Object -ComObject WScript.Shell

function Set-Shortcut([string]$Path, [string]$Target, [string]$Description) {
  $shortcut = $shell.CreateShortcut($Path)
  $shortcut.TargetPath = Join-Path $studioRoot $Target
  $shortcut.WorkingDirectory = $studioRoot
  $shortcut.Description = $Description
  $shortcut.IconLocation = "$env:SystemRoot\System32\imageres.dll,197"
  $shortcut.Save()
}

if ($Remove) {
  Remove-Item -LiteralPath (Join-Path $desktop 'Lampstand Project.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath (Join-Path $desktop 'AIOS Studio.lnk') -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $programs -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $legacyPrograms -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host 'Lampstand Project shortcuts removed. The application and all data remain installed.'
  exit 0
}

New-Item -ItemType Directory -Path $programs -Force | Out-Null
Remove-Item -LiteralPath (Join-Path $desktop 'AIOS Studio.lnk') -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $legacyPrograms -Recurse -Force -ErrorAction SilentlyContinue
Set-Shortcut (Join-Path $desktop 'Lampstand Project.lnk') 'Start-Lampstand-Studio.cmd' 'Start Lampstand Project and all local services'
Set-Shortcut (Join-Path $programs 'Start Lampstand Project.lnk') 'Start-Lampstand-Studio.cmd' 'Start Lampstand Project'
Set-Shortcut (Join-Path $programs 'Repair Lampstand Project.lnk') 'Repair-Lampstand-Studio.cmd' 'Repair and restart missing Lampstand services'
Set-Shortcut (Join-Path $programs 'Stop Lampstand Project.lnk') 'Stop-Lampstand-Studio.cmd' 'Stop Lampstand Project services and unload memory'
Set-Shortcut (Join-Path $programs 'Backup Lampstand Project.lnk') 'Backup-Lampstand-Studio.cmd' 'Back up Lampstand libraries and application data'
Write-Host 'Lampstand Project desktop and Start Menu shortcuts installed.'
