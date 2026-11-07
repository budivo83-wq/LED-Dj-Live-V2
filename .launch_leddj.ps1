$ErrorActionPreference = 'SilentlyContinue'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://localhost:3000'
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
  Get-CimInstance Win32_Process -Filter "ParentProcessId = $pid" | ForEach-Object { Stop-ProcessTree $_.ProcessId }
  Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
}

function Cleanup {
  if ($script:cleanedUp) { return }
  $script:cleanedUp = $true
  if ($script:edgeProc) { Stop-ProcessTree $script:edgeProc.Id }
  if ($script:node) { Stop-ProcessTree $script:node.Id }
  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine -like ('*' + $project.Replace('\\','\\\\') + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Wait-ForHttpReady([string]$targetUrl, [int]$timeoutSec = 30) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 2 -MaximumRedirection 0 -ErrorAction Stop | Out-Null
      return $true
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
  Write-LauncherLog ('Project folder: ' + $project)

  if (-not (Test-Path (Join-Path $project 'node_modules'))) {
    Write-LauncherLog 'node_modules missing, running npm install'
    $npm = Start-Process -FilePath 'npm.cmd' -ArgumentList 'install' -WorkingDirectory $project -WindowStyle Hidden -Wait -PassThru
    Write-LauncherLog ('npm install exit code: ' + $npm.ExitCode)
    if ($npm.ExitCode -ne 0) { throw 'npm install failed. Spusť ručně: npm install' }
  }

  Write-LauncherLog 'Starting backend node.exe server.js'
  $script:node = Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory $project -WindowStyle Hidden -PassThru
  Write-LauncherLog ('node.exe started with PID ' + $script:node.Id)
  if (-not (Wait-ForHttpReady $url 30)) { throw 'Server did not become ready on http://localhost:3000' }
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
    '--no-firs t-run',
    '--disable-pinch',
    '--overscroll-history-navigation=0'
  )

  $script:edgeProc = Start-Process -FilePath $edge -ArgumentList $args -PassThru
  Write-LauncherLog ('Edge started with PID ' + $script:edgeProc.Id)
  Wait-Process -Id $script:edgeProc.Id
} catch {
  $err = $_.Exception.Message
  Write-LauncherLog ('ERROR: ' + $err)
  Show-LauncherError ($err + [Environment]::NewLine + 'Zkontroluj launcher.log ve slozce projektu.')
} finally {
  Cleanup
}
