# Unit tests for PublicRelease.psm1 (TDD). Exit non-zero on failure.
$ErrorActionPreference = 'Stop'
$failed = 0
$passed = 0

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if ($Condition) {
    $script:passed++
    Write-Host "  PASS: $Message"
  } else {
    $script:failed++
    Write-Host "  FAIL: $Message"
  }
}

function Assert-Equal {
  param($Expected, $Actual, [string]$Message)
  if ($Expected -eq $Actual) {
    $script:passed++
    Write-Host "  PASS: $Message"
  } else {
    $script:failed++
    Write-Host "  FAIL: $Message (expected='$Expected' actual='$Actual')"
  }
}

$modulePath = Join-Path $PSScriptRoot '..\lib\PublicRelease.psm1'
if (-not (Test-Path $modulePath)) {
  Write-Host "FAIL: module not found at $modulePath"
  exit 1
}

Import-Module $modulePath -Force

Write-Host '--- IsItalianHoliday ---'
Assert-True (Test-ItalianHoliday ([datetime]'2026-01-01')) 'New Year 2026'
Assert-True (Test-ItalianHoliday ([datetime]'2026-01-06')) 'Epiphany 2026'
Assert-True (Test-ItalianHoliday ([datetime]'2026-04-05')) 'Easter Sunday 2026'
Assert-True (Test-ItalianHoliday ([datetime]'2026-04-06')) 'Easter Monday 2026'
Assert-True (-not (Test-ItalianHoliday ([datetime]'2026-04-07'))) 'Tue after Easter not holiday'
Assert-True (Test-ItalianHoliday ([datetime]'2026-12-25')) 'Christmas'
Assert-True (Test-ItalianHoliday ([datetime]'2026-12-26')) 'St Stephen'

Write-Host '--- Test-WorkTime ---'
# Mon 2026-09-28 10:00 Rome-equivalent local DateTime (tests pass DateTime already in Rome wall clock)
Assert-True (Test-WorkTime ([datetime]'2026-09-28 10:00:00')) 'weekday mid-morning is work'
Assert-True (-not (Test-WorkTime ([datetime]'2026-09-28 07:59:00'))) 'before 08:00 not work'
Assert-True (-not (Test-WorkTime ([datetime]'2026-09-28 18:00:00'))) '18:00 not work'
Assert-True (-not (Test-WorkTime ([datetime]'2026-09-26 10:00:00'))) 'Saturday not work'
Assert-True (-not (Test-WorkTime ([datetime]'2026-01-01 10:00:00'))) 'holiday weekday not work'

Write-Host '--- Resolve-CommitTimestamp ---'
$nowOff = [datetime]'2026-09-26 21:30:00' # Saturday evening
$tsOff = Resolve-CommitTimestamp -Now $nowOff -RandomSeed 1
Assert-Equal $nowOff $tsOff 'off-hours now is used as-is'

$nowWork = [datetime]'2026-09-28 10:00:00' # Monday morning
$tsWork = Resolve-CommitTimestamp -Now $nowWork -RandomSeed 42
Assert-True ($tsWork -lt $nowWork) 'work-time resolves to earlier evening'
Assert-True (-not (Test-WorkTime $tsWork)) 'resolved timestamp is not work time'
Assert-True ($tsWork.Hour -ge 20 -and $tsWork.Hour -le 23) 'hour in [20,23]'

$tsWork2 = Resolve-CommitTimestamp -Now $nowWork -RandomSeed 42
Assert-Equal $tsWork $tsWork2 'same seed yields same timestamp'

Write-Host '--- Test-ChangelogHasVersion ---'
$cl = @"
# Changelog
## [0.2.0] - 2026-09-27
### Added
- stuff
## [0.1.0] - 2026-09-01
"@
Assert-True (Test-ChangelogHasVersion -ChangelogText $cl -Version '0.2.0') 'heading with [0.2.0]'
Assert-True (Test-ChangelogHasVersion -ChangelogText $cl -Version '0.1.0') 'heading with [0.1.0]'
Assert-True (-not (Test-ChangelogHasVersion -ChangelogText $cl -Version '0.3.0')) 'missing version'

$cl2 = @"
# Changelog
## v0.4.0
notes
"@
Assert-True (Test-ChangelogHasVersion -ChangelogText $cl2 -Version '0.4.0') 'heading with v0.4.0'

