$ErrorActionPreference = "Stop"

$ProjectRoot = "C:\ai\clarity-agent"
$Pipeline = Join-Path $ProjectRoot "scripts\run-daily-local-pipeline.ps1"
$LogsDir = Join-Path $ProjectRoot "logs"

if (-not (Test-Path $Pipeline)) {
    throw "Pipeline not found: $Pipeline"
}

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

$Date = Get-Date -Format "yyyy-MM-dd"
$Time = Get-Date -Format "HHmmss"
$LogFile = Join-Path $LogsDir "clarity-daily-$Date-$Time.log"

Set-Location $ProjectRoot

try {
    "==================================================" | Tee-Object -FilePath $LogFile
    "INNOVA CLARITY SCHEDULED RUN" | Tee-Object -FilePath $LogFile -Append
    "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Tee-Object -FilePath $LogFile -Append
    "Project: $ProjectRoot" | Tee-Object -FilePath $LogFile -Append
    "==================================================" | Tee-Object -FilePath $LogFile -Append

    & powershell.exe `
        -NoProfile `
        -ExecutionPolicy Bypass `
        -File $Pipeline 2>&1 |
        Tee-Object -FilePath $LogFile -Append

    $ExitCode = $LASTEXITCODE

    "" | Tee-Object -FilePath $LogFile -Append
    "Finished: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Tee-Object -FilePath $LogFile -Append
    "Exit code: $ExitCode" | Tee-Object -FilePath $LogFile -Append

    if ($ExitCode -ne 0) {
        throw "Daily pipeline failed with exit code $ExitCode. See: $LogFile"
    }

    exit 0
}
catch {
    "" | Tee-Object -FilePath $LogFile -Append
    "SCHEDULED RUN FAILED" | Tee-Object -FilePath $LogFile -Append
    $_.Exception.Message | Tee-Object -FilePath $LogFile -Append
    exit 1
}
