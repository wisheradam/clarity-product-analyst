$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Run-Step {
    param(
        [string]$Name,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "========================================"
    Write-Host $Name
    Write-Host "========================================"

    & $Command

    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }

    Write-Host "$Name : PASS"
}

Push-Location $ProjectRoot

try {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "CLARITY DAILY DATA PIPELINE"
    Write-Host "========================================"

    if (-not (Test-Path ".env")) {
        throw ".env file not found."
    }

    if (-not (Test-Path "scripts\collect-clarity-full.mjs")) {
        throw "collect-clarity-full.mjs not found."
    }

    if (-not (Test-Path "scripts\normalize-clarity.mjs")) {
        throw "normalize-clarity.mjs not found."
    }

    if (-not (Test-Path "scripts\compare-history.ps1")) {
        throw "compare-history.ps1 not found."
    }

    Run-Step "1. COLLECT LIVE CLARITY DATA" {
        node ".\scripts\collect-clarity-full.mjs"
    }

    Run-Step "2. NORMALIZE CLARITY DATA" {
        node ".\scripts\normalize-clarity.mjs"
    }

    Run-Step "3. HISTORICAL COMPARISON" {
        powershell `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File ".\scripts\compare-history.ps1"
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "PIPELINE COMPLETE"
    Write-Host "========================================"
    Write-Host "Clarity collection : PASS"
    Write-Host "Normalization      : PASS"
    Write-Host "Historical compare : PASS"
    Write-Host ""
    Write-Host "AI Credits used    : 0"
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