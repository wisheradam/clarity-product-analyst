$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$HistoryPath = Join-Path $ProjectRoot "data\history\daily-kpis-export.csv"
$ReportsDir = Join-Path $ProjectRoot "reports"
$ReportPath = Join-Path $ReportsDir "history-comparison-export-latest.md"

function To-Number {
    param([object]$Value)

    if ($null -eq $Value -or "$Value".Trim() -eq "") {
        return $null
    }

    $number = 0.0
    if ([double]::TryParse(
        "$Value",
        [System.Globalization.NumberStyles]::Float,
        [System.Globalization.CultureInfo]::InvariantCulture,
        [ref]$number
    )) {
        return $number
    }

    return $null
}

function Format-Number {
    param(
        [object]$Value,
        [int]$Decimals = 2
    )

    if ($null -eq $Value) {
        return "N/A"
    }

    return ([double]$Value).ToString(
        "F$Decimals",
        [System.Globalization.CultureInfo]::InvariantCulture
    )
}

function Get-PercentChange {
    param(
        [object]$Current,
        [object]$Previous
    )

    if ($null -eq $Current -or $null -eq $Previous) {
        return $null
    }

    $currentNumber = [double]$Current
    $previousNumber = [double]$Previous

    if ($previousNumber -eq 0) {
        return $null
    }

    return (($currentNumber - $previousNumber) / [math]::Abs($previousNumber)) * 100
}

function Get-Status {
    param(
        [object]$Current,
        [object]$Previous,
        [bool]$IsFriction = $false
    )

    if ($null -eq $Current -or $null -eq $Previous) {
        return "BASELINE"
    }

    $currentNumber = [double]$Current
    $previousNumber = [double]$Previous
    $absoluteChange = [math]::Abs($currentNumber - $previousNumber)

    if ($previousNumber -eq 0) {
        if ($absoluteChange -eq 0) {
            return "STABLE"
        }

        if ($IsFriction -and $absoluteChange -ge 2) {
            return "SIGNIFICANT"
        }

        return "WATCH"
    }

    $percentChange = [math]::Abs(
        (($currentNumber - $previousNumber) / [math]::Abs($previousNumber)) * 100
    )

    if ($IsFriction) {
        if ($percentChange -ge 40 -and $absoluteChange -ge 2) {
            return "SIGNIFICANT"
        }

        if ($percentChange -ge 20) {
            return "WATCH"
        }

        return "STABLE"
    }

    if ($percentChange -ge 40) {
        return "SIGNIFICANT"
    }

    if ($percentChange -ge 20) {
        return "WATCH"
    }

    return "STABLE"
}

function Format-Delta {
    param(
        [object]$Current,
        [object]$Previous,
        [int]$Decimals = 2
    )

    if ($null -eq $Current -or $null -eq $Previous) {
        return "N/A"
    }

    $difference = [double]$Current - [double]$Previous
    $differenceText = if ($difference -gt 0) {
        "+$(Format-Number $difference $Decimals)"
    } else {
        Format-Number $difference $Decimals
    }

    $percent = Get-PercentChange $Current $Previous

    if ($null -eq $percent) {
        return "$differenceText (N/A)"
    }

    $percentText = if ($percent -gt 0) {
        "+$(Format-Number $percent 2)%"
    } else {
        "$(Format-Number $percent 2)%"
    }

    return "$differenceText ($percentText)"
}

if (-not (Test-Path $HistoryPath)) {
    throw "History file not found: $HistoryPath"
}

$rows = @(
    Import-Csv $HistoryPath |
    Sort-Object {
        [datetime]::ParseExact(
            $_.date,
            "yyyy-MM-dd",
            [System.Globalization.CultureInfo]::InvariantCulture
        )
    }
)

if ($rows.Count -eq 0) {
    throw "History CSV contains no data rows."
}

New-Item -ItemType Directory -Path $ReportsDir -Force | Out-Null

$metricDefinitions = @(
    @{ Key = "total_sessions"; Label = "Total sessions"; Decimals = 0; Friction = $false },
    @{ Key = "bot_sessions"; Label = "Bot sessions"; Decimals = 0; Friction = $false },
    @{ Key = "human_sessions"; Label = "Human sessions"; Decimals = 0; Friction = $false },
    @{ Key = "distinct_users"; Label = "Distinct users"; Decimals = 0; Friction = $false },
    @{ Key = "pages_per_session_reported"; Label = "Pages/session (Export reported)"; Decimals = 4; Friction = $false },
    @{ Key = "engagement_total_seconds"; Label = "Engagement total (s)"; Decimals = 0; Friction = $false },
    @{ Key = "engagement_active_seconds"; Label = "Engagement active (s)"; Decimals = 0; Friction = $false },
    @{ Key = "engagement_active_percent"; Label = "Engagement active (%)"; Decimals = 2; Friction = $false },
    @{ Key = "dead_clicks"; Label = "Dead clicks"; Decimals = 0; Friction = $true },
    @{ Key = "quick_backs"; Label = "Quick backs"; Decimals = 0; Friction = $true },
    @{ Key = "rage_clicks"; Label = "Rage clicks"; Decimals = 0; Friction = $true },
    @{ Key = "excessive_scroll"; Label = "Excessive scroll"; Decimals = 0; Friction = $true },
    @{ Key = "script_errors"; Label = "Script errors"; Decimals = 0; Friction = $true },
    @{ Key = "error_clicks"; Label = "Error clicks"; Decimals = 0; Friction = $true }
)

