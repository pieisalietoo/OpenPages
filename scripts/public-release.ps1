#Requires -Version 7
<#
.SYNOPSIS
  Push + tag the public mirror. npm publish is done by GitHub Actions (trusted publisher).
  Idempotent: safe to re-run if push/tag already done.
.EXAMPLE
  pwsh -File scripts/public-release.ps1 [-F]
#>
param(
  [Alias('F')]
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$MirrorRoot = 'E:\Projects\OpenPagesPublic'
$PackageJson = Join-Path $MirrorRoot 'packages\open-pages\package.json'
$Changelog = Join-Path $MirrorRoot 'CHANGELOG.md'

Import-Module (Join-Path $PSScriptRoot 'lib\PublicRelease.psm1') -Force

Assert-OffHoursOrForce -Force:$Force

if (-not (Test-Path -LiteralPath $MirrorRoot)) {
  throw "Mirror missing: $MirrorRoot — run public-sync.ps1 first."
}

if (-not (Test-Path -LiteralPath $PackageJson)) {
  throw "Missing $PackageJson"
}
$version = Get-PackageVersion -PackageJsonText (Get-Content -LiteralPath $PackageJson -Raw)
$tag = "v$version"

if (-not (Test-Path -LiteralPath $Changelog)) {
  throw "Missing CHANGELOG.md in mirror."
}
$clText = Get-Content -LiteralPath $Changelog -Raw
if (-not (Test-ChangelogHasVersion -ChangelogText $clText -Version $version)) {
  throw "CHANGELOG.md has no ## heading containing version $version."
}

# npm published version (source of truth for "already released")
$npmVer = $null
$npmOut = npm view @openpages/vue version 2>&1
if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace("$npmOut")) {
  $npmVer = "$npmOut".Trim()
}
if ($npmVer -eq $version) {
  throw "Already on npm: @openpages/vue@$version — bump version + changelog, then sync."
}

Push-Location $MirrorRoot
try {
  $porcelain = git status --porcelain
  if (-not [string]::IsNullOrWhiteSpace($porcelain)) {
    throw 'Mirror working tree is dirty. Commit via public-sync.ps1 first.'
  }

  git fetch origin --tags 2>&1 | Out-Null

  $head = (git rev-parse HEAD).Trim()

  $tagList = @(git tag --list 'v*' --sort=-v:refname)
  $lastTag = if ($tagList.Count -gt 0) { $tagList[0] } else { $null }
  $lastTagVer = $null
  if ($lastTag -match '^v(.+)$') { $lastTagVer = $Matches[1] }

  $localTagCommit = $null
  $localTag = git rev-parse -q --verify "refs/tags/$tag" 2>$null
  if ($LASTEXITCODE -eq 0 -and $localTag) {
    $localTagCommit = (git rev-list -n 1 $tag).Trim()
  }

  $remoteHasTag = $false
  $remoteTagLine = git ls-remote --tags origin "refs/tags/$tag" 2>$null
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace("$remoteTagLine")) {
    $remoteHasTag = $true
  }

  # First release (nothing on npm, no version tags yet) requires -F
  if (-not $npmVer -and -not $lastTagVer -and -not $localTagCommit -and -not $remoteHasTag -and -not $Force) {
    throw 'First release (no npm package / no version tags). Re-run with -F.'
  }

  if ($lastTagVer -eq $version -and -not $npmVer) {
    Write-Host "==> tag $tag already set; npm publish is via GitHub Actions (trusted publisher)"
  } elseif ($lastTagVer -and $lastTagVer -eq $version) {
    throw "package.json version $version equals last GitHub tag $lastTag — bump first."
  }

  $unpushed = 0
  git rev-parse --abbrev-ref '@{u}' 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    $unpushed = [int](git rev-list --count '@{u}..HEAD')
  } else {
    $unpushed = [int](git rev-list --count 'HEAD')
  }
  if ($unpushed -ge 1) {
    Write-Host "==> git push (ahead by $unpushed)"
    git push
    if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
  } else {
    Write-Host '==> git push skipped (already up to date with upstream)'
  }

  if ($localTagCommit) {
    if ($localTagCommit -ne $head) {
      throw "Tag $tag exists but points to $localTagCommit, not HEAD $head."
    }
    Write-Host "==> git tag $tag skipped (already on HEAD)"
  } else {
    Write-Host "==> git tag $tag"
    git tag $tag
    if ($LASTEXITCODE -ne 0) { throw 'git tag failed' }
  }

  if ($remoteHasTag) {
    Write-Host "==> git push tag $tag skipped (already on origin)"
  } else {
    Write-Host "==> git push origin $tag"
    git push origin $tag
    if ($LASTEXITCODE -ne 0) { throw 'git push tag failed' }
  }
} finally {
  Pop-Location
}

Write-Host "==> GitHub tag $tag ready. npm publish runs in Actions (.github/workflows/publish.yml)."
Write-Host "    Watch: https://github.com/pieisalietoo/OpenPages/actions"
