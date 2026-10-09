[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [ValidatePattern('^[^\\/:*?"<>|]+$')]
  [string]$TaskName = 'ArxivDailyUpdate'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$updateScript = Join-Path $PSScriptRoot 'update-local.ps1'
if (-not (Test-Path -LiteralPath $updateScript -PathType Leaf)) {
  throw "Update script is missing: $updateScript"
}

Import-Module ScheduledTasks -ErrorAction Stop
$powerShellExe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$action = New-ScheduledTaskAction -Execute $powerShellExe `
  -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $updateScript) `
  -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At ((Get-Date).Date.AddHours(9))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

if ($PSCmdlet.ShouldProcess($TaskName, 'Register or replace daily 09:00 local-time update task')) {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Description 'Refresh arXiv data and validate it every day at 09:00 local time.' `
    -Force | Out-Null
  Write-Output "Registered task '$TaskName' for $currentUser at 09:00 local time."
  Write-Output "Script: $updateScript"
  Write-Output "Logs: $(Join-Path $repoRoot 'work\daily-update')"
}
