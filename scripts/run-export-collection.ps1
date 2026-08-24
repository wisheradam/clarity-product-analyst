$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $ProjectRoot

try {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "CLARITY EXPORT COLLECTION"
    Write-Host "========================================"

    if (-not (Test-Path ".env")) {
        throw ".env file not found."
    }

    if (-not (Test-Path "scripts\collect-clarity-export.mjs")) {
        throw "collect-clarity-export.mjs not found."
    }

    Write-Host ""
    Write-Host "1. COLLECT CLARITY EXPORT DATA"
    Write-Host "----------------------------------------"

    node ".\scripts\collect-clarity-export.mjs"

    if ($LASTEXITCODE -ne 0) {
        throw "Clarity Export collection failed with exit code $LASTEXITCODE"
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "EXPORT COLLECTION COMPLETE"
    Write-Host "========================================"
    Write-Host "Collection : PASS"
    Write-Host "AI Credits : 0"
    Write-Host ""
    Write-Host "No normalization was performed."
    Write-Host "No historical KPI data was modified."
    Write-Host "========================================"
}
catch {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "EXPORT COLLECTION FAILED"
    Write-Host "========================================"
    Write-Host $_.Exception.Message
    Write-Host "========================================"

    exit 1
}
finally {
    Pop-Location
}