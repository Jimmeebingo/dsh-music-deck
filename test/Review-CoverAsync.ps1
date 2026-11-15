param(
  [Parameter(Mandatory = $true)][string]$Root
)

# Proves that collecting artwork is genuinely non-blocking: the production
# Update-Covers runs against a fake reader that answers only after a controlled
# number of polls, while the surrounding loop keeps writing heartbeats.
# No real player and no real media session is touched.

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path -LiteralPath $Root).Path
$script:Results = New-Object System.Collections.Generic.List[object]

function Assert-Cover([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw ('ASSERTION: ' + $Message) }
}

function Test-Cover([string]$Name, [scriptblock]$Body) {
  try {
    & $Body
    $script:Results.Add([pscustomobject]@{ name = $Name; status = 'PASS'; detail = '' })
  } catch {
    $message = [string]$_.Exception.Message
    $status = if ($message.StartsWith('ASSERTION: ')) { 'FAIL' } else { 'ENV_ERROR' }
    $script:Results.Add([pscustomobject]@{ name = $Name; status = $status; detail = $message })
  }
}

$tokens = $null
$parseErrors = $null
$tree = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $Root 'agent\smtc.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw ('smtc.ps1 parse error: ' + ($parseErrors | Out-String)) }

function Get-ReviewFunction([string]$Name) {
  $found = $tree.Find({ param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $Name
  }, $true)
  if ($null -eq $found) { throw ('Required source function missing: ' + $Name) }
  return $found.Extent.Text
}

$fakeReader = @'
public static class ReviewAsyncCover
{
    public static string LastApp = "";
    public static string LastToken = "";
    public static int PollsToComplete = 1;
    public static int Polls = 0;
    public static int Requests = 0;
    private static bool inFlight = false;
    public static string OutIdentity = "";
    public static byte[] OutBytes = null;
    public static string OutError = "";
    public static void Reset()
    {
        inFlight = false; Polls = 0; Requests = 0; OutBytes = new byte[] { 1, 2, 3 }; OutIdentity = "";
    }
    public static void Start() { }
    public static bool Busy { get { return inFlight; } }
    public static bool Request(string app, string token)
    {
        if (inFlight) return false;
        inFlight = true; LastApp = app; LastToken = token; Polls = 0; Requests++;
        return true;
    }
    public static bool TryTake(ref string token, ref byte[] bytes, ref string error, ref string identity)
    {
        if (!inFlight) return false;
        Polls++;
        if (Polls < PollsToComplete) return false;
        inFlight = false;
        token = LastToken; bytes = OutBytes; error = OutError; identity = OutIdentity;
        return true;
    }
}
'@
$type = Add-Type -TypeDefinition $fakeReader -Language CSharp -PassThru |
  Where-Object Name -eq 'ReviewAsyncCover' | Select-Object -First 1
if ($null -eq $type) { throw 'Could not compile the fake cover reader.' }

# The production helpers, defined once at script scope. Update-Covers resolves
# $Dir / $coverReader / $coverBackoff from whoever calls it, exactly like it does
# inside the agent loop.
$script:md5 = [System.Security.Cryptography.MD5]::Create()
Invoke-Expression (Get-ReviewFunction 'Get-Key')
Invoke-Expression (Get-ReviewFunction 'Write-CoverFile')
Invoke-Expression (Get-ReviewFunction 'Update-Covers')

$script:Work = Join-Path $PSScriptRoot 'tmp'
New-Item -ItemType Directory -Force -Path $script:Work | Out-Null

