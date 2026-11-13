param(
  [string]$Dir = '',
  [int]$IntervalMs = 150
)

$ErrorActionPreference = 'Stop'

if (-not $Dir) { $Dir = Join-Path $env:TEMP 'dsh-music-deck' }
New-Item -ItemType Directory -Force -Path $Dir | Out-Null

$stateFile = Join-Path $Dir 'state.json'
$cmdDir = Join-Path $Dir 'cmd'
New-Item -ItemType Directory -Force -Path $cmdDir | Out-Null

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$script:asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and
  $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, $resultType, [int]$TimeoutMs = 2000) {
  $asTask = $script:asTaskGeneric.MakeGenericMethod($resultType)
  $task = $asTask.Invoke($null, @($op))
  if (-not $task.Wait($TimeoutMs)) {
    try { $op.Cancel() } catch { }
    throw [System.TimeoutException]::new('Windows media operation timed out')
  }
  $task.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null

$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]) 10000

function Initialize-CoverReader {
  # PowerShell cannot project the WinRT stream interfaces, so the album art is
  # read by a small C# helper compiled on first use and loaded from memory.
  try {
    $source = Join-Path $PSScriptRoot 'Cover.cs'
    if (-not (Test-Path $source)) { return $null }

    # Either bitness of the .NET Framework compiler, so a 32-bit-only machine
    # still gets artwork instead of silently losing it.
    $csc = @(
      (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
      (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    $metadata = Join-Path $env:WINDIR 'System32\WinMetadata'
    $runtime = if ($csc) { Join-Path (Split-Path $csc) 'System.Runtime.dll' } else { '' }
    if (-not $csc -or -not (Test-Path $metadata) -or -not (Test-Path $runtime)) { return $null }

    $dll = Join-Path $Dir 'MDCover.dll'
    $rebuild = $true
    if (Test-Path $dll) {
      $rebuild = (Get-Item $dll).LastWriteTimeUtc -lt (Get-Item $source).LastWriteTimeUtc
    }

    if ($rebuild) {
      $arguments = @(
        '/nologo', '/target:library', "/out:$dll",
        "/reference:$runtime",
        "/reference:$metadata\Windows.Foundation.winmd",
        "/reference:$metadata\Windows.Media.winmd",
        "/reference:$metadata\Windows.Storage.winmd",
        $source
      )
      $output = & $csc @arguments 2>&1
      if ($LASTEXITCODE -ne 0) { throw ($output | Out-String) }
    }

    $assembly = [System.Reflection.Assembly]::Load([System.IO.File]::ReadAllBytes($dll))
    return $assembly.GetType('MDCover')
  } catch {
    [System.IO.File]::WriteAllText((Join-Path $Dir 'cover-error.txt'), [string]$_.Exception.Message)
    return $null
  }
}

$coverReader = Initialize-CoverReader

$volumeReady = $false
try {
  $volumeSource = Join-Path $PSScriptRoot 'Volume.cs'
  if (Test-Path $volumeSource) {
    Add-Type -TypeDefinition ([System.IO.File]::ReadAllText($volumeSource)) -Language CSharp -ErrorAction Stop
    $volumeReady = $true
  }
} catch {
  $volumeReady = $false
}

$md5 = [System.Security.Cryptography.MD5]::Create()

function Get-Key([string]$text) {
  $hash = $md5.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($text))
  return [System.BitConverter]::ToString($hash).Replace('-', '').Substring(0, 12).ToLowerInvariant()
}

function Get-State {
  $sessions = @($mgr.GetSessions())
  $current = $null
  try { $current = $mgr.GetCurrentSession() } catch { }

  $rows = @()
  foreach ($s in $sessions) {
    $props = $null
    try { $props = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]) } catch { }

    $status = ''
    $mediaType = 'unknown'
    $controls = $null
    $pos = 0
    $dur = 0
    try {
      $info = $s.GetPlaybackInfo()
      if ($info) {
        $status = [string]$info.PlaybackStatus
        if ($null -ne $info.PlaybackType) { $mediaType = ([string]$info.PlaybackType).ToLowerInvariant() }
        if ($info.Controls) {
          $controls = [pscustomobject]@{
            play = [bool]$info.Controls.IsPlayEnabled
            pause = [bool]$info.Controls.IsPauseEnabled
            next = [bool]$info.Controls.IsNextEnabled
            prev = [bool]$info.Controls.IsPreviousEnabled
            seek = [bool]$info.Controls.IsPlaybackPositionEnabled
          }
        }
      }
    } catch { }
    try {
      $tl = $s.GetTimelineProperties()
      if ($tl) {
        $pos = [int64]$tl.Position.TotalMilliseconds
        $dur = [int64]$tl.EndTime.TotalMilliseconds
      }
    } catch { }

    $appVolume = -1
    $appMuted = -1
    $appProcess = ''
    if ($volumeReady) {
      try { $appVolume = [MDVolume]::GetLevel([string]$s.SourceAppUserModelId) } catch { $appVolume = -1 }
      try { $appMuted = [MDVolume]::GetMuted([string]$s.SourceAppUserModelId) } catch { $appMuted = -1 }
      # The audio session's process name catches apps whose media id we cannot
      # read (the client can still label and match them).
      try { $appProcess = [string][MDVolume]::MatchProcess([string]$s.SourceAppUserModelId) } catch { $appProcess = '' }
    }

    $rows += [pscustomobject]@{
      id        = [string]$s.SourceAppUserModelId
      process   = $appProcess
      status    = $status.ToLowerInvariant()
      mediaType = $mediaType
      controls  = $controls
      title     = if ($props) { [string]$props.Title } else { '' }
      artist    = if ($props) { [string]$props.Artist } else { '' }
      album     = if ($props) { [string]$props.AlbumTitle } else { '' }
      position  = $pos
      duration  = $dur
      isCurrent = (($current -ne $null) -and ($s.SourceAppUserModelId -eq $current.SourceAppUserModelId))
      coverKey  = ''
      volume    = $appVolume
      muted     = $appMuted
    }
  }

  $shown = $rows | Where-Object { $_.isCurrent } | Select-Object -First 1
  if (-not $shown -and $rows.Count -gt 0) { $shown = $rows[0] }

  # One artwork file per track identity, so switching sources keeps its own art.
  foreach ($row in $rows) {
    if (-not $row.title) { continue }
    $identity = $row.id + '|' + $row.title + '|' + $row.artist + '|' + $row.album
    $key = Get-Key $identity
    $file = Join-Path $Dir "cover-$key.bin"
    if (Test-Path $file) {
      $row.coverKey = $key
      continue
    }
    if (-not $coverReader) { continue }
    try {
      $bytes = $coverReader::Read($row.id)
    } catch {
      $bytes = $null
    }
    if ($bytes -and $bytes.Length -gt 0) {
      [System.IO.File]::WriteAllBytes($file, $bytes)
      $row.coverKey = $key
    }
  }

  # Keep the cache bounded: the twelve most recently written covers are enough.
  $covers = @(Get-ChildItem $Dir -Filter 'cover-*.bin' -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc -Descending)
  if ($covers.Count -gt 12) {
    $covers | Select-Object -Skip 12 | ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue }
  }

  $volume = -1
  $muted = $false
  if ($volumeReady -and $shown) {
    try { $volume = [MDVolume]::GetLevel([string]$shown.id) } catch { $volume = -1 }
    try { $muted = ([MDVolume]::GetMuted([string]$shown.id) -eq 1) } catch { $muted = $false }
  }

  return [pscustomobject]@{
    ok       = $true
    sessions = $rows
    shown    = if ($shown) { $shown.id } else { $null }
    volume   = $volume
    muted    = $muted
    # What this machine could initialise, so a report shows missing pieces.
    caps     = [pscustomobject]@{
      cover  = ($null -ne $coverReader)
      volume = $volumeReady
    }
  }
}

