$ErrorActionPreference = 'Stop'

$languages = @('mr-IN', 'te-IN', 'ml-IN')
$logPath = Join-Path $env:TEMP 'aios-studio\speech-install.log'
New-Item -ItemType Directory -Path (Split-Path $logPath) -Force | Out-Null

"Speech installation started: $(Get-Date -Format o)" | Set-Content -LiteralPath $logPath

foreach ($language in $languages) {
  foreach ($feature in @('Basic', 'TextToSpeech')) {
    $name = "Language.$feature~~~$language~0.0.1.0"
    $capability = Get-WindowsCapability -Online -Name $name
    if ($capability.State -ne 'Installed') {
      "Installing $language $feature..." | Add-Content -LiteralPath $logPath
      $result = Add-WindowsCapability -Online -Name $name
      "$language $feature restart needed: $($result.RestartNeeded)" | Add-Content -LiteralPath $logPath
    }
    $state = (Get-WindowsCapability -Online -Name $name).State
    "$language $feature`: $state" | Add-Content -LiteralPath $logPath
  }
}

"Speech installation finished: $(Get-Date -Format o)" | Add-Content -LiteralPath $logPath
