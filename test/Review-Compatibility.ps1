param(
  [Parameter(Mandatory = $true)][string]$Root,
  [string]$NodePath = ''
)

$ErrorActionPreference = 'Stop'
trap {
  Write-Output '[ENV_ERROR] Review probe setup or adapter'
  Write-Output ('  ' + [string]$_.Exception.Message)
  exit 2
}
$Root = (Resolve-Path -LiteralPath $Root).Path
$script:Results = New-Object System.Collections.Generic.List[object]

function Assert-Review([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw ('ASSERTION: ' + $Message) }
}

function Test-Review([string]$Name, [scriptblock]$Body) {
  try {
    & $Body
    $script:Results.Add([pscustomobject]@{ name = $Name; status = 'PASS'; detail = '' })
  } catch {
    $message = [string]$_.Exception.Message
    $status = if ($message.StartsWith('ASSERTION: ')) { 'FAIL' } else { 'ENV_ERROR' }
    $script:Results.Add([pscustomobject]@{ name = $Name; status = $status; detail = $message })
  }
}

function Read-ReviewAst([string]$RelativePath) {
  $tokens = $null
  $errors = $null
  $tree = [System.Management.Automation.Language.Parser]::ParseFile(
    (Join-Path $Root $RelativePath), [ref]$tokens, [ref]$errors)
  if ($errors.Count -gt 0) { throw ('Source parse error: ' + ($errors | Out-String)) }
  return $tree
}

function Get-ReviewFunction($Tree, [string]$Name) {
  $found = $Tree.Find({ param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $Name
  }, $true)
  if ($null -eq $found) { throw ('Required source function missing: ' + $Name) }
  return $found.Extent.Text
}

$agentAst = Read-ReviewAst 'agent\smtc.ps1'
$sessionsAst = Read-ReviewAst 'agent\sessions.ps1'

# All file writes made by the extracted production loop go to this dictionary.
# The plugin source tree and the agent work directory are never written.
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
public static class ReviewMemoryIO {
    public static Dictionary<string, string> Files = new Dictionary<string, string>();
    public static bool FailNextTemporary;
    public static void Reset() { Files.Clear(); FailNextTemporary = false; }
    public static string ReadAllText(string path) { return Files[path]; }
    public static void WriteAllText(string path, string text, Encoding encoding) {
        if (FailNextTemporary && path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)) {
            FailNextTemporary = false;
            throw new IOException("injected one-shot publication failure");
        }
        Files[path] = text;
    }
    public static void Move(string source, string target) {
        Files[target] = Files[source];
        Files.Remove(source);
    }
}
'@ -Language CSharp | Out-Null

$mainLoop = @($agentAst.EndBlock.Statements | Where-Object {
  $_ -is [System.Management.Automation.Language.WhileStatementAst]
})
if ($mainLoop.Count -ne 1) { throw 'Expected one production agent main loop.' }
$loopText = $mainLoop[0].Body.Extent.Text
$loopText = $loopText.Substring(1, $loopText.Length - 2)
$loopText = $loopText.Replace('[System.IO.File]::', '[ReviewMemoryIO]::')
$loopText = $loopText.Replace('Move-Item $tmp $stateFile -Force', '[ReviewMemoryIO]::Move($tmp, $stateFile)')
if ($loopText -match '\[System\.IO\.File\]::' -or $loopText -match '\bMove-Item\b') {
  throw 'Unsupported publication implementation; update the in-memory IO adapter before running it.'
}
$loopProbe = [scriptblock]::Create($loopText)

Test-Review 'Explicit missing source must not control the current source' {
  foreach ($name in @('Get-Status', 'Suspend-Others', 'Invoke-Ctl')) {
    Invoke-Expression (Get-ReviewFunction $agentAst $name)
  }
  function Await($operation, $resultType) { return $operation }
  $script:ReviewWrongTargetCalls = 0
  $script:ReviewMediaB = [pscustomobject]@{ SourceAppUserModelId = 'B' }
  $script:ReviewMediaB | Add-Member ScriptMethod TrySkipNextAsync {
    $script:ReviewWrongTargetCalls += 1
    return $true
  }
  $mgr = New-Object PSObject
  $mgr | Add-Member ScriptMethod GetSessions { return @($script:ReviewMediaB) }
  $mgr | Add-Member ScriptMethod GetCurrentSession { return $script:ReviewMediaB }
  Invoke-Ctl ([pscustomobject]@{ action = 'next'; app = 'A-gone' })
  Assert-Review ($script:ReviewWrongTargetCalls -eq 0) (
    'Explicit A-gone command reached B ' + $script:ReviewWrongTargetCalls + ' time(s); expected zero.')
}

