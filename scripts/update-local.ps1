[CmdletBinding()]
param(
  [ValidateRange(1, 365)]
  [int]$Days = 7,

  [ValidateRange(1, 10000)]
  [int]$Max = 1000
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$logDir = Join-Path $repoRoot 'work\daily-update'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$runId = '{0}-{1}' -f (Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'), $PID
$logPath = Join-Path $logDir "daily-update-$runId.log"

function Write-Log {
  param([string]$Message)
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
  Write-Output $line
}

function Invoke-Npm {
  param(
    [string]$Label,
    [string[]]$Arguments
  )

  $stdoutPath = Join-Path $logDir "daily-update-$runId-$Label.stdout.log"
  $stderrPath = Join-Path $logDir "daily-update-$runId-$Label.stderr.log"
  Write-Log "Starting $Label`: npm $($Arguments -join ' ')"

  try {
    $process = Start-Process -FilePath $npmPath -ArgumentList $Arguments `
      -WorkingDirectory $repoRoot -WindowStyle Hidden -Wait -PassThru `
      -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    foreach ($streamPath in @($stdoutPath, $stderrPath)) {
      if (Test-Path -LiteralPath $streamPath) {
        foreach ($line in (Get-Content -LiteralPath $streamPath -Encoding UTF8)) {
          Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
          Write-Output $line
        }
      }
    }

    if ($process.ExitCode -ne 0) {
      throw "$Label failed with exit code $($process.ExitCode)."
    }
    Write-Log "Finished $Label successfully."
  }
  finally {
    Remove-Item -LiteralPath $stdoutPath, $stderrPath -ErrorAction SilentlyContinue
  }
}

try {
  Write-Log "Daily update started in $repoRoot (days=$Days, max=$Max)."
  $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
  Push-Location -LiteralPath $repoRoot
  try {
    Invoke-Npm -Label 'fetch' -Arguments @('run', 'fetch:arxiv', '--', '--days', [string]$Days, '--max', [string]$Max)
    Invoke-Npm -Label 'validate' -Arguments @('run', 'validate:data')
  }
  finally {
    Pop-Location
  }
  Write-Log 'Daily update completed successfully.'
  exit 0
}
catch {
  Write-Log "Daily update failed: $($_.Exception.Message)"
  Write-Log "Check this log: $logPath"
  exit 1
}
