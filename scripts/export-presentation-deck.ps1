param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$Width = 1600,
  [int]$Height = 900
)

# One JSON line on stdout is the contract the gateway reads back: either the pages written or a plain-English reason.
$ErrorActionPreference = 'Stop'
$powerpoint = $null
$deck = $null
try {
  $powerpoint = New-Object -ComObject PowerPoint.Application
}
catch {
  @{ ok = $false; error = 'Microsoft PowerPoint is not installed on this computer.' } | ConvertTo-Json -Compress
  exit 2
}

try {
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
  $deck = $powerpoint.Presentations.Open($Source, $true, $false, $false)
  $pages = @()
  $number = 0
  foreach ($slide in $deck.Slides) {
    $number = $number + 1
    $file = Join-Path $OutDir ('slide-{0:d2}.png' -f $number)
    $slide.Export($file, 'PNG', $Width, $Height)
    $title = ''
    try { $title = $slide.Shapes.Title.TextFrame.TextRange.Text }
    catch { $title = '' }
    $pages += [ordered]@{
      number = $number
      title  = (($title -replace '\s+', ' ').Trim())
      file   = (Split-Path $file -Leaf)
    }
  }
  [ordered]@{ ok = $true; count = $number; pages = $pages } | ConvertTo-Json -Compress -Depth 5
  exit 0
}
catch {
  @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
  exit 3
}
finally {
  try { if ($deck) { $deck.Close() } }
  catch { }
  try { if ($powerpoint) { $powerpoint.Quit() } }
  catch { }
}