Test-Review 'Identical state must recover after a transient publication failure' {
  function Get-ChildItem { return @() }
  function Start-Sleep { param([int]$Milliseconds) }
  function Get-State { return [pscustomobject]@{ ok = $true; sessions = @() } }
  [ReviewMemoryIO]::Reset()
  [ReviewMemoryIO]::FailNextTemporary = $true
  $stateFile = 'memory-state.json'; $cmdDir = 'memory-cmd'; $alive = 'memory-alive'
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  $last = ''; $tick = 3; $IntervalMs = 0
  . $loopProbe
  $first = [ReviewMemoryIO]::Files[$stateFile] | ConvertFrom-Json
  Assert-Review ($first.ok -eq $false) 'Fault injection must publish one error state.'
  $tick = 3
  . $loopProbe
  $recovered = [ReviewMemoryIO]::Files[$stateFile] | ConvertFrom-Json
  Assert-Review ($recovered.ok -eq $true) 'Healthy identical next snapshot left ok:false after the write fault.'
}

Test-Review 'Identical state must recover after a transient Get-State failure' {
  function Get-ChildItem { return @() }
  function Start-Sleep { param([int]$Milliseconds) }
  $script:ReviewFailStateOnce = $false
  function Get-State {
    if ($script:ReviewFailStateOnce) {
      $script:ReviewFailStateOnce = $false
      throw 'injected one-shot Get-State failure'
    }
    return [pscustomobject]@{ ok = $true; sessions = @() }
  }
  [ReviewMemoryIO]::Reset()
  $stateFile = 'memory-state.json'; $cmdDir = 'memory-cmd'; $alive = 'memory-alive'
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  $last = ''; $tick = 3; $IntervalMs = 0
  . $loopProbe
  $script:ReviewFailStateOnce = $true
  $tick = 3
  . $loopProbe
  $fault = [ReviewMemoryIO]::Files[$stateFile] | ConvertFrom-Json
  Assert-Review ($fault.ok -eq $false) 'Fault injection must publish one Get-State error.'
  $tick = 3
  . $loopProbe
  $recovered = [ReviewMemoryIO]::Files[$stateFile] | ConvertFrom-Json
  Assert-Review ($recovered.ok -eq $true) 'Healthy identical snapshot left ok:false after Get-State recovered.'
}

Test-Review 'Core Audio HRESULT declarations must preserve the native signature' {
  $compiled = @(Add-Type -TypeDefinition ([System.IO.File]::ReadAllText(
    (Join-Path $Root 'agent\Volume.cs'))) -Language CSharp -PassThru)
  $volumeType = $compiled | Where-Object Name -eq 'MDVolume' | Select-Object -First 1
  if ($null -eq $volumeType) { throw 'MDVolume type was not produced by source compilation.' }
  $missing = @($volumeType.GetNestedTypes([Reflection.BindingFlags]'NonPublic,Public') |
    Where-Object { $_.IsInterface -and $_.IsImport } | ForEach-Object {
      $interfaceType = $_
      $interfaceType.GetMethods() | Where-Object {
        $_.ReturnType -eq [int] -and
        (($_.GetMethodImplementationFlags() -band [Reflection.MethodImplAttributes]::PreserveSig) -eq 0)
      } | ForEach-Object { $interfaceType.Name + '.' + $_.Name }
    })
  Assert-Review ($missing.Count -eq 0) (
    [string]$missing.Count + ' HRESULT method(s) lack PreserveSig: ' + ($missing -join ', '))
}

$processMatchCases = @(
  [pscustomobject]@{ App = 'QQMusic.exe'; Process = 'QQ'; Expected = $false },
  [pscustomobject]@{ App = 'QQMusic.exe'; Process = 'QQMusic'; Expected = $true },
  [pscustomobject]@{ App = 'C:\Users\QQ\QQMusic.exe'; Process = 'QQ'; Expected = $false },
  [pscustomobject]@{ App = 'SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify'; Process = 'Spotify'; Expected = $true },
  [pscustomobject]@{ App = 'AppleInc.AppleMusic_hash!App'; Process = 'AppleMusic'; Expected = $true },
  [pscustomobject]@{ App = 'opaque-id'; Process = 'cloudmusic'; Expected = $false }
)
foreach ($matchCase in $processMatchCases) {
  Test-Review ('Volume process identity: ' + $matchCase.App + ' / ' + $matchCase.Process) {
    $matches = [MDVolume].GetMethod('Matches', [Reflection.BindingFlags]'NonPublic,Static')
    if ($null -eq $matches) { throw 'The actual MDVolume.Matches method was not found.' }
    $actual = [bool]$matches.Invoke($null, [object[]]@($matchCase.App, $matchCase.Process))
    Assert-Review ($actual -eq $matchCase.Expected) (
      "Matches('$($matchCase.App)', '$($matchCase.Process)') returned $actual; expected $($matchCase.Expected).")
  }
}

