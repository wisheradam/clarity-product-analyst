param(
    [switch]$ForceCollect,
    [switch]$ForceRecordings
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Today = Get-Date -Format "yyyy-MM-dd"

$RawExportPath = Join-Path $ProjectRoot "data\raw\$Today-export.json"
$TargetedRecordingsPath = Join-Path $ProjectRoot "data\recordings\$Today-targeted.json"

$CollectorPath = Join-Path $ProjectRoot "scripts\collect-clarity-export.mjs"
$NormalizerPath = Join-Path $ProjectRoot "scripts\normalize-clarity-export.mjs"
$ComparePath = Join-Path $ProjectRoot "scripts\compare-history-export.ps1"
$RecordingsPath = Join-Path $ProjectRoot "scripts\collect-targeted-recordings.mjs"
$EvidencePath = Join-Path $ProjectRoot "scripts\build-session-evidence.mjs"
$LocalReportPath = Join-Path $ProjectRoot "scripts\generate-daily-local-report.mjs"

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
    Assert-FileExists $CollectorPath "Clarity export collector"
    Assert-FileExists $NormalizerPath "Export normalizer"
    Assert-FileExists $ComparePath "History comparison script"
    Assert-FileExists $RecordingsPath "Targeted recordings collector"
    Assert-FileExists $EvidencePath "Session evidence builder"
    Assert-FileExists $LocalReportPath "Local report generator"

    Write-Host ""
    Write-Host "========================================"
    Write-Host "CLARITY DAILY LOCAL PIPELINE"
    Write-Host "========================================"
    Write-Host "Date        : $Today"
    Write-Host "AI Credits  : 0"
    Write-Host "========================================"

    # ------------------------------------------------
    # 1. EXPORT COLLECTION
    # ------------------------------------------------

    if ((Test-Path $RawExportPath) -and -not $ForceCollect) {
        Write-Host ""
        Write-Host "1. COLLECT CLARITY EXPORT DATA"
        Write-Host "----------------------------------------"
        Write-Host "Today's export snapshot already exists."
        Write-Host "Skipping Clarity Export API collection to protect daily quota."
        Write-Host "Existing file: data\raw\$Today-export.json"
    }
    else {
        Run-Step "1. COLLECT CLARITY EXPORT DATA" {
            node ".\scripts\collect-clarity-export.mjs"
        }
    }

    # ------------------------------------------------
    # 2. NORMALIZE
    # ------------------------------------------------

    Run-Step "2. NORMALIZE EXPORT DATA" {
        node ".\scripts\normalize-clarity-export.mjs"
    }

    # ------------------------------------------------
    # 3. HISTORY
    # ------------------------------------------------

    Run-Step "3. COMPARE EXPORT HISTORY" {
        powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\compare-history-export.ps1"
    }

    # ------------------------------------------------
    # 4. TARGETED RECORDINGS
    # ------------------------------------------------

    if ((Test-Path $TargetedRecordingsPath) -and -not $ForceRecordings) {
        Write-Host ""
        Write-Host "4. COLLECT TARGETED RECORDINGS"
        Write-Host "----------------------------------------"
        Write-Host "Today's targeted recordings already exist."
        Write-Host "Skipping recording requests to avoid duplicate Clarity calls."
        Write-Host "Existing file: data\recordings\$Today-targeted.json"
    }
    else {
        Run-Step "4. COLLECT TARGETED RECORDINGS" {
            node ".\scripts\collect-targeted-recordings.mjs"
        }
    }

    # ------------------------------------------------
    # 5. SESSION EVIDENCE
    # ------------------------------------------------

    if (Test-Path $TargetedRecordingsPath) {
        Run-Step "5. BUILD SESSION EVIDENCE" {
            node ".\scripts\build-session-evidence.mjs"
        }
    }
    else {
        Write-Host ""
        Write-Host "5. BUILD SESSION EVIDENCE"
        Write-Host "----------------------------------------"
        Write-Host "No targeted-recordings file exists for today."
        Write-Host "Skipping session evidence."
    }

    # ------------------------------------------------
    # 6. LOCAL REPORT
    # ------------------------------------------------

    Run-Step "6. BUILD LOCAL DAILY REPORT" {
        node ".\scripts\generate-daily-local-report.mjs"
    }

    $MarkdownReport = Join-Path $ProjectRoot "reports\clarity-local-daily-$Today.md"
    $HtmlReport = Join-Path $ProjectRoot "reports\clarity-local-daily-$Today.html"

    if (-not (Test-Path $MarkdownReport)) {
        throw "Expected Markdown report was not created: $MarkdownReport"
    }

    if (-not (Test-Path $HtmlReport)) {
        throw "Expected HTML report was not created: $HtmlReport"
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "DAILY LOCAL PIPELINE COMPLETE"
    Write-Host "========================================"
    Write-Host "Export      : PASS / SAFE-SKIP"
    Write-Host "Normalize   : PASS"
    Write-Host "Compare     : PASS"
    Write-Host "Recordings  : PASS / SAFE-SKIP"
    Write-Host "Evidence    : PASS / OPTIONAL-SKIP"
    Write-Host "Local report: PASS"
    Write-Host "AI Credits  : 0"
    Write-Host ""
    Write-Host "Markdown    : reports\clarity-local-daily-$Today.md"
    Write-Host "HTML        : reports\clarity-local-daily-$Today.html"
    Write-Host "========================================"
}
catch {
    Write-Host ""
    Write-Host "========================================"
    Write-Host "DAILY LOCAL PIPELINE FAILED"
    Write-Host "========================================"
    Write-Host $_.Exception.Message
    Write-Host "========================================"

    exit 1
}
finally {
    Pop-Location
}
