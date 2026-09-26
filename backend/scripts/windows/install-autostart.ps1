<#
  Sets this computer up to run COMS unattended:
    - "COMS API"    starts the API at boot (no one needs to log in) and keeps
                    restarting it if it stops
    - "COMS Backup" runs `npm run backup` every day at 02:00 (or at next start
                    if the computer was off then)

  Run once, from an ADMINISTRATOR PowerShell:
      powershell -ExecutionPolicy Bypass -File scripts\windows\install-autostart.ps1

  Remove again with uninstall-autostart.ps1. Both tasks run as the SYSTEM
  account, so backend\.env is read from disk and BACKUP_DIR must be a path
  SYSTEM can write to (a fixed drive letter such as D:\COMS-backups is fine;
  a mapped network drive is not).
#>
#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'

$backend = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$node = (Get-Command node -ErrorAction Stop).Source
$runServer = Join-Path $PSScriptRoot 'run-server.cmd'
$runBackup = Join-Path $PSScriptRoot 'run-backup.cmd'

if (-not (Test-Path (Join-Path $backend '.env'))) {
    throw "backend\.env not found. Copy .env.example to .env and fill it in first."
}

$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

# --- API: at boot, never time out, and restart the wrapper itself if it dies
$serverSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName 'COMS API' -Force -Principal $principal -Settings $serverSettings `
    -Trigger (New-ScheduledTaskTrigger -AtStartup) `
    -Action (New-ScheduledTaskAction -Execute $runServer -Argument "`"$node`"" -WorkingDirectory $backend) `
    -Description 'Church Office Management System API (auto-restarting)' | Out-Null

# --- Backup: daily 02:00
$backupSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName 'COMS Backup' -Force -Principal $principal -Settings $backupSettings `
    -Trigger (New-ScheduledTaskTrigger -Daily -At '02:00') `
    -Action (New-ScheduledTaskAction -Execute $runBackup -Argument "`"$node`"" -WorkingDirectory $backend) `
    -Description 'Nightly COMS database + uploads backup' | Out-Null

Start-ScheduledTask -TaskName 'COMS API'

Write-Host ''
Write-Host 'Installed. "COMS API" is starting now and will start on every boot.' -ForegroundColor Green
Write-Host "  Node:     $node"
Write-Host "  Backend:  $backend"
Write-Host "  Logs:     $backend\logs  (combined.log, service.log, service-error.log, backup.log)"
Write-Host ''
Write-Host 'Still to do by hand:' -ForegroundColor Yellow
Write-Host '  1. Set BACKUP_DIR in backend\.env to an external drive / synced folder, then test: npm run backup'
Write-Host '  2. Windows Settings > System > Power: set "Sleep" to Never (a sleeping PC is an offline server).'
Write-Host '  3. Make sure the MySQL Windows service is set to start Automatically (services.msc).'