foreach ($awaitSource in @(
  [pscustomobject]@{ Label = 'smtc.ps1'; Tree = $agentAst },
  [pscustomobject]@{ Label = 'sessions.ps1'; Tree = $sessionsAst }
)) {
  Test-Review ($awaitSource.Label + ' Await must bound a pending operation') {
    Invoke-Expression (Get-ReviewFunction $awaitSource.Tree 'Await')
    $script:ReviewObservedWaitMs = $null
    $script:ReviewReadPendingResult = $false
    $script:ReviewPendingTask = New-Object PSObject
    $script:ReviewPendingTask | Add-Member NoteProperty IsCompleted $false
    $script:ReviewPendingTask | Add-Member ScriptMethod Wait {
      param([int]$millisecondsTimeout)
      $script:ReviewObservedWaitMs = $millisecondsTimeout
      # A pending operation would never return from Wait(-1). Intercept that
      # argument rather than actually hanging a test thread or killing a process.
      if ($millisecondsTimeout -lt 0) { throw 'ReviewProbe: unbounded wait on a pending operation' }
      return $false
    }
    $script:ReviewPendingTask | Add-Member ScriptProperty Result {
      $script:ReviewReadPendingResult = $true
      throw 'ReviewProbe: pending result was read'
    }
    $script:asTaskGeneric = New-Object PSObject
    $script:asTaskGeneric | Add-Member ScriptMethod MakeGenericMethod { param($resultType) return $this }
    $script:asTaskGeneric | Add-Member ScriptMethod Invoke { param($target, $arguments) return $script:ReviewPendingTask }
    try { Await (New-Object PSObject) ([bool]) | Out-Null } catch { }
    Assert-Review ($null -ne $script:ReviewObservedWaitMs -and $script:ReviewObservedWaitMs -ge 0) (
      'Pending operation received Wait(' + $script:ReviewObservedWaitMs + '); expected a finite timeout.')
    Assert-Review (-not $script:ReviewReadPendingResult) 'A timed-out operation must not read its pending Result.'
  }
}

try {
  if (-not $NodePath) { $NodePath = (Get-Command node.exe -ErrorAction Stop).Source }
  $nodeOutput = @(& $NodePath (Join-Path $PSScriptRoot 'host-lifecycle.test.mjs') --root $Root 2>&1)
  $nodeExit = $LASTEXITCODE
  $nodeReport = ($nodeOutput -join [Environment]::NewLine) | ConvertFrom-Json
  foreach ($item in $nodeReport.results) { $script:Results.Add($item) }
  if ($nodeExit -notin @(0, 1, 2)) { throw ('Unexpected Node test exit code: ' + $nodeExit) }
} catch {
  $script:Results.Add([pscustomobject]@{
    name = 'Node host lifecycle probe'; status = 'ENV_ERROR'; detail = [string]$_.Exception.Message
  })
}

# The behavior fixtures need a fresh CLR so their fake Windows.* definitions
# and the MDVolume test factory cannot collide with the reflection test above.
try {
  $windowsPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  foreach ($warningMode in @($false, $true)) {
    $behaviorArguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File',
      (Join-Path $PSScriptRoot 'Review-Behavior.ps1'), '-Root', $Root, '-Json')
    if ($warningMode) { $behaviorArguments += '-ProcessIdWarning' }
    $behaviorOutput = @(& $windowsPowerShell @behaviorArguments 2>&1)
    $behaviorExit = $LASTEXITCODE
    $behaviorReport = ($behaviorOutput -join [Environment]::NewLine) | ConvertFrom-Json
    foreach ($item in $behaviorReport.results) { $script:Results.Add($item) }
    if ($behaviorExit -notin @(0, 1, 2)) { throw ('Unexpected behavior probe exit code: ' + $behaviorExit) }
  }
} catch {
  $script:Results.Add([pscustomobject]@{
    name = 'C# behavior probes'; status = 'ENV_ERROR'; detail = [string]$_.Exception.Message
  })
}

foreach ($item in $script:Results) {
  Write-Output ('[' + $item.status + '] ' + $item.name)
  if ($item.detail) { Write-Output ('  ' + $item.detail) }
}
$failures = @($script:Results | Where-Object status -eq 'FAIL').Count
$environmentErrors = @($script:Results | Where-Object status -eq 'ENV_ERROR').Count
$passes = @($script:Results | Where-Object status -eq 'PASS').Count
Write-Output ('RESULT: ' + $passes + ' passed; ' + $failures + ' assertion failures; ' + $environmentErrors + ' environment errors.')
if ($environmentErrors -gt 0) { exit 2 }
if ($failures -gt 0) { exit 1 }
exit 0
