param(
  [Parameter(Mandatory = $true)][string]$Root,
  [switch]$Json,
  [switch]$ProcessIdWarning
)

$ErrorActionPreference = 'Stop'
$script:BehaviorResults = New-Object System.Collections.Generic.List[object]
trap {
  $script:BehaviorResults.Add([pscustomobject]@{
    name = 'Behavior probe setup'; status = 'ENV_ERROR'; detail = [string]$_.Exception.Message
  })
  [pscustomobject]@{ results = $script:BehaviorResults.ToArray() } | ConvertTo-Json -Depth 5 -Compress
  exit 2
}
$Root = (Resolve-Path -LiteralPath $Root).Path

function Assert-Behavior([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw ('ASSERTION: ' + $Message) }
}

function Test-Behavior([string]$Name, [scriptblock]$Body) {
  try {
    & $Body
    $script:BehaviorResults.Add([pscustomobject]@{ name = $Name; status = 'PASS'; detail = '' })
  } catch {
    $message = [string]$_.Exception.Message
    $status = if ($message.StartsWith('ASSERTION: ')) { 'FAIL' } else { 'ENV_ERROR' }
    $script:BehaviorResults.Add([pscustomobject]@{ name = $Name; status = $status; detail = $message })
  }
}

if (-not $ProcessIdWarning) {
Test-Behavior 'Explicit missing cover source must not read the current source artwork' {
  $coverSource = [System.IO.File]::ReadAllText((Join-Path $Root 'agent\Cover.cs'))
  $coverFakes = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'cover-winrt-fakes.cs'))
  # No production Cover.cs text is changed. The Windows.* names bind to local
  # managed fakes in this isolated test process, never to Windows media APIs.
  $types = @(Add-Type -TypeDefinition ($coverSource + [Environment]::NewLine + $coverFakes) -Language CSharp -PassThru)
  $coverType = $types | Where-Object Name -eq 'MDCover' | Select-Object -First 1
  $readInner = $coverType.GetMethod('ReadInner', [Reflection.BindingFlags]'NonPublic,Static')
  if ($null -eq $readInner) { throw 'The actual MDCover.ReadInner method was not found.' }
  $result = $readInner.Invoke($null, [object[]]@('A-missing'))
  $reads = [ReviewCoverState]::BPropertyReads
  $opens = [ReviewCoverState]::BStreamOpens
  $length = if ($null -eq $result) { 0 } else { $result.Length }
  Assert-Behavior ($null -eq $result -and $reads -eq 0 -and $opens -eq 0) (
    "ReadInner('A-missing') returned $length byte(s), read B properties $reads time(s), opened B art $opens time(s); expected null and zero B reads.")
}
}

