param(
  [string]$RecoveryBibleSource = 'I:\AI\Knowledge\Ministry\Bible\Recovery Version',
  [string]$RecoveryFootnotesSource = 'I:\AI\Libraries\Ministry\Footnotes\footnotes\bibleread.online\note',
  [string]$LifeStudySource = 'I:\AI\Libraries\Ministry\Bible, Life-Study, Ministry Books\Bible - Recovery Version\bibleread.online\life-study-of-the-bible',
  [string]$SchoolSource = 'I:\AI\Knowledge\School',
  [string]$KnowledgeIndexSource = 'I:\AI\Index\School'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataRoot = Join-Path $projectRoot 'data'

$libraries = @(
  @{ Name = 'Recovery Bible'; Source = $RecoveryBibleSource; Target = Join-Path $dataRoot 'ministry\recovery-bible' },
  @{ Name = 'Recovery footnotes'; Source = $RecoveryFootnotesSource; Target = Join-Path $dataRoot 'ministry\recovery-footnotes' },
  @{ Name = 'Life-Study'; Source = $LifeStudySource; Target = Join-Path $dataRoot 'ministry\life-study' },
  @{ Name = 'School'; Source = $SchoolSource; Target = Join-Path $dataRoot 'knowledge\School' },
  @{ Name = 'School knowledge index'; Source = $KnowledgeIndexSource; Target = Join-Path $dataRoot 'knowledge-index\School' }
)

$bundledIndexRoot = Join-Path $dataRoot 'knowledge-index'
if (Test-Path -LiteralPath $bundledIndexRoot) {
  Remove-Item -LiteralPath $bundledIndexRoot -Recurse -Force
}

foreach ($library in $libraries) {
  if (-not (Test-Path -LiteralPath $library.Source)) {
    throw "$($library.Name) source was not found: $($library.Source)"
  }
  if ($library.Name -in @('School', 'School knowledge index') -and (Test-Path -LiteralPath $library.Target)) {
    Remove-Item -LiteralPath $library.Target -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $library.Target | Out-Null
  Copy-Item -Path (Join-Path $library.Source '*') -Destination $library.Target -Recurse -Force
}

$required = @(
  (Join-Path $dataRoot 'hymnal-library.json'),
  (Join-Path $dataRoot 'hwmr-library.json'),
  (Join-Path $dataRoot 'ministry-books\library.sqlite'),
  (Join-Path $dataRoot 'ministry\recovery-bible'),
  (Join-Path $dataRoot 'ministry\recovery-footnotes'),
  (Join-Path $dataRoot 'ministry\life-study'),
  (Join-Path $dataRoot 'knowledge\School'),
  (Join-Path $dataRoot 'knowledge-index')
)

foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path)) { throw "Required installer library is missing: $path" }
}

$summary = foreach ($path in $required) {
  $item = Get-Item -LiteralPath $path
  $files = if ($item.PSIsContainer) { @(Get-ChildItem -LiteralPath $path -File -Recurse) } else { @($item) }
  [pscustomobject]@{
    Path = $path.Substring($dataRoot.Length + 1)
    Files = $files.Count
    Bytes = [long](($files | Measure-Object Length -Sum).Sum)
  }
}

$summary | Format-Table -AutoSize
Write-Host 'All reading libraries are ready for the Windows installer.' -ForegroundColor Green
