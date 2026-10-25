#Requires -Version 7
<#
.SYNOPSIS
  Sync private OpenPages tree into E:\Projects\OpenPagesPublic and commit (no push).
.EXAMPLE
  pwsh -File scripts/public-sync.ps1 "Describe the change" [-F]
#>
param(
  [Parameter(Position = 0)]
  [string]$Message,

  [Alias('F')]
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$PrivateRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$MirrorRoot = 'E:\Projects\OpenPagesPublic'
$PublicRemote = 'git@github.com:pieisalietoo/OpenPages.git'
$ExcludeFile = Join-Path $PSScriptRoot 'public-exclude.txt'

Import-Module (Join-Path $PSScriptRoot 'lib\PublicRelease.psm1') -Force

if ([string]::IsNullOrWhiteSpace($Message)) {
  Write-Error 'Commit message is required. Usage: pwsh -File scripts/public-sync.ps1 "message" [-F]'
  exit 1
}

Assert-OffHoursOrForce -Force:$Force

Write-Host '==> gatekeeper (private)'
Push-Location $PrivateRoot
try {
  pnpm gatekeeper
  if ($LASTEXITCODE -ne 0) { throw "gatekeeper failed with exit $LASTEXITCODE" }
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $MirrorRoot)) {
  Write-Host "==> cloning $PublicRemote -> $MirrorRoot"
  $parent = Split-Path -Parent $MirrorRoot
  if (-not (Test-Path -LiteralPath $parent)) {
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
  }
  git clone $PublicRemote $MirrorRoot
  if ($LASTEXITCODE -ne 0) { throw 'git clone failed' }
}

$patterns = @(Read-PublicExcludePatterns -Path $ExcludeFile)
Write-Host "==> syncing $PrivateRoot -> $MirrorRoot (clean mirror)"
Sync-PublicMirror -SourceRoot $PrivateRoot -DestRoot $MirrorRoot -ExcludePatterns $patterns

Write-Host '==> strip package.json scripts that reference scripts/'
Update-PublicPackageJsonScripts -MirrorRoot $MirrorRoot

$stamp = Resolve-CommitTimestamp -Now (Get-RomeNow)
Write-Host "==> touch dirty mtimes -> $($stamp.ToString('yyyy-MM-dd HH:mm:ss'))"
Update-DirtyFileTimes -Root $MirrorRoot -Timestamp $stamp

Push-Location $MirrorRoot
try {
  git add -A
  $status = git status --porcelain
  if ([string]::IsNullOrWhiteSpace($status)) {
    throw 'Nothing to commit after sync (working tree clean).'
  }

  $env:GIT_AUTHOR_NAME = 'pieisalietoo'
  $env:GIT_AUTHOR_EMAIL = 'pieisalietoo@gmail.com'
  $env:GIT_COMMITTER_NAME = 'pieisalietoo'
  $env:GIT_COMMITTER_EMAIL = 'pieisalietoo@gmail.com'
  $gitDate = Format-GitDate -DateTime $stamp
  $env:GIT_AUTHOR_DATE = $gitDate
  $env:GIT_COMMITTER_DATE = $gitDate

  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }

  Write-Host "==> committed locally in $MirrorRoot (no push). Run public-release.ps1 to push/tag/npm."
} finally {
  Remove-Item Env:GIT_AUTHOR_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:GIT_AUTHOR_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:GIT_COMMITTER_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:GIT_COMMITTER_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:GIT_AUTHOR_DATE -ErrorAction SilentlyContinue
  Remove-Item Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue
  Pop-Location
}
