$ErrorActionPreference = 'Continue'

$logPath = Join-Path $env:TEMP 'aios-language-voices.log'
$capabilities = @(
  'Language.TextToSpeech~~~ta-IN~0.0.1.0'
  'Language.TextToSpeech~~~mr-IN~0.0.1.0'
  'Language.TextToSpeech~~~te-IN~0.0.1.0'
  'Language.TextToSpeech~~~ml-IN~0.0.1.0'
)

"Lampstand Project language voice installation started: $(Get-Date -Format o)" | Set-Content $logPath

foreach ($capability in $capabilities) {
  "Installing $capability" | Tee-Object -FilePath $logPath -Append
  try {
    Add-WindowsCapability -Online -Name $capability -ErrorAction Stop |
      Select-Object Online, RestartNeeded |
      Format-List |
      Out-String |
      Tee-Object -FilePath $logPath -Append
  } catch {
    "FAILED: $($_.Exception.Message)" | Tee-Object -FilePath $logPath -Append
  }
}

"Final status:" | Tee-Object -FilePath $logPath -Append
Get-WindowsCapability -Online |
  Where-Object { $_.Name -in $capabilities } |
  Select-Object Name, State |
  Format-Table -AutoSize |
  Out-String |
  Tee-Object -FilePath $logPath -Append

"Installation finished. You may close this window." | Tee-Object -FilePath $logPath -Append
Read-Host 'Press Enter to close'
