# Manual hardware benchmark for PR #212. Requires Windows, Git, Python 3,
# Node.js 22+, Microsoft Edge, and an actual D3D11-capable graphics adapter.
# Run from PowerShell: pwsh -File .\tools\alaska\run-relief-gpu-bench.ps1
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $root
$server = $null
try {
  foreach ($exe in @('git','node','npm','python')) {
    if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) {
      throw "Missing command: $exe"
    }
  }
  $sha = '38a9be192ca14cf5d47f6991d050b4093357f044'
  git cat-file -e ($sha + ':index.html')
  if ($LASTEXITCODE -ne 0) {
    throw "Missing exact comparison commit $sha. Fetch the integration history first; do not benchmark another baseline."
  }
  npm install --no-save --no-audit --no-fund playwright@1.56.1
  if ($LASTEXITCODE -ne 0) { throw 'Playwright npm install failed' }
  $server = Start-Process -FilePath 'python' -ArgumentList @(
    '-m','http.server','8765','--bind','127.0.0.1'
  ) -WorkingDirectory $root -WindowStyle Hidden -PassThru
  $ready = $false
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    try {
      $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8765/index.html' -TimeoutSec 2 -UseBasicParsing
      if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 400 }
  }
  if (-not $ready) { throw 'Local PATROL HTTP server failed to start' }
  # Actual Edge is launched visibly; the script rejects SwiftShader results.
  node tools/alaska/benchmark_relief_windows_gpu.mjs
  if ($LASTEXITCODE -ne 0) {
    throw 'Hardware GPU gate not verified. Inspect artifacts/alaska-relief-hardware-gpu.json; no performance PASS may be claimed.'
  }
  Write-Host 'GPU sample collection succeeded. Review the JSON p50/p95 and paired PNGs before approving PR #212.'
} finally {
  if ($server) { Stop-Process -Id $server.Id -ErrorAction SilentlyContinue }
  Pop-Location
}
