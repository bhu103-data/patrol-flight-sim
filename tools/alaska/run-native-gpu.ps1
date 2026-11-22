# Repeat the Alaska parent-vs-child GPU RAF benchmark on a Windows PC.
# Requires installed Node.js, Python, Git, and Microsoft Edge. No paid APIs.
# Do not confuse RAF display pacing with actual GPU execution duration.
[CmdletBinding()]
param(
  [ValidateRange(1, 5)][int]$Runs = 3,
  [Nullable[double]]$P95BudgetMs = $null,
  [Nullable[double]]$MaxP95RegressionPct = $null
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$branch = 'feature/alaska-floe-pbr-snowcap-20261121-chat'
$parent = '04e990de7567c43431e0285042d5b2fdfb32556f'
$originalEnv = @{}
$server = $null
$envNames = @('PATROL_NATIVE_GPU','PATROL_BROWSER_CHANNEL',
  'PATROL_BASELINE_SHA','PATROL_NATIVE_P95_BUDGET_MS',
  'PATROL_NATIVE_MAX_P95_REGRESSION_PCT')
foreach ($name in $envNames) {
  $originalEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

Push-Location $repoRoot
try {
  foreach ($cmd in @('node','npm','git','python')) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
      throw "Missing '$cmd'. Install it before running this local GPU benchmark."
    }
  }

  $current = (& git branch --show-current).Trim()
  if ($LASTEXITCODE -ne 0 -or $current -ne $branch) {
    throw "Expected branch '$branch', got '$current'. Checkout the draft PR branch first."
  }
  & git cat-file -e "$parent^{commit}"
  if ($LASTEXITCODE -ne 0) {
    throw "Missing parent #153 commit $parent; fetch the project repository first."
  }

  # Package-lock and package.json are not updated.
  & npm install --no-save --no-package-lock --no-audit --no-fund playwright@1.56.1
  if ($LASTEXITCODE -ne 0) { throw 'Playwright installation failed' }

  $env:PATROL_NATIVE_GPU = '1'
  $env:PATROL_BROWSER_CHANNEL = 'msedge'
  $env:PATROL_BASELINE_SHA = $parent
  [Environment]::SetEnvironmentVariable('PATROL_NATIVE_P95_BUDGET_MS', $null, 'Process')
  [Environment]::SetEnvironmentVariable('PATROL_NATIVE_MAX_P95_REGRESSION_PCT', $null, 'Process')
  if ($null -ne $P95BudgetMs) {
    if (([double]$P95BudgetMs) -le 0) { throw 'P95BudgetMs must be positive' }
    $env:PATROL_NATIVE_P95_BUDGET_MS =
      ([double]$P95BudgetMs).ToString([Globalization.CultureInfo]::InvariantCulture)
  }
  if ($null -ne $MaxP95RegressionPct) {
    if (([double]$MaxP95RegressionPct) -le 0) {
      throw 'MaxP95RegressionPct must be positive'
    }
    $env:PATROL_NATIVE_MAX_P95_REGRESSION_PCT =
      ([double]$MaxP95RegressionPct).ToString([Globalization.CultureInfo]::InvariantCulture)
  }

  $python = (Get-Command python).Source
  $server = Start-Process -FilePath $python -ArgumentList @(
    '-m','http.server','8765','--bind','127.0.0.1'
  ) -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru

  $ready = $false
  for ($attempt=0; $attempt -lt 30; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8765/index.html' -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -eq 200) { $ready=$true; break }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if (-not $ready) { throw 'Local PATROL HTTP server did not start on port 8765' }

  $reportDir = Join-Path $repoRoot 'artifacts'
  New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
  $trials = @()
  for ($n=1; $n -le $Runs; $n++) {
    Write-Host "Physical Edge GPU trial $n/$Runs (parent #153 vs #176)"
    & node tools/alaska/compare_harbor_baseline.mjs
    if ($LASTEXITCODE -ne 0) {
      throw "Native benchmark trial $n failed; inspect artifacts/alaska-cabin-port-camera.json"
    }
    $from = Join-Path $reportDir 'alaska-cabin-port-camera.json'
    if (-not (Test-Path $from)) { throw "Native report not found at $from" }
    $data = Get-Content -LiteralPath $from -Raw | ConvertFrom-Json
    if ($data.captureMode -ne 'physical-gpu-raf' -or
        $null -eq $data.nativeGpuAssessment) {
      throw "Trial $n did not prove a physical-GPU renderer"
    }
    $file = Join-Path $reportDir ('alaska-native-run-{0:D2}.json' -f $n)
    Copy-Item -LiteralPath $from -Destination $file -Force
    $trials += [pscustomobject]@{
      run = $n
      gpu = $data.updated.gpu.renderer
      status = $data.nativeGpuAssessment.status
      baselineP95Ms = $data.nativeGpuAssessment.baseline.p95Ms
      candidateP95Ms = $data.nativeGpuAssessment.candidate.p95Ms
      p95RegressionPct = $data.nativeGpuAssessment.p95RegressionPct
      firstPlayableDeltaMs = $data.nativeGpuAssessment.firstPlayableDeltaMs
      artifact = [IO.Path]::GetFileName($file)
    }
  }

  $summary = [ordered]@{
    baselineSha = $parent
    candidateBranch = $branch
    mode = 'physical Edge GPU RAF pacing'
    physicalGpuTimerQueryMeasured = $false
    repeatedTrials = $Runs
    acceptance = 'Review all trials; RAF is not hardware GPU render duration'
    results = $trials
  }
  $output = Join-Path $reportDir 'alaska-native-summary.json'
  $summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $output -Encoding UTF8
  Write-Host "Completed $Runs physical GPU trial(s). Report: $output"
} finally {
  if ($null -ne $server) {
    Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($name in $envNames) {
    [Environment]::SetEnvironmentVariable($name, $originalEnv[$name], 'Process')
  }
  Pop-Location
}