function New-CoverDir {
  $dir = Join-Path $script:Work ('cover-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  return $dir
}

$script:Identity = 'player.exe|Song|Artist|Album'

Test-Cover 'A slow read never blocks the loop, and the cover still lands' {
  [ReviewAsyncCover]::Reset()
  [ReviewAsyncCover]::PollsToComplete = 15
  [ReviewAsyncCover]::OutIdentity = $script:Identity

  $Dir = New-CoverDir
  $coverBackoff = @{}
  $coverDelay = @{}
  $script:coverInFlight = $null
  $coverReader = $type
  $script:PendingRows = @([pscustomobject]@{ id = 'player.exe'; title = 'Song'; artist = 'Artist'; album = 'Album'; coverKey = '' })

  $heartbeat = Join-Path $Dir 'heartbeat.txt'
  $slowest = 0
  for ($i = 0; $i -lt 25; $i++) {
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    Update-Covers
    $watch.Stop()
    if ($watch.ElapsedMilliseconds -gt $slowest) { $slowest = $watch.ElapsedMilliseconds }
    [System.IO.File]::AppendAllText($heartbeat, "tick`n")
    Start-Sleep -Milliseconds 20
  }

  $coverFile = Join-Path $Dir ('cover-' + [ReviewAsyncCover]::LastToken + '.bin')
  Assert-Cover ($slowest -lt 250) ("one Update-Covers call blocked for $slowest ms")
  Assert-Cover (Test-Path $coverFile) 'the cover was never written after the read completed'
  $beats = @(Get-Content $heartbeat | Where-Object { $_ -eq 'tick' }).Count
  Assert-Cover ($beats -eq 25) "heartbeat stopped during the read ($beats of 25)"
}

Test-Cover 'A read that finishes after a track change is discarded' {
  [ReviewAsyncCover]::Reset()
  [ReviewAsyncCover]::PollsToComplete = 1
  [ReviewAsyncCover]::OutIdentity = 'player.exe|Other song|Artist|Album'

  $Dir = New-CoverDir
  $coverBackoff = @{}
  $coverDelay = @{}
  $script:coverInFlight = $null
  $coverReader = $type
  $script:PendingRows = @([pscustomobject]@{ id = 'player.exe'; title = 'Song'; artist = 'Artist'; album = 'Album'; coverKey = '' })

  Update-Covers   # queues the read
  Update-Covers   # collects the stale result

  $files = @(Get-ChildItem $Dir -Filter 'cover-*.bin' -ErrorAction SilentlyContinue)
  Assert-Cover ($files.Count -eq 0) 'artwork of another track was written under this track key'
}

Test-Cover 'A failure starts its backoff when the failure is seen' {
  [ReviewAsyncCover]::Reset()
  [ReviewAsyncCover]::PollsToComplete = 12
  [ReviewAsyncCover]::OutBytes = $null
  [ReviewAsyncCover]::OutIdentity = $script:Identity

  $Dir = New-CoverDir
  $coverBackoff = @{}
  $coverDelay = @{}
  $script:coverInFlight = $null
  $coverReader = $type
  $script:PendingRows = @([pscustomobject]@{ id = 'player.exe'; title = 'Song'; artist = 'Artist'; album = 'Album'; coverKey = '' })

  Update-Covers
  $requestedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  for ($i = 0; $i -lt 12; $i++) {
    Start-Sleep -Milliseconds 100
    Update-Covers
  }
  $failedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

  Assert-Cover ($coverBackoff.ContainsKey($script:Identity)) 'no backoff was recorded after the failure'
  $backoff = [int64]$coverBackoff[$script:Identity]
  Assert-Cover ($backoff -ge ($failedAt + 900)) ("backoff ends " + ($backoff - $failedAt) + 'ms after the failure; expected at least 900ms')
  Assert-Cover (($failedAt - $requestedAt) -gt 1000) 'the simulated read was not slow enough to prove the point'
}

Test-Cover 'Only one read is ever in flight' {
  [ReviewAsyncCover]::Reset()
  [ReviewAsyncCover]::PollsToComplete = 50
  [ReviewAsyncCover]::OutIdentity = $script:Identity

  $Dir = New-CoverDir
  $coverBackoff = @{}
  $coverDelay = @{}
  $script:coverInFlight = $null
  $coverReader = $type
  $script:PendingRows = @([pscustomobject]@{ id = 'player.exe'; title = 'Song'; artist = 'Artist'; album = 'Album'; coverKey = '' })

  for ($i = 0; $i -lt 10; $i++) { Update-Covers }

  Assert-Cover ([ReviewAsyncCover]::Requests -eq 1) ('the loop queued ' + [ReviewAsyncCover]::Requests + ' reads; expected exactly one')
}

Test-Cover 'A completed read is written without leaving temporary files' {
  [ReviewAsyncCover]::Reset()
  [ReviewAsyncCover]::PollsToComplete = 1
  [ReviewAsyncCover]::OutIdentity = $script:Identity

  $Dir = New-CoverDir
  $coverBackoff = @{}
  $coverDelay = @{}
  $script:coverInFlight = $null
  $coverReader = $type
  $script:PendingRows = @([pscustomobject]@{ id = 'player.exe'; title = 'Song'; artist = 'Artist'; album = 'Album'; coverKey = '' })

  Update-Covers
  Update-Covers

  $files = @(Get-ChildItem $Dir -Filter 'cover-*.bin')
  Assert-Cover ($files.Count -eq 1) 'expected exactly one cover file'
  Assert-Cover ($files[0].Length -eq 3) 'the cover file does not contain the reader bytes'
  $temps = @(Get-ChildItem $Dir -Filter '*.tmp' -ErrorAction SilentlyContinue)
  Assert-Cover ($temps.Count -eq 0) 'a temporary file was left behind'
}

$failures = @($script:Results | Where-Object { $_.status -ne 'PASS' }).Count
foreach ($result in $script:Results) {
  $tag = if ($result.status -eq 'PASS') { '[PASS]' } else { '[' + $result.status + ']' }
  Write-Output ($tag + ' ' + $result.name)
  if ($result.detail) { Write-Output ('        ' + $result.detail) }
}
$envErrors = @($script:Results | Where-Object { $_.status -eq 'ENV_ERROR' }).Count
Write-Output ('RESULT: ' + ($script:Results.Count - $failures) + ' passed; ' + $failures + ' assertion failures; ' + $envErrors + ' environment errors.')
exit ([int]($failures -gt 0))