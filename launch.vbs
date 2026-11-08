Option Explicit

Dim fso, shell, projectPath, psPath, psFile, psCode, cmd

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

projectPath = fso.GetParentFolderName(WScript.ScriptFullName)
psPath = projectPath & "\.launch_leddj.ps1"

psCode = ""
psCode = psCode & "$ErrorActionPreference = 'SilentlyContinue'" & vbCrLf
psCode = psCode & "$project = '" & Replace(projectPath, "'", "''") & "'" & vbCrLf
psCode = psCode & "$url = 'http://localhost:3000'" & vbCrLf
psCode = psCode & "$logPath = Join-Path $project 'launcher.log'" & vbCrLf
psCode = psCode & "$script:cleanedUp = $false" & vbCrLf
psCode = psCode & "$script:node = $null" & vbCrLf
psCode = psCode & "$script:edgeProc = $null" & vbCrLf
psCode = psCode & "" & vbCrLf
psCode = psCode & "Add-Type -AssemblyName System.Windows.Forms" & vbCrLf
psCode = psCode & "" & vbCrLf

psCode = psCode & "function Write-LauncherLog([string]$message) {" & vbCrLf
psCode = psCode & "  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'" & vbCrLf
psCode = psCode & "  Add-Content -LiteralPath $logPath -Value (""[$stamp] $message"")" & vbCrLf
psCode = psCode & "}" & vbCrLf
psCode = psCode & "" & vbCrLf

