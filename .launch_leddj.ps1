$ErrorActionPreference = 'SilentlyContinue'
$project = 'C:\Users\budiv\Documents\BudiSoft studio\BudiSoft studio\LED Dj live\v1.5.2\LED_Dj_live_clean_STEP38V_GENERATOR_BEAT_INTELLIGENCE'
$url = 'http://localhost:3000'
$healthUrl = 'http://127.0.0.1:3000/api/health'
$logPath = Join-Path $project 'launcher.log'
$script:cleanedUp = $false
$script:node = $null
$script:edgeProc = $null

Add-Type -AssemblyName System.Windows.Forms

function Write-LauncherLog([string]$message) {
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
  Add-Content -LiteralPath $logPath -Value ("[$stamp] $message")
}

function Stop-ProcessTree([int]$pid) {
  if (-not $pid) { return }
  & taskkill.exe /PID $pid /T /F *> $null
}

function Cleanup {
  if ($script:cleanedUp) { return }
  $script:cleanedUp = $true
  if ($script:edgeProc) { Stop-ProcessTree $script:edgeProc.Id }
  if ($script:node) { Stop-ProcessTree $script:node.Id }
  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine -like ('*' + $project.Replace('\\','\\\\') + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  $edgeProfile = Join-Path $project '.edge-app-profile'
  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'msedge.exe' -and $_.CommandLine -and $_.CommandLine -like ('*--user-data-dir=' + $edgeProfile + '*') } | ForEach-Object { Stop-ProcessTree $_.ProcessId }
}

function Wait-ForHttpReady([string]$targetUrl, [int]$timeoutSec = 30) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 2 -MaximumRedirection 0 -ErrorAction Stop
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $true }
    } catch {
      if ($_.Exception.Response) { return $true }
      Start-Sleep -Milliseconds 250
    }
  }
  return $false
}

function Show-LauncherError([string]$message) {
  [System.Windows.Forms.MessageBox]::Show($message, 'LED Dj live launcher', 'OK', 'Error') | Out-Null
}

Register-EngineEvent PowerShell.Exiting -Action { Cleanup } | Out-Null
try {
  Write-LauncherLog 'Starting backend node.exe server.js'
  $stdoutPath = Join-Path $project 'server.stdout.log'
  $stderrPath = Join-Path $project 'server.err.log'
  $script:node = Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
  Write-LauncherLog ('node.exe started with PID ' + $script:node.Id)
  if (-not (Wait-ForHttpReady $healthUrl 30)) {
    $exitCode = if ($script:node.HasExited) { $script:node.ExitCode } else { 'running' }
    throw ('Server did not become ready on ' + $healthUrl + ' (node=' + $exitCode + ')')
  }
  Write-LauncherLog 'Server ready on http://localhost:3000'

  $edgePaths = @(
    $env:ProgramFiles + '\Microsoft\Edge\Application\msedge.exe',
    ${env:ProgramFiles(x86)} + '\Microsoft\Edge\Application\msedge.exe'
  )
  $edge = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $edge) { $edge = 'msedge.exe' }

  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $height = $screen.Height
  $width = [Math]::Floor($screen.Width * 0.82)
  $x = [Math]::Floor(($screen.Width - $width) / 2)
  $y = 0

  $profile = Join-Path $project '.edge-app-profile'
  $args = @(
    '--app=' + $url,
    '--user-data-dir=' + $profile,
    '--window-size=' + $width + ',' + $height,
    '--window-position=' + $x + ',' + $y,
    '--disable-infobars',
    '--disable-session-crashed-bubble',
    '--no-first-run',
    '--disable-pinch',
    '--overscroll-history-navigation=0'
  )

  $script:edgeProc = Start-Process -FilePath $edge -ArgumentList $args -PassThru
  Write-LauncherLog ('Edge started with PID ' + $script:edgeProc.Id)
  while ($script:edgeProc -and -not $script:edgeProc.HasExited) {
    if ($script:node -and -not (Get-Process -Id $script:node.Id -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 250
  }
} catch {
  $err = $_.Exception.Message
  Write-LauncherLog ('ERROR: ' + $err)
  Show-LauncherError ($err + [Environment]::NewLine + 'Zkontroluj launcher.log a server.err.log ve slozce projektu.')
} finally {
  Cleanup
}