function Get-Status($session) {
  try { return [string]$session.GetPlaybackInfo().PlaybackStatus } catch { return '' }
}

# Only card-initiated playback is exclusive: if the user starts two players by
# hand, nothing here runs, so both keep playing.
function Suspend-Others($target) {
  foreach ($other in @($mgr.GetSessions())) {
    if ($other.SourceAppUserModelId -eq $target.SourceAppUserModelId) { continue }
    if ((Get-Status $other) -ne 'Playing') { continue }
    try { Await ($other.TryPauseAsync()) ([bool]) | Out-Null } catch { }
  }
}

function Invoke-Ctl($cmd) {
  $action = [string]$cmd.action

  # Diagnostic: dump the audio sessions this process can see.
  if ($action -eq 'dump') {
    $target = Join-Path $Dir 'audio-sessions.txt'
    if ($target -and $volumeReady) {
      try { [System.IO.File]::WriteAllText($target, [MDVolume]::Dump(), (New-Object System.Text.UTF8Encoding($false))) } catch { }
    }
    return
  }

  # Volume targets one app's audio session, so it needs no media session lookup.
  if ($action -eq 'volume') {
    if (-not $volumeReady) { return }
    $target = [string]$cmd.app
    if (-not $target) {
      try { $target = [string]$mgr.GetCurrentSession().SourceAppUserModelId } catch { }
    }
    if (-not $target) { return }
    $level = [double]$cmd.level
    if ($level -lt 0) { $level = 0 }
    if ($level -gt 1) { $level = 1 }
    try { [void][MDVolume]::SetLevel($target, $level) } catch { }
    return
  }
  if ($action -eq 'mute') {
    if (-not $volumeReady) { return }
    $target = [string]$cmd.app
    if (-not $target) {
      try { $target = [string]$mgr.GetCurrentSession().SourceAppUserModelId } catch { }
    }
    if (-not $target) { return }
    try { [void][MDVolume]::SetMuted($target, [bool]$cmd.muted) } catch { }
    return
  }

  $wanted = [string]$cmd.app
  $sessions = @($mgr.GetSessions())
  $target = $null
  if ($wanted) {
    $target = $sessions | Where-Object { $_.SourceAppUserModelId -eq $wanted } | Select-Object -First 1
    if (-not $target) { return }
  }
  if (-not $target) { $target = $mgr.GetCurrentSession() }
  if (-not $target) { return }

  $exclusive = $true
  if ($null -ne $cmd.exclusive) { $exclusive = [bool]$cmd.exclusive }

  switch ($action) {
    'play' {
      if ($exclusive) { Suspend-Others $target }
      Await ($target.TryPlayAsync()) ([bool]) | Out-Null
    }
    'pause' { Await ($target.TryPauseAsync()) ([bool]) | Out-Null }
    'toggle' {
      if ((Get-Status $target) -eq 'Playing') {
        Await ($target.TryPauseAsync()) ([bool]) | Out-Null
      } else {
        if ($exclusive) { Suspend-Others $target }
        Await ($target.TryPlayAsync()) ([bool]) | Out-Null
      }
    }
    'next' { Await ($target.TrySkipNextAsync()) ([bool]) | Out-Null }
    'prev' { Await ($target.TrySkipPreviousAsync()) ([bool]) | Out-Null }
    'seek' {
      $ms = [int64]$cmd.position
      if ($ms -lt 0) { $ms = 0 }
      Await ($target.TryChangePlaybackPositionAsync($ms * 10000)) ([bool]) | Out-Null
    }
  }
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
$last = ''
$alive = Join-Path $Dir 'alive'
$tick = 0

# Commands are drained on every fast tick (~150 ms) so transport and volume
# react quickly; the heavy snapshot (media sessions + artwork + per-app volume)
# is rebuilt on every fourth tick (~600 ms).
while ($true) {
  try {
    # One file per command, so a burst of clicks is never overwritten.
    $pending = @(Get-ChildItem $cmdDir -Filter 'cmd-*.json' -ErrorAction SilentlyContinue | Sort-Object Name)
    foreach ($file in $pending) {
      $raw = ''
      try { $raw = [System.IO.File]::ReadAllText($file.FullName) } catch { }
      Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
      if ($raw.Trim()) {
        try { Invoke-Ctl ($raw | ConvertFrom-Json) } catch { }
      }
    }

    $tick += 1
    if (($tick % 4) -eq 0) {
      $state = Get-State
      $body = $state | ConvertTo-Json -Depth 6 -Compress
      if ($body -ne $last) {
        $tmp = "$stateFile.tmp"
        [System.IO.File]::WriteAllText($tmp, $body, $utf8)
        Move-Item $tmp $stateFile -Force
        $last = $body
      }
      [System.IO.File]::WriteAllText($alive, [string][DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(), $utf8)
    }
  } catch {
    $last = ''
    $err = [pscustomobject]@{ ok = $false; error = [string]$_.Exception.Message } | ConvertTo-Json -Compress
    try { [System.IO.File]::WriteAllText($stateFile, $err, $utf8) } catch { }
  }
  Start-Sleep -Milliseconds $IntervalMs
}