$volumeTestName = if ($ProcessIdWarning) {
  'Volume must retain the valid PID returned with AUDCLNT_S_NO_SINGLE_PROCESS'
} else {
  'Volume SetLevel must update matching sessions on both active output devices'
}
Test-Behavior $volumeTestName {
  $volumeSource = [System.IO.File]::ReadAllText((Join-Path $Root 'agent\Volume.cs'))
  $factoryPattern = 'new\s+MMDeviceEnumerator\s*\(\s*\)'
  if ([regex]::Matches($volumeSource, $factoryPattern).Count -ne 1) {
    throw 'Expected exactly one COM enumerator factory; update the managed test adapter.'
  }
  # This is the sole replacement in existing production code. Everything else
  # is test-only managed types inserted before MDVolume's closing brace.
  $volumeSource = [regex]::Replace($volumeSource, $factoryPattern, 'new ReviewDeviceEnumerator()')
  $fragment = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot 'volume-managed-fakes.fragment.cs'))
  if ($volumeSource -match '\binterface\s+IMMDeviceCollection\b') {
    $enumMethod = @'
public int EnumAudioEndpoints(int flow, int stateMask, out IMMDeviceCollection devices)
{
    ReviewAudioState.AllEndpointsCalls++;
    if (flow != 0 || stateMask != 1) throw new System.InvalidOperationException("Expected active render endpoints.");
    devices = new ReviewDeviceCollection();
    return 0;
}
'@
    $collectionClass = @'
private sealed class ReviewDeviceCollection : IMMDeviceCollection
{
    public int GetCount(out uint count) { count = 2; return 0; }
    public int Item(uint index, out IMMDevice device)
    {
        device = index < 2 ? new ReviewDevice((int)index) : null;
        return index < 2 ? 0 : -1;
    }
}
'@
  } else {
    $enumMethod = @'
public int EnumAudioEndpoints(int flow, int stateMask, out System.IntPtr devices)
{
    ReviewAudioState.AllEndpointsCalls++;
    devices = System.IntPtr.Zero;
    return 0;
}
'@
    $collectionClass = ''
  }
  $fragment = $fragment.Replace('__REVIEW_ENUM_METHOD__', $enumMethod).Replace('__REVIEW_COLLECTION_CLASS__', $collectionClass)
  $closingBrace = $volumeSource.LastIndexOf('}')
  if ($closingBrace -lt 0 -or $volumeSource.Substring($closingBrace + 1).Trim()) {
    throw 'Expected MDVolume to be the final source declaration; update the fragment adapter.'
  }
  $inMemorySource = $volumeSource.Insert($closingBrace, [Environment]::NewLine + $fragment + [Environment]::NewLine)
  $types = @(Add-Type -TypeDefinition $inMemorySource -Language CSharp -PassThru)
  $volumeType = $types | Where-Object Name -eq 'MDVolume' | Select-Object -First 1
  $stateType = $volumeType.GetNestedType('ReviewAudioState', [Reflection.BindingFlags]'Public')
  if ($ProcessIdWarning) {
    # AUDCLNT_SUCCESS(0x00d): success severity, FACILITY_AUDCLNT (0x889),
    # valid creating-process PID supplied even though a session spans processes.
    $stateType.GetField('ProcessIdResult').SetValue($null, [int]0x0889000D)
  }
  $ownProcessName = [System.Diagnostics.Process]::GetCurrentProcess().ProcessName
  $applied = $volumeType.GetMethod('SetLevel').Invoke($null, [object[]]@($ownProcessName, [double]0.25))
  $writes = $stateType.GetField('Writes').GetValue($null)
  $levels = $stateType.GetField('Levels').GetValue($null)
  $defaultCalls = $stateType.GetField('DefaultEndpointCalls').GetValue($null)
  $allCalls = $stateType.GetField('AllEndpointsCalls').GetValue($null)
  Assert-Behavior ($applied -and $writes[0] -gt 0 -and $writes[1] -gt 0 -and
    [Math]::Abs($levels[0] - 0.25) -lt 0.0001 -and [Math]::Abs($levels[1] - 0.25) -lt 0.0001) (
    "SetLevel returned $applied; endpoint writes=[$($writes -join ',')], levels=[$($levels -join ',')], default lookups=$defaultCalls, all-device lookups=$allCalls; expected both endpoint sessions updated to 0.25.")
}

if ($Json) {
  [pscustomobject]@{ results = $script:BehaviorResults.ToArray() } | ConvertTo-Json -Depth 5 -Compress
} else {
  foreach ($item in $script:BehaviorResults) {
    Write-Output ('[' + $item.status + '] ' + $item.name)
    if ($item.detail) { Write-Output ('  ' + $item.detail) }
  }
  $passCount = @($script:BehaviorResults | Where-Object status -eq 'PASS').Count
  $failCount = @($script:BehaviorResults | Where-Object status -eq 'FAIL').Count
  $envCount = @($script:BehaviorResults | Where-Object status -eq 'ENV_ERROR').Count
  Write-Output ("RESULT: $passCount passed; $failCount assertion failures; $envCount environment errors.")
}
if (@($script:BehaviorResults | Where-Object status -eq 'ENV_ERROR').Count -gt 0) { exit 2 }
if (@($script:BehaviorResults | Where-Object status -eq 'FAIL').Count -gt 0) { exit 1 }
exit 0
