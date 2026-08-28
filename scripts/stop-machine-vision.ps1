$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.machine-vision.pid'

if (-not (Test-Path -LiteralPath $pidFile)) {
  Write-Host 'Machine Vision is already stopped.'
  exit 0
}

$serverPid = [int](Get-Content -LiteralPath $pidFile -Raw)
$server = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($server -and $server.ProcessName -eq 'node') {
  Stop-Process -Id $serverPid
  Write-Host 'Machine Vision stopped.'
} else {
  Write-Host 'The recorded server process is no longer running.'
}

Remove-Item -LiteralPath $pidFile -ErrorAction SilentlyContinue
