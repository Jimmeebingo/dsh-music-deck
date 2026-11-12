# Lists every app that currently publishes a Windows media session (GSMTC).
# Use it to check whether an app the music-deck panel does not show is
# publishing at all: play something, then run this file.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File sessions.ps1

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and
  $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, $resultType) {
  $asTask = $script:asTaskGeneric.MakeGenericMethod($resultType)
  $task = $asTask.Invoke($null, @($op))
  $task.Wait(-1) | Out-Null
  $task.Result
}

[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime] | Out-Null

$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$sessions = @($manager.GetSessions())

Write-Output ("sessions: " + $sessions.Count)

foreach ($session in $sessions) {
  $props = $null
  try { $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]) } catch { }

  $status = ''
  try { $status = [string]$session.GetPlaybackInfo().PlaybackStatus } catch { }

  $duration = 0
  try { $duration = [int64]$session.GetTimelineProperties().EndTime.TotalMilliseconds } catch { }

  $art = 'no'
  if ($props -and $props.Thumbnail) { $art = 'yes' }

  Write-Output ''
  Write-Output ("  app      : " + $session.SourceAppUserModelId)
  Write-Output ("  status   : " + $status)
  Write-Output ("  title    : " + $(if ($props) { $props.Title } else { '' }))
  Write-Output ("  artist   : " + $(if ($props) { $props.Artist } else { '' }))
  Write-Output ("  album    : " + $(if ($props) { $props.AlbumTitle } else { '' }))
  Write-Output ("  artwork  : " + $art)
  Write-Output ("  duration : " + $duration + "ms")
}