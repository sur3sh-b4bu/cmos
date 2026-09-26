<#
  Removes the "COMS API" and "COMS Backup" scheduled tasks created by
  install-autostart.ps1 and stops the running API. Run from an ADMINISTRATOR
  PowerShell. Does not touch data, backups or logs.
#>
#Requires -RunAsAdministrator
foreach ($name in 'COMS API', 'COMS Backup') {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
        Write-Host "Removed task: $name"
    }
}
# Stopping the task ends run-server.cmd; stop the node process it started too.
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -match 'src\\server\.js' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host "Stopped API process $($_.ProcessId)" }