psCode = psCode & "function Stop-ProcessTree([int]$pid) {" & vbCrLf
psCode = psCode & "  if (-not $pid) { return }" & vbCrLf
psCode = psCode & "  & taskkill.exe /PID $pid /T /F *> $null" & vbCrLf
psCode = psCode & "}" & vbCrLf
psCode = psCode & "" & vbCrLf
psCode = psCode & "function Cleanup {" & vbCrLf
psCode = psCode & "  if ($script:cleanedUp) { return }" & vbCrLf
psCode = psCode & "  $script:cleanedUp = $true" & vbCrLf
psCode = psCode & "  if ($script:edgeProc) { Stop-ProcessTree $script:edgeProc.Id }" & vbCrLf
psCode = psCode & "  if ($script:node) { Stop-ProcessTree $script:node.Id }" & vbCrLf
psCode = psCode & "  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -and $_.CommandLine -like ('*' + $project.Replace('\\','\\\\') + '*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" & vbCrLf
psCode = psCode & "}" & vbCrLf
psCode = psCode & "" & vbCrLf
psCode = psCode & "function Wait-ForHttpReady([string]$targetUrl, [int]$timeoutSec = 30) {" & vbCrLf
psCode = psCode & "  $deadline = (Get-Date).AddSeconds($timeoutSec)" & vbCrLf
psCode = psCode & "  while ((Get-Date) -lt $deadline) {" & vbCrLf
psCode = psCode & "    try {" & vbCrLf
psCode = psCode & "      Invoke-WebRequest -Uri $targetUrl -UseBasicParsing -TimeoutSec 2 -MaximumRedirection 0 -ErrorAction Stop | Out-Null" & vbCrLf
psCode = psCode & "      return $true" & vbCrLf
psCode = psCode & "    } catch {" & vbCrLf
psCode = psCode & "      if ($_.Exception.Response) { return $true }" & vbCrLf
psCode = psCode & "      Start-Sleep -Milliseconds 250" & vbCrLf
psCode = psCode & "    }" & vbCrLf
psCode = psCode & "  }" & vbCrLf
psCode = psCode & "  return $false" & vbCrLf
psCode = psCode & "}" & vbCrLf
psCode = psCode & "" & vbCrLf
psCode = psCode & "function Show-LauncherError([string]$message) {" & vbCrLf
psCode = psCode & "  [System.Windows.Forms.MessageBox]::Show($message, 'LED Dj live launcher', 'OK', 'Error') | Out-Null" & vbCrLf
psCode = psCode & "}" & vbCrLf
psCode = psCode & "" & vbCrLf
psCode = psCode & "Register-EngineEvent PowerShell.Exiting -Action { Cleanup } | Out-Null" & vbCrLf
psCode = psCode & "try {" & vbCrLf
psCode = psCode & "  Write-LauncherLog 'Starting backend node.exe server.js'" & vbCrLf
psCode = psCode & "  $script:node = Start-Process -FilePath 'node.exe' -ArgumentList 'server.js' -WorkingDirectory $project -WindowStyle Hidden -PassThru" & vbCrLf
psCode = psCode & "  Write-LauncherLog ('node.exe started with PID ' + $script:node.Id)" & vbCrLf
psCode = psCode & "  if (-not (Wait-ForHttpReady $url 30)) { throw 'Server did not become ready on http://localhost:3000' }" & vbCrLf
psCode = psCode & "  Write-LauncherLog 'Server ready on http://localhost:3000'" & vbCrLf
psCode = psCode & "" & vbCrLf
psCode = psCode & "  $edgePaths = @(" & vbCrLf
psCode = psCode & "    $env:ProgramFiles + '\\Microsoft\\Edge\\Application\\msedge.exe'," & vbCrLf
psCode = psCode & "    ${env:ProgramFiles(x86)} + '\\Microsoft\\Edge\\Application\\msedge.exe'" & vbCrLf
psCode = psCode & "  )" & vbCrLf
psCode = psCode & "  $edge = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1" & vbCrLf
psCode = psCode & "  if (-not $edge) { $edge = 'msedge.exe' }" & vbCrLf
psCode = psCode & "" & vbCrLf
psCode = psCode & "  $screen = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea" & vbCrLf
psCode = psCode & "  $height = $screen.Height" & vbCrLf
psCode = psCode & "  $width = [Math]::Floor($screen.Width * 0.82)" & vbCrLf
psCode = psCode & "  $x = [Math]::Floor(($screen.Width - $width) / 2)" & vbCrLf
psCode = psCode & "  $y = 0" & vbCrLf
psCode = psCode & "" & vbCrLf
psCode = psCode & "  $profile = Join-Path $project '.edge-app-profile'" & vbCrLf
psCode = psCode & "  $args = @(" & vbCrLf
psCode = psCode & "    '--app=' + $url," & vbCrLf
psCode = psCode & "    '--user-data-dir=' + $profile," & vbCrLf
psCode = psCode & "    '--window-size=' + $width + ',' + $height," & vbCrLf
psCode = psCode & "    '--window-position=' + $x + ',' + $y," & vbCrLf
psCode = psCode & "    '--disable-infobars'," & vbCrLf
psCode = psCode & "    '--disable-session-crashed-bubble'," & vbCrLf
psCode = psCode & "    '--no-first-run'," & vbCrLf
psCode = psCode & "    '--disable-pinch'," & vbCrLf
psCode = psCode & "    '--overscroll-history-navigation=0'" & vbCrLf
psCode = psCode & "  )" & vbCrLf
psCode = psCode & "" & vbCrLf
psCode = psCode & "  $script:edgeProc = Start-Process -FilePath $edge -ArgumentList $args -PassThru" & vbCrLf
psCode = psCode & "  Write-LauncherLog ('Edge started with PID ' + $script:edgeProc.Id)" & vbCrLf
psCode = psCode & "  while ($script:edgeProc -and -not $script:edgeProc.HasExited) {" & vbCrLf
psCode = psCode & "    if ($script:node -and -not (Get-Process -Id $script:node.Id -ErrorAction SilentlyContinue)) { break }" & vbCrLf
psCode = psCode & "    Start-Sleep -Milliseconds 250" & vbCrLf
psCode = psCode & "  }" & vbCrLf
psCode = psCode & "} catch {" & vbCrLf
psCode = psCode & "  $err = $_.Exception.Message" & vbCrLf
psCode = psCode & "  Write-LauncherLog ('ERROR: ' + $err)" & vbCrLf
psCode = psCode & "  Show-LauncherError ($err + [Environment]::NewLine + 'Zkontroluj launcher.log a server.err.log ve slozce projektu.')" & vbCrLf
psCode = psCode & "} finally {" & vbCrLf
psCode = psCode & "  Cleanup" & vbCrLf
psCode = psCode & "}" & vbCrLf

Set psFile = fso.CreateTextFile(psPath, True)
psFile.Write psCode
psFile.Close

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & psPath & """"
shell.Run cmd, 0, False