Write-Host '--- Test-PublicExcludePath ---'
$patterns = @(
  '.cursor/',
  '.cursorignore',
  'docs/',
  'TASKS.md',
  'BOOTSTRAP.md',
  'tdd-evidence/',
  'repomap/',
  '.repomix/',
  'scripts/gatekeeper.*',
  'scripts/verify-token-tools.*',
  'scripts/public-*',
  'scripts/lib/PublicRelease.psm1',
  'scripts/public-exclude.txt',
  'scripts/tests/',
  'node_modules/',
  'dist/',
  'coverage/',
  '.turbo/'
)
Assert-True (Test-PublicExcludePath -RelativePath 'docs/PLAN.md' -Patterns $patterns) 'docs/ excluded'
Assert-True (Test-PublicExcludePath -RelativePath 'TASKS.md' -Patterns $patterns) 'TASKS.md excluded'
Assert-True (Test-PublicExcludePath -RelativePath 'scripts/gatekeeper.ps1' -Patterns $patterns) 'gatekeeper excluded'
Assert-True (Test-PublicExcludePath -RelativePath 'scripts/public-sync.ps1' -Patterns $patterns) 'public-sync excluded'
Assert-True (Test-PublicExcludePath -RelativePath 'packages/open-pages/node_modules/x' -Patterns $patterns) 'nested node_modules'
Assert-True (-not (Test-PublicExcludePath -RelativePath 'packages/open-pages/src/index.ts' -Patterns $patterns)) 'src included'
Assert-True (-not (Test-PublicExcludePath -RelativePath 'apps/demo/src/App.vue' -Patterns $patterns)) 'demo included'
Assert-True (-not (Test-PublicExcludePath -RelativePath 'CHANGELOG.md' -Patterns $patterns)) 'CHANGELOG included'
Assert-True (Test-PublicExcludePath -RelativePath '.git/config' -Patterns @('.git/')) '.git excluded when listed'

Write-Host '--- Sync-PublicMirror clean skips exclude ---'
$syncRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("op-sync-" + [guid]::NewGuid().ToString('n'))
$src = Join-Path $syncRoot 'src'
$dst = Join-Path $syncRoot 'dst'
try {
  New-Item -ItemType Directory -Path (Join-Path $src 'pkg') -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $src 'pkg\keep.txt') -Value 'keep' -Encoding utf8
  New-Item -ItemType Directory -Path (Join-Path $dst 'pkg') -Force | Out-Null
  Set-Content -LiteralPath (Join-Path $dst 'pkg\orphan.txt') -Value 'gone' -Encoding utf8
  # Leftover excluded tree with a dangling junction (reproduces mirror Get-ChildItem crash)
  $nm = Join-Path $dst 'node_modules\.pnpm\pkg\node_modules\@scope'
  New-Item -ItemType Directory -Path $nm -Force | Out-Null
  $missingTarget = Join-Path $syncRoot 'missing-target-dir'
  $junction = Join-Path $nm 'broken-pkg'
  cmd /c "mklink /J `"$junction`" `"$missingTarget`"" | Out-Null
  Assert-True (Test-Path -LiteralPath $junction) 'dangling junction created'
  $syncOk = $true
  try {
    Sync-PublicMirror -SourceRoot $src -DestRoot $dst -ExcludePatterns @('node_modules/')
  } catch {
    $syncOk = $false
    Write-Host "  sync threw: $($_.Exception.Message)"
  }
  Assert-True $syncOk 'sync completes despite dangling junction under node_modules'
  Assert-True (Test-Path -LiteralPath (Join-Path $dst 'pkg\keep.txt')) 'copied keep.txt'
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $dst 'pkg\orphan.txt'))) 'deleted non-excluded orphan'
  Assert-True (Test-Path -LiteralPath $junction) 'excluded node_modules left untouched'
} finally {
  if (Test-Path -LiteralPath $syncRoot) {
    cmd /c "rmdir /s /q `"$syncRoot`"" | Out-Null
  }
}

Write-Host '--- Get-PackageVersion ---'
$pkgJson = '{"name":"@openpages/vue","version":"0.2.0"}'
Assert-Equal '0.2.0' (Get-PackageVersion -PackageJsonText $pkgJson) 'reads version field'

Write-Host '--- Remove-PackageJsonScriptsReferencingScripts ---'
$rootPkg = @'
{
  "name": "openpages-monorepo",
  "scripts": {
    "lint": "biome check .",
    "demo": "pnpm --filter @openpages/demo dev",
    "gatekeeper": "pwsh -File scripts/gatekeeper.ps1",
    "public:sync": "pwsh -File scripts/public-sync.ps1",
    "public:release": "pwsh -File scripts/public-release.ps1",
    "test:public-scripts": "pwsh -File scripts/tests/PublicRelease.Tests.ps1"
  }
}
'@
$stripped = Remove-PackageJsonScriptsReferencingScripts -PackageJsonText $rootPkg
Assert-True ($stripped -match '"lint"') 'keeps lint'
Assert-True ($stripped -match '"demo"') 'keeps demo'
Assert-True ($stripped -notmatch 'gatekeeper') 'drops gatekeeper'
Assert-True ($stripped -notmatch 'public:sync') 'drops public:sync'
Assert-True ($stripped -notmatch 'public:release') 'drops public:release'
Assert-True ($stripped -notmatch 'test:public-scripts') 'drops test:public-scripts'
Assert-True ($stripped -notmatch 'scripts/') 'no scripts/ path left in values'

Write-Host ''
Write-Host "Passed: $passed  Failed: $failed"
if ($failed -gt 0) { exit 1 }
exit 0
