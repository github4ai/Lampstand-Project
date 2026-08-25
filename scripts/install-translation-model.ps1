$ErrorActionPreference = 'Stop'
$model = if ($env:OLLAMA_TRANSLATION_MODEL) { $env:OLLAMA_TRANSLATION_MODEL } else { 'translategemma:4b' }
$payload = @{ model = $model; stream = $false } | ConvertTo-Json
$started = Get-Date
Write-Output "Downloading $model through the local Ollama service..."
$result = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:11434/api/pull' -ContentType 'application/json' -Body $payload -TimeoutSec 7200
if ($result.status -ne 'success') { throw "Ollama did not confirm the translation model download." }
Write-Output "$model is ready. Completed in $([math]::Round(((Get-Date) - $started).TotalMinutes, 1)) minutes."
