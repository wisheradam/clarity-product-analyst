$ErrorActionPreference = "Stop"

$TaskName = "INNOVA Clarity Daily Analytics"
$ProjectRoot = "C:\ai\clarity-agent"
$Runner = Join-Path $ProjectRoot "scripts\run-scheduled-daily.ps1"

if (-not (Test-Path $Runner)) {
    throw "Scheduled runner not found: $Runner"
}

$Action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`"" `
    -WorkingDirectory $ProjectRoot

$Trigger = New-ScheduledTaskTrigger `
    -Daily `
    -At 10:00AM

$Settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -WakeToRun `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
    -MultipleInstances IgnoreNew

$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$Principal = New-ScheduledTaskPrincipal `
    -UserId $CurrentUser `
    -LogonType Interactive `
    -RunLevel Limited

$Task = New-ScheduledTask `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Runs the INNOVA Microsoft Clarity analytics pipeline every day at 10:00 local Windows time and emails the daily report."

Register-ScheduledTask `
    -TaskName $TaskName `
    -InputObject $Task `
    -Force | Out-Null

Write-Host ""
Write-Host "========================================"
Write-Host "TASK CREATED"
Write-Host "========================================"
Write-Host "Name       : $TaskName"
Write-Host "Schedule   : Daily at 10:00"
Write-Host "Windows TZ : Local computer time"
Write-Host "User       : $CurrentUser"
Write-Host "Missed run : Start as soon as possible"
Write-Host "Wake PC    : Enabled where Windows allows it"
Write-Host "Logs       : C:\ai\clarity-agent\logs"
Write-Host "========================================"
Write-Host ""
Write-Host "To test it now:"
Write-Host "Start-ScheduledTask -TaskName `"$TaskName`""
Write-Host ""
Write-Host "To inspect it:"
Write-Host "Get-ScheduledTask -TaskName `"$TaskName`" | Get-ScheduledTaskInfo"
