param(
    [switch]$ForceCollect
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Today = Get-Date -Format "yyyy-MM-dd"

$RawExportPath = Join-Path $ProjectRoot "data\raw\$Today-export.json"
$CollectorPath = Join-Path $ProjectRoot "scripts\collect-clarity-export.mjs"
$NormalizerPath = Join-Path $ProjectRoot "scripts\normalize-clarity-export.mjs"
$ComparePath = Join-Path $ProjectRoot "scripts\compare-history-export.ps1"

function Assert-FileExists {
    param(
        [string]$Path,
        [string]$Label
    )

    if (-not (Test-Path $Path)) {
        throw "$Label not found: $Path"
    }
}

function Run-Step {
    param(
        [string]$Label,
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "========================================"
    Write-Host $Label
    Write-Host "========================================"

    & $Action

    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE"
    }
}

Push-Location $ProjectRoot

try {
    Assert-FileExists $CollectorPath "Collector"
    Assert-FileExists $NormalizerPath "Normalizer"
    Assert-FileExists $ComparePath "Comparison script"

    Write-Host ""
    Write-Host "========================================"
    Write-Host "CLARITY EXPORT DAILY PIPELINE"
    Write-Host "========================================"
    Write-Host "Date        : $Today"
    Write-Host "AI Credits  : 0"
    Write-Host "========================================"

    if ((Test-Path $RawExportPath) -and -not $ForceCollect) {
        Write-Host ""
        Write-Host "COLLECTION"
        Write-Host "----------------------------------------"
        Write-Host "Today's export snapshot already exists."
        Write-Host "Skipping Clarity API collection to protect daily quota."
        Write-Host "Existing file: data\raw\$Today-export.json"
        Write-Host "Use -ForceCollect only when you intentionally want a fresh same-day snapshot."
    }
    else {
        Run-Step "1. COLLECT CLARITY EXPORT DATA" {
            node ".\scripts\collect-clarity-export.mjs"
        }
    }

    Run-Step "2. NORMALIZE EXPORT DATA" {
        node ".\scripts\normalize-clarity-export.mjs"
    }

    Run-Step "3. COMPARE EXPORT HISTORY" {
        powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\compare-history-export.ps1"
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "PIPELINE COMPLETE"
    Write-Host "========================================"
    Write-Host "Collection : $(if ((Test-Path $RawExportPath) -and -not $ForceCollect) { 'SKIPPED / EXISTING SNAPSHOT' } else { 'PASS' })"
    Write-Host "Normalize  : PASS"
    Write-Host "Compare    : PASS"
    Write-Host "AI Credits : 0"
    Write-Host "========================================"
}
catch {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "PIPELINE FAILED"
    Write-Host "========================================"
    Write-Host $_.Exception.Message
    Write-Host "========================================"

    exit 1
}
finally {
    Pop-Location
}
