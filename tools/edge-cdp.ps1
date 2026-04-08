param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-CdpCommand {
  param(
    [Parameter(Mandatory = $true)]
    [System.Net.WebSockets.ClientWebSocket]$Socket,
    [Parameter(Mandatory = $true)]
    [hashtable]$Command
  )

  $json = ($Command | ConvertTo-Json -Depth 20 -Compress)
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $segment = [ArraySegment[byte]]::new($bytes)
  $Socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

  $buffer = New-Object byte[] 1048576
  $builder = [System.Text.StringBuilder]::new()

  while ($true) {
    $recv = $Socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).GetAwaiter().GetResult()
    if ($recv.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) {
      throw "CDP websocket closed unexpectedly"
    }

    [void]$builder.Append([System.Text.Encoding]::UTF8.GetString($buffer, 0, $recv.Count))
    if ($recv.EndOfMessage) {
      $message = $builder.ToString() | ConvertFrom-Json
      $builder.Clear() | Out-Null

      if (-not ($message.PSObject.Properties.Name -contains "id")) {
        continue
      }

      if ([int]$message.id -ne [int]$Command.id) {
        continue
      }

      if ($message.PSObject.Properties.Name -contains "error" -and $message.error) {
        throw $message.error.message
      }
      return $message
    }
  }
}

function Wait-HttpReady {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [int]$TimeoutMs = 15000
  )

  $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
  while ((Get-Date) -lt $deadline) {
    try {
      return Invoke-RestMethod -Uri $Url
    } catch {
      Start-Sleep -Milliseconds 200
    }
  }

  throw "Timed out waiting for $Url"
}

$config = Get-Content -Raw -Path $ConfigPath | ConvertFrom-Json
$port = if ($config.port) { [int]$config.port } else { 9222 }
$profileDir = if ($config.userDataDir) { [IO.Path]::GetFullPath([string]$config.userDataDir) } else { [IO.Path]::GetFullPath(".cdp-profile") }
$viewport = if ($config.viewport) { $config.viewport } else { $null }
$viewportWidth = if ($viewport -and $viewport.PSObject.Properties.Name -contains "width") { [int]$viewport.width } else { 1440 }
$viewportHeight = if ($viewport -and $viewport.PSObject.Properties.Name -contains "height") { [int]$viewport.height } else { 2200 }
$deviceScaleFactor = if ($viewport -and $viewport.PSObject.Properties.Name -contains "deviceScaleFactor") { [double]$viewport.deviceScaleFactor } else { 1 }
$mobile = if ($viewport -and $viewport.PSObject.Properties.Name -contains "mobile") { [bool]$viewport.mobile } else { $false }
$verbose = [bool]$config.verbose
$skipLaunch = if ($config.PSObject.Properties.Name -contains "skipLaunch") { [bool]$config.skipLaunch } else { $false }
$steps = if ($config.PSObject.Properties.Name -contains "steps") { $config.steps } else { @() }

New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

$edgeArgs = @(
  "--headless=new",
  "--disable-gpu",
  "--remote-debugging-port=$port",
  "--user-data-dir=$profileDir",
  "about:blank"
)

$edge = $null

try {
  if (-not $skipLaunch) {
    $edge = Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList $edgeArgs -PassThru
  }

  $version = Wait-HttpReady -Url "http://127.0.0.1:$port/json/version"
  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.ConnectAsync([Uri]$version.webSocketDebuggerUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null

  if ($verbose) {
    Write-Output "Connected target: $($version.webSocketDebuggerUrl)"
  }

  $id = 0
  $send = {
    param([string]$Method, [hashtable]$Params, [string]$SessionId)
    $script:id += 1
    $command = @{ id = $script:id; method = $Method; params = if ($Params) { $Params } else { @{} } }
    if ($SessionId) {
      $command.sessionId = $SessionId
    }
    Invoke-CdpCommand -Socket $ws -Command $command
  }

  $createdTarget = & $send "Target.createTarget" @{ url = "about:blank" } $null
  $targetId = [string]$createdTarget.result.targetId
  $attachedTarget = & $send "Target.attachToTarget" @{ targetId = $targetId; flatten = $true } $null
  $sessionId = [string]$attachedTarget.result.sessionId

  & $send "Page.enable" @{} $sessionId | Out-Null
  & $send "Runtime.enable" @{} $sessionId | Out-Null
  & $send "DOM.enable" @{} $sessionId | Out-Null
  & $send "Network.enable" @{} $sessionId | Out-Null
  & $send "Emulation.setDeviceMetricsOverride" @{
    width = $viewportWidth
    height = $viewportHeight
    deviceScaleFactor = $deviceScaleFactor
    mobile = $mobile
  } $sessionId | Out-Null

  if ($viewport -and $viewport.PSObject.Properties.Name -contains "userAgent" -and $viewport.userAgent) {
    & $send "Emulation.setUserAgentOverride" @{ userAgent = [string]$viewport.userAgent } $sessionId | Out-Null
  }

  & $send "Page.navigate" @{ url = [string]$config.url } $sessionId | Out-Null
  Start-Sleep -Milliseconds $(if ($config.afterLoadWaitMs) { [int]$config.afterLoadWaitMs } else { 1500 })

  foreach ($step in $steps) {
    if ($verbose) {
      Write-Output "Step: $($step.type)"
    }

    if ($step.type -eq "wait") {
      Start-Sleep -Milliseconds ([int]$step.ms)
      continue
    }

    if ($step.type -eq "scroll") {
      & $send "Runtime.evaluate" @{ expression = "window.scrollTo($($step.x), $($step.y));" } $sessionId | Out-Null
      Start-Sleep -Milliseconds $(if ($step.afterMs) { [int]$step.afterMs } else { 800 })
      continue
    }

    if ($step.type -eq "eval") {
      $result = & $send "Runtime.evaluate" @{
        expression = [string]$step.expression
        awaitPromise = $true
        returnByValue = $true
      } $sessionId

      if ($step.outFile) {
        $outPath = [IO.Path]::GetFullPath([string]$step.outFile)
        New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($outPath)) | Out-Null
        ($result.result.result.value | ConvertTo-Json -Depth 20) | Set-Content -Path $outPath
      } else {
        $result.result.result.value | ConvertTo-Json -Depth 20
      }
      continue
    }

    if ($step.type -eq "screenshot") {
      $capture = & $send "Page.captureScreenshot" @{
        format = if ($step.format) { [string]$step.format } else { "png" }
        captureBeyondViewport = [bool]$step.captureBeyondViewport
      } $sessionId

      $outPath = [IO.Path]::GetFullPath([string]$step.path)
      New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($outPath)) | Out-Null
      [IO.File]::WriteAllBytes($outPath, [Convert]::FromBase64String([string]$capture.result.data))
      continue
    }
  }

  $ws.Dispose()
} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force
  }
}
