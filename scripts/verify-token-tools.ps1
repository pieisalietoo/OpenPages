# Verify token-control / context-hygiene tooling. Run as TASKS.md item 1.
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root
$Fail = 0
function Ok([string]$m) { Write-Host "OK: $m" }
function Warn([string]$m) { Write-Host "WARN: $m" }
function Fail([string]$m) { Write-Host "FAIL: $m"; $script:Fail = 1 }

Write-Host ("==> Token-tools verification ({0})" -f $Root)

if (Test-Path ".cursorignore") { Ok ".cursorignore present" } else { Fail ".cursorignore missing" }

$patterns = @("node_modules", ".venv", "dist", "build", "coverage", ".env", "artifacts", "repomap", "lock")
if (Test-Path ".cursorignore") {
  $ci = Get-Content ".cursorignore" -Raw
  foreach ($p in $patterns) {
    if ($ci -match [regex]::Escape($p)) { Ok (".cursorignore mentions {0}" -f $p) }
    else { Warn (".cursorignore may not cover {0} (check manually)" -f $p) }
  }
}

if (Test-Path ".gitignore") {
  $gi = Get-Content ".gitignore" -Raw
  if ($gi -match "repomap") { Ok ".gitignore mentions repomap/" }
  else { Fail ".gitignore missing repomap/" }
} else {
  Fail ".gitignore missing"
}

if (Test-Path "repomix.config.json") { Ok "repomix.config.json present" } else { Fail "repomix.config.json missing" }

if (Test-Path ".cursor/rules/tdd-pipeline.mdc") { Ok "tdd-pipeline.mdc" } else { Fail "missing .cursor/rules/tdd-pipeline.mdc" }
if (Test-Path ".cursor/rules/minimal-code.mdc") { Ok "minimal-code.mdc" } else { Fail "missing .cursor/rules/minimal-code.mdc" }
if (Test-Path "tdd-evidence") { Ok "tdd-evidence/ present" } else { Fail "missing tdd-evidence/ (RED/GREEN evidence logs)" }

if (Get-Command rg -ErrorAction SilentlyContinue) { Ok "ripgrep (rg)" } else { Fail "ripgrep (rg) not in PATH" }

if (Get-Command repomix -ErrorAction SilentlyContinue) {
  Ok "repomix available"
  New-Item -ItemType Directory -Force -Path "repomap" | Out-Null
  try {
    repomix 2>$null | Out-Null
    if (Test-Path "repomap/repo-map.md") { Ok "repomix smoke -> repomap/repo-map.md" }
    else { Warn "repomix smoke produced no file (empty repo is OK)" }
  } catch { Warn "repomix smoke failed (empty repo is OK)" }
} else {
  Fail "repomix not installed (npm i -g repomix)"
}

$docs = @(
  "docs/agentic-tdd-workflow.md",
  "docs/tooling-catalog.md",
  "docs/fiscal-and-legal.md"
)
$missing = $docs | Where-Object { -not (Test-Path $_) }
if ($missing.Count -eq 0) { Ok "workflow + tooling + fiscal docs present" }
else { Fail ("missing docs: {0}" -f ($missing -join ", ")) }

if ($Fail -ne 0) {
  Write-Host "==> FAILED - fix before architecture / MVP work"
  exit 1
}
Write-Host "==> PASSED"
