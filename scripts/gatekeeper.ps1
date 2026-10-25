# Deterministic Phase-4 gatekeeper (Windows). Exit non-zero on failure. Zero LLM tokens.

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

function Invoke-Checked {
  param([string]$Label, [scriptblock]$Command)
  Write-Host "==> $Label"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Gatekeeper step failed: $Label (exit $LASTEXITCODE)"
  }
}

Write-Host "==> Gatekeeper stack: node (pnpm workspace)"

Invoke-Checked "pnpm lint (biome check)" { pnpm lint }
Invoke-Checked "pnpm typecheck" { pnpm typecheck }
Invoke-Checked "pnpm test" { pnpm test }

if (Get-Command semgrep -ErrorAction SilentlyContinue) {
  Invoke-Checked "semgrep" { semgrep scan --config auto --error }
} else {
  Write-Host "WARN: semgrep not installed (accepted for local harness)"
}

Write-Host "==> Gatekeeper passed"
