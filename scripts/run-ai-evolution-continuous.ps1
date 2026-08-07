param(
  [string]$RunId = 'evolution-continuous',
  [ValidateSet('smoke', 'local', 'full')]
  [string]$Mode = 'local',
  [ValidateRange(1, 50)]
  [int]$GenerationsPerBatch = 5
)

$ErrorActionPreference = 'Stop'
# Node writes loader warnings to stderr. They are diagnostics, not a failed
# evolution batch, so do not let PowerShell promote them to terminating errors.
$PSNativeCommandUseErrorActionPreference = $false
$workspace = Split-Path -Parent $PSScriptRoot
$checkpointRoot = Join-Path $workspace "data\ai\training\checkpoints\$RunId"
$snapshotPath = Join-Path $checkpointRoot 'checkpoint.json'
$stopPath = Join-Path $workspace "data\ai\training\stop\$RunId.stop"
$logPath = Join-Path $workspace "reports\ai\$RunId.continuous.log"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $stopPath), (Split-Path -Parent $logPath) | Out-Null

while (-not (Test-Path -LiteralPath $stopPath)) {
  $completed = 0
  $operation = 'train'
  if (Test-Path -LiteralPath $snapshotPath) {
    $snapshot = Get-Content -LiteralPath $snapshotPath -Raw | ConvertFrom-Json
    $completed = @($snapshot.completedGenerations).Count
    $operation = 'resume'
  }
  $target = $completed + $GenerationsPerBatch
  $stamp = Get-Date -Format 'o'
  Add-Content -LiteralPath $logPath -Value "[$stamp] START operation=$operation completed=$completed target=$target"
  Push-Location $workspace
  try {
    $env:AI_TRAINING_RUN_ID = $RunId
    $env:AI_TRAINING_GENERATIONS = "$target"
    # Windows PowerShell 5.1 promotes Node's loader warning on stderr to a
    # native error record when ErrorActionPreference is Stop. Keep normal
    # PowerShell failures strict, but let Node's actual exit code decide this
    # child process outcome.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & node --loader ./scripts/ai-training-loader.mjs scripts/run-ai-evolution.mjs $operation $Mode *>> $logPath
    $nodeExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($nodeExitCode -ne 0) { throw "Evolution batch exited with code $nodeExitCode" }
  }
  finally {
    Remove-Item Env:AI_TRAINING_RUN_ID -ErrorAction SilentlyContinue
    Remove-Item Env:AI_TRAINING_GENERATIONS -ErrorAction SilentlyContinue
    Pop-Location
  }
  Add-Content -LiteralPath $logPath -Value "[$(Get-Date -Format 'o')] COMPLETE target=$target"
}

Add-Content -LiteralPath $logPath -Value "[$(Get-Date -Format 'o')] STOP requested"