$latest = $rows[-1]
$previousRows = @($rows | Select-Object -First ([math]::Max(0, $rows.Count - 1)))
$previous = if ($previousRows.Count -gt 0) { $previousRows[-1] } else { $null }
$previousSeven = @($previousRows | Select-Object -Last 7)

$lines = New-Object System.Collections.Generic.List[string]

$lines.Add("# Clarity Export History Comparison")
$lines.Add("")
$lines.Add("- Latest date: $($latest.date)")
$lines.Add("- Export history rows: $($rows.Count)")
$lines.Add("- Source: Microsoft Clarity Data Export API")
$lines.Add("- Note: this report compares Export API history only; it does not merge older MCP-derived KPI definitions.")
$lines.Add("")

if ($null -eq $previous) {
    $lines.Add("## Baseline")
    $lines.Add("")
    $lines.Add("Only one Export API day is available, so there is no previous-day comparison yet.")
    $lines.Add("")
    $lines.Add("| Metric | Latest | Status |")
    $lines.Add("|---|---:|---|")

    foreach ($metric in $metricDefinitions) {
        $current = To-Number $latest.($metric.Key)
        $lines.Add(
            "| $($metric.Label) | $(Format-Number $current $metric.Decimals) | BASELINE |"
        )
    }
}
else {
    $lines.Add("## Previous-day comparison")
    $lines.Add("")
    $lines.Add("- Previous date: $($previous.date)")
    $lines.Add("")
    $lines.Add("| Metric | Previous | Latest | Change | Status |")
    $lines.Add("|---|---:|---:|---:|---|")

    foreach ($metric in $metricDefinitions) {
        $current = To-Number $latest.($metric.Key)
        $prior = To-Number $previous.($metric.Key)
        $status = Get-Status $current $prior $metric.Friction
        $delta = Format-Delta $current $prior $metric.Decimals

        $lines.Add(
            "| $($metric.Label) | $(Format-Number $prior $metric.Decimals) | $(Format-Number $current $metric.Decimals) | $delta | $status |"
        )
    }

    if ($previousSeven.Count -gt 0) {
        $lines.Add("")
        $lines.Add("## Previous-7-row average")
        $lines.Add("")
        $lines.Add("The average uses up to the previous 7 Export API rows and excludes the latest day.")
        $lines.Add("")
        $lines.Add("| Metric | Prior avg | Latest | Change vs avg |")
        $lines.Add("|---|---:|---:|---:|")

        foreach ($metric in $metricDefinitions) {
            $values = @(
                foreach ($row in $previousSeven) {
                    $value = To-Number $row.($metric.Key)
                    if ($null -ne $value) {
                        $value
                    }
                }
            )

            $average = if ($values.Count -gt 0) {
                ($values | Measure-Object -Average).Average
            } else {
                $null
            }

            $current = To-Number $latest.($metric.Key)
            $delta = Format-Delta $current $average $metric.Decimals

            $lines.Add(
                "| $($metric.Label) | $(Format-Number $average $metric.Decimals) | $(Format-Number $current $metric.Decimals) | $delta |"
            )
        }
    }
}

$lines.Add("")
$lines.Add("## Interpretation rules")
$lines.Add("")
$lines.Add("- STABLE: absolute percentage change below 20%.")
$lines.Add("- WATCH: absolute percentage change of at least 20%.")
$lines.Add("- SIGNIFICANT: absolute percentage change of at least 40%.")
$lines.Add("- For friction metrics, SIGNIFICANT also requires an absolute change of at least 2 events.")
$lines.Add("- If the previous value is zero, percentage change is reported as N/A instead of infinity.")
$lines.Add("- `pages_per_session_reported` is preserved exactly as exported by Clarity and is not used to manufacture page-view totals.")
$lines.Add("- `engagement_total_seconds` and `engagement_active_seconds` are Export API fields and are not treated as the old MCP average-engagement metric.")
$lines.Add("")

$report = ($lines -join "`n") + "`n"
Set-Content -Path $ReportPath -Value $report -Encoding UTF8

Write-Host ""
Write-Host "========================================"
Write-Host "CLARITY EXPORT HISTORY COMPARISON"
Write-Host "========================================"
Write-Host "Latest date : $($latest.date)"
Write-Host "History rows: $($rows.Count)"

if ($null -eq $previous) {
    Write-Host "Comparison  : BASELINE ONLY"
}
else {
    Write-Host "Previous day: $($previous.date)"
    Write-Host "Comparison  : PASS"
}

Write-Host "Report      : reports\history-comparison-export-latest.md"
Write-Host "AI Credits  : 0"
Write-Host "========================================"
