# Shared helpers for public-sync / public-release (private repo only).
Set-StrictMode -Version Latest

function Get-RomeNow {
  $tz = [TimeZoneInfo]::FindSystemTimeZoneById(
    $(if ($IsWindows -or $env:OS -match 'Windows') { 'W. Europe Standard Time' } else { 'Europe/Rome' })
  )
  return [TimeZoneInfo]::ConvertTimeFromUtc([datetime]::UtcNow, $tz)
}

function Get-EasterSunday {
  param([Parameter(Mandatory)][int]$Year)
  # Anonymous Gregorian algorithm (Meeus/Jones/Butcher)
  $a = $Year % 19
  $b = [math]::Floor($Year / 100)
  $c = $Year % 100
  $d = [math]::Floor($b / 4)
  $e = $b % 4
  $f = [math]::Floor(($b + 8) / 25)
  $g = [math]::Floor(($b - $f + 1) / 3)
  $h = (19 * $a + $b - $d - $g + 15) % 30
  $i = [math]::Floor($c / 4)
  $k = $c % 4
  $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7
  $m = [math]::Floor(($a + 11 * $h + 22 * $l) / 451)
  $month = [math]::Floor(($h + $l - 7 * $m + 114) / 31)
  $day = (($h + $l - 7 * $m + 114) % 31) + 1
  return [datetime]::new($Year, $month, $day)
}

function Test-ItalianHoliday {
  param([Parameter(Mandatory)][datetime]$Date)
  $d = $Date.Date
  $fixed = @(
    @{ M = 1; D = 1 },
    @{ M = 1; D = 6 },
    @{ M = 4; D = 25 },
    @{ M = 5; D = 1 },
    @{ M = 6; D = 2 },
    @{ M = 8; D = 15 },
    @{ M = 11; D = 1 },
    @{ M = 12; D = 8 },
    @{ M = 12; D = 25 },
    @{ M = 12; D = 26 }
  )
  foreach ($f in $fixed) {
    if ($d.Month -eq $f.M -and $d.Day -eq $f.D) { return $true }
  }
  $easter = Get-EasterSunday -Year $d.Year
  if ($d -eq $easter.Date) { return $true }
  if ($d -eq $easter.Date.AddDays(1)) { return $true }
  return $false
}

function Test-WorkTime {
  param([Parameter(Mandatory)][datetime]$DateTime)
  $dow = $DateTime.DayOfWeek
  if ($dow -eq [DayOfWeek]::Saturday -or $dow -eq [DayOfWeek]::Sunday) { return $false }
  if (Test-ItalianHoliday -Date $DateTime) { return $false }
  $t = $DateTime.TimeOfDay
  if ($t -ge [timespan]'08:00:00' -and $t -lt [timespan]'18:00:00') { return $true }
  return $false
}

function Assert-OffHoursOrForce {
  param(
    [switch]$Force,
    [datetime]$Now = $(Get-RomeNow)
  )
  if ($Force) { return }
  if (Test-WorkTime -DateTime $Now) {
    throw "Refused: current Rome time is within work hours (Mon-Fri 08:00-18:00, non-holiday). Re-run with -F to override."
  }
}

function Resolve-CommitTimestamp {
  param(
    [Parameter(Mandatory)][datetime]$Now,
    [int]$RandomSeed = -1
  )
  if (-not (Test-WorkTime -DateTime $Now)) { return $Now }
  $rng = if ($RandomSeed -ge 0) { [Random]::new($RandomSeed) } else { [Random]::new() }
  $seconds = $rng.Next(0, 4 * 3600) # [20:00, 24:00)
  return $Now.Date.AddDays(-1).AddHours(20).AddSeconds($seconds)
}

function Test-ChangelogHasVersion {
  param(
    [Parameter(Mandatory)][string]$ChangelogText,
    [Parameter(Mandatory)][string]$Version
  )
  $escaped = [regex]::Escape($Version)
  return [bool]($ChangelogText -match "(?m)^##\s+.*$escaped")
}

function Get-PackageVersion {
  param([Parameter(Mandatory)][string]$PackageJsonText)
  $m = [regex]::Match($PackageJsonText, '"version"\s*:\s*"([^"]+)"')
  if (-not $m.Success) { throw 'package.json has no version field' }
  return $m.Groups[1].Value
}

function Read-PublicExcludePatterns {
  param([Parameter(Mandatory)][string]$Path)
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) { $line }
  }
}

function Test-PublicExcludePath {
  param(
    [Parameter(Mandatory)][string]$RelativePath,
    [Parameter(Mandatory)][string[]]$Patterns
  )
  $norm = ($RelativePath -replace '\\', '/').TrimStart('/')
  foreach ($raw in $Patterns) {
    $p = ($raw -replace '\\', '/').Trim()
    if (-not $p) { continue }
    if ($p.EndsWith('/')) {
      $dir = $p.TrimEnd('/')
      if ($norm -eq $dir -or $norm.StartsWith("$dir/")) { return $true }
      if ($norm -match "(^|/)$([regex]::Escape($dir))(/|$)") { return $true }
      continue
    }
    if ($p.Contains('*')) {
      $rx = '^' + ([regex]::Escape($p) -replace '\\\*', '[^/]*') + '$'
      if ($norm -match $rx) { return $true }
      # also match basename-style under a prefix when pattern has a slash
      if ($norm -match ('(^|/)' + ([regex]::Escape($p) -replace '\\\*', '[^/]*') + '$')) { return $true }
      continue
    }
    if ($norm -eq $p) { return $true }
    if ($norm.EndsWith("/$p")) { return $true }
  }
  return $false
}

