param(
  [string]$RunId = 'evolution-continuous',
  [ValidateSet('smoke', 'local', 'full')]
  [string]$Mode = 'local',
  [ValidateRange(1, 50)]
  [int]$GenerationsPerBatch = 5
)

$ErrorActionPreference = 'Stop'
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
    & node --loader ./scripts/ai-training-loader.mjs scripts/run-ai-evolution.mjs $operation $Mode *>> $logPath
    if ($LASTEXITCODE -ne 0) { throw "Evolution batch exited with code $LASTEXITCODE" }
  }
  finally {
    Remove-Item Env:AI_TRAINING_RUN_ID -ErrorAction SilentlyContinue
    Remove-Item Env:AI_TRAINING_GENERATIONS -ErrorAction SilentlyContinue
    Pop-Location
  }
  Add-Content -LiteralPath $logPath -Value "[$(Get-Date -Format 'o')] COMPLETE target=$target"
}

Add-Content -LiteralPath $logPath -Value "[$(Get-Date -Format 'o')] STOP requested"
