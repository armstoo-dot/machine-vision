param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:5173/'
$pidFile = Join-Path $projectRoot '.machine-vision.pid'
$stdoutLog = Join-Path $projectRoot '.machine-vision.out.log'
$stderrLog = Join-Path $projectRoot '.machine-vision.err.log'

function Test-MachineVisionServer {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-MachineVisionServer)) {
  $bundledNode = 'C:\Users\WIN11\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  $nodePath = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } elseif ($nodeCommand) { $nodeCommand.Source } else { '' }
  $vitePath = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'

  if (-not (Test-Path -LiteralPath $nodePath)) {
    Write-Error 'Node.js was not found. Install Node.js 22 or run the project from Codex.'
  }
  if (-not (Test-Path -LiteralPath $vitePath)) {
    Write-Error 'Project dependencies are missing. Run pnpm install once.'
  }

  $server = Start-Process `
    -FilePath $nodePath `
    -ArgumentList @("`"$vitePath`"", '--host', '127.0.0.1') `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

  Set-Content -LiteralPath $pidFile -Value $server.Id

  $started = $false
  for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-MachineVisionServer) {
      $started = $true
      break
    }
    if ($server.HasExited) { break }
  }

  if (-not $started) {
    Write-Host 'Machine Vision did not start.'
    if (Test-Path -LiteralPath $stderrLog) { Get-Content -LiteralPath $stderrLog -Tail 30 }
    exit 1
  }
}

Write-Host "Machine Vision is running at $url"
if (-not $NoBrowser) {
  Start-Process $url
}