function Get-RelativeNormPath {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string]$FullName
  )
  $rootTrim = $Root.TrimEnd('\', '/')
  return ($FullName.Substring($rootTrim.Length).TrimStart('\', '/') -replace '\\', '/')
}

# Depth-first walk that never descends into excluded paths (avoids broken junctions under node_modules/, etc.).
function Get-MirrorEntriesSkippingExclude {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][string[]]$ExcludePatterns,
    [ValidateSet('File', 'Directory')]
    [Parameter(Mandatory)][string]$Kind
  )
  $stack = [System.Collections.Generic.Stack[string]]::new()
  $stack.Push($Root)
  while ($stack.Count -gt 0) {
    $dir = $stack.Pop()
    foreach ($item in (Get-ChildItem -LiteralPath $dir -Force)) {
      $relNorm = Get-RelativeNormPath -Root $Root -FullName $item.FullName
      if (Test-PublicExcludePath -RelativePath $relNorm -Patterns $ExcludePatterns) { continue }
      if ($item.PSIsContainer) {
        if ($Kind -eq 'Directory') { $item }
        $stack.Push($item.FullName)
      } elseif ($Kind -eq 'File') {
        $item
      }
    }
  }
}

function Sync-PublicMirror {
  param(
    [Parameter(Mandatory)][string]$SourceRoot,
    [Parameter(Mandatory)][string]$DestRoot,
    [Parameter(Mandatory)][string[]]$ExcludePatterns
  )
  $always = @('.git/') + $ExcludePatterns
  $sourceFiles = Get-MirrorEntriesSkippingExclude -Root $SourceRoot -ExcludePatterns $always -Kind File

  $copiedRel = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

  foreach ($f in $sourceFiles) {
    $relNorm = Get-RelativeNormPath -Root $SourceRoot -FullName $f.FullName
    $dest = Join-Path $DestRoot ($relNorm -replace '/', '\')
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $destDir)) {
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
    [void]$copiedRel.Add($relNorm)
  }

  # Delete orphans; never enter excluded trees (preserve .git + exclude leftovers)
  if (Test-Path -LiteralPath $DestRoot) {
    Get-MirrorEntriesSkippingExclude -Root $DestRoot -ExcludePatterns $always -Kind File |
      ForEach-Object {
        $relNorm = Get-RelativeNormPath -Root $DestRoot -FullName $_.FullName
        if (-not $copiedRel.Contains($relNorm)) {
          Remove-Item -LiteralPath $_.FullName -Force
        }
      }
    Get-MirrorEntriesSkippingExclude -Root $DestRoot -ExcludePatterns $always -Kind Directory |
      Sort-Object { $_.FullName.Length } -Descending |
      ForEach-Object {
        if (-not (Get-ChildItem -LiteralPath $_.FullName -Force | Select-Object -First 1)) {
          Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
        }
      }
  }
}

function Update-DirtyFileTimes {
  param(
    [Parameter(Mandatory)][string]$Root,
    [Parameter(Mandatory)][datetime]$Timestamp
  )
  Get-ChildItem -LiteralPath $Root -Recurse -File -Force |
    Where-Object { $_.FullName -notmatch '[\\/]\.git[\\/]' } |
    ForEach-Object {
      if (Test-WorkTime -DateTime $_.LastWriteTime) {
        $_.LastWriteTime = $Timestamp
      }
    }
}

function Format-GitDate {
  param([Parameter(Mandatory)][datetime]$DateTime)
  # ISO-like with offset; treat wall clock as Rome (+01/+02 not critical if we embed local offset)
  return $DateTime.ToString('yyyy-MM-dd HH:mm:ss')
}

function Remove-PackageJsonScriptsReferencingScripts {
  param([Parameter(Mandatory)][string]$PackageJsonText)
  $obj = $PackageJsonText | ConvertFrom-Json
  if (-not $obj.PSObject.Properties['scripts'] -or $null -eq $obj.scripts) {
    return ($obj | ConvertTo-Json -Depth 20)
  }
  $kept = [ordered]@{}
  foreach ($p in $obj.scripts.PSObject.Properties) {
    $val = [string]$p.Value
    if ($val -match '(^|[\s''"])scripts[\\/]') { continue }
    $kept[$p.Name] = $p.Value
  }
  $obj.scripts = [pscustomobject]$kept
  return ($obj | ConvertTo-Json -Depth 20)
}

function Update-PublicPackageJsonScripts {
  param([Parameter(Mandatory)][string]$MirrorRoot)
  $pkgPath = Join-Path $MirrorRoot 'package.json'
  if (-not (Test-Path -LiteralPath $pkgPath)) { return }
  $raw = Get-Content -LiteralPath $pkgPath -Raw
  $next = Remove-PackageJsonScriptsReferencingScripts -PackageJsonText $raw
  Set-Content -LiteralPath $pkgPath -Value ($next.TrimEnd() + "`n") -Encoding utf8NoBOM
}

Export-ModuleMember -Function @(
  'Get-RomeNow',
  'Get-EasterSunday',
  'Test-ItalianHoliday',
  'Test-WorkTime',
  'Assert-OffHoursOrForce',
  'Resolve-CommitTimestamp',
  'Test-ChangelogHasVersion',
  'Get-PackageVersion',
  'Read-PublicExcludePatterns',
  'Test-PublicExcludePath',
  'Sync-PublicMirror',
  'Update-DirtyFileTimes',
  'Format-GitDate',
  'Remove-PackageJsonScriptsReferencingScripts',
  'Update-PublicPackageJsonScripts'
)
