param([Parameter(Mandatory = $true)][string]$StateFile)
$ErrorActionPreference = 'SilentlyContinue'

# Stop only what the app recorded as its own. A pid is checked against the program it was recorded
# for, because Windows hands the same number out again and the wrong process would be killed.
try { $state = Get-Content -LiteralPath $StateFile -Raw | ConvertFrom-Json } catch { exit 0 }
foreach ($service in @($state.services)) {
  if (-not $service.pid) { continue }
  $process = Get-Process -Id $service.pid -ErrorAction SilentlyContinue
  if (-not $process) { continue }
  if ($process.ProcessName -ne $service.name) { continue }
  & taskkill /PID $service.pid /T /F 2>$null | Out-Null
}
Remove-Item -LiteralPath $StateFile -Force -ErrorAction SilentlyContinue
