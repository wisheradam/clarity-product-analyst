[CmdletBinding()]
param(
    [string]$InputPath,
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($InputPath)) {
    $InputPath = Join-Path $PSScriptRoot '..\data\history\daily-kpis.csv'
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path $PSScriptRoot '..\reports\history-comparison-latest.md'
}

$metricNames = @(
    'sessions',
    'users',
    'page_views',
    'pages_per_session',
    'average_engagement_seconds',
    'rage_clicks',
    'dead_clicks',
    'quick_backs',
    'excessive_scroll_sessions',
    'script_errors'
)
$frustrationMetrics = @(
    'rage_clicks',
    'dead_clicks',
    'quick_backs',
    'excessive_scroll_sessions',
    'script_errors'
)

if (-not (Test-Path -LiteralPath $InputPath)) {
    throw "Input file not found: $InputPath"
}

$rows = @(Import-Csv -LiteralPath $InputPath | Sort-Object { [datetime]$_.date })
if ($rows.Count -eq 0) {
    throw "No historical rows found in $InputPath"
}

function Get-Number {
    param([object]$Value)

    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        return $null
    }

    return [decimal]::Parse([string]$Value, [Globalization.CultureInfo]::InvariantCulture)
}

function Format-Value {
    param([object]$Value)

    if ($null -eq $Value) {
        return 'N/A'
    }

    $number = [decimal]$Value
    if ($number -eq [decimal]::Truncate($number)) {
        return $number.ToString('0', [Globalization.CultureInfo]::InvariantCulture)
    }

    return $number.ToString('0.##', [Globalization.CultureInfo]::InvariantCulture)
}

function Get-Percentage {
    param(
        [Nullable[decimal]]$Current,
        [Nullable[decimal]]$Baseline
    )

    if ($null -eq $Current -or $null -eq $Baseline -or $Baseline -eq 0) {
        return $null
    }

    return (($Current - $Baseline) / [math]::Abs($Baseline)) * 100
}

function Get-Status {
    param(
        [Nullable[decimal]]$Percentage,
        [Nullable[decimal]]$AbsoluteChange,
        [string]$Metric
    )

    if ($null -eq $Percentage) {
        if ($null -ne $AbsoluteChange -and $AbsoluteChange -ne 0 -and $Metric -in $frustrationMetrics -and $AbsoluteChange -ge 2) {
            return 'WATCH'
        }
        return 'NORMAL'
    }

    $magnitude = [math]::Abs($Percentage)
    if ($magnitude -ge 40 -and $Metric -in $frustrationMetrics -and ($null -eq $AbsoluteChange -or $AbsoluteChange -lt 2)) {
        return 'WATCH'
    }
    if ($magnitude -ge 40) {
        return 'SIGNIFICANT'
    }
    if ($magnitude -ge 20) {
        return 'WATCH'
    }

    return 'NORMAL'
}

function Format-Change {
    param([Nullable[decimal]]$Value)

    if ($null -eq $Value) {
        return 'N/A'
    }

    return (Format-Value $Value)
}

function Format-Percentage {
    param([Nullable[decimal]]$Value)

    if ($null -eq $Value) {
        return 'N/A'
    }

    return (([decimal]$Value).ToString('0.##', [Globalization.CultureInfo]::InvariantCulture) + '%')
}

$current = $rows[$rows.Count - 1]
$previous = $null
if ($rows.Count -gt 1) {
    $previous = $rows[$rows.Count - 2]
}
$baselineRows = @($rows | Select-Object -Skip ([math]::Max(0, $rows.Count - 8)) | Select-Object -SkipLast 1)
$baselineRows = @($baselineRows | Select-Object -Last 7)

$comparisonRows = @()
foreach ($metric in $metricNames) {
    $currentValue = Get-Number $current.$metric
    $previousValue = if ($null -ne $previous) { Get-Number $previous.$metric } else { $null }
    $previousChange = if ($null -ne $currentValue -and $null -ne $previousValue) { $currentValue - $previousValue } else { $null }
    $previousPercentage = Get-Percentage $currentValue $previousValue

    $averageValue = $null
    if ($baselineRows.Count -gt 0) {
        $baselineValues = @($baselineRows | ForEach-Object { Get-Number $_.$metric } | Where-Object { $null -ne $_ })
        if ($baselineValues.Count -gt 0) {
            $averageValue = ($baselineValues | Measure-Object -Average).Average
        }
    }
    $averageChange = if ($null -ne $currentValue -and $null -ne $averageValue) { $currentValue - $averageValue } else { $null }
    $averagePercentage = Get-Percentage $currentValue $averageValue

    $comparisonRows += [pscustomobject]@{
        Metric = $metric
        Current = $currentValue
        Previous = $previousValue
        PreviousChange = $previousChange
        PreviousPercentage = $previousPercentage
        PreviousStatus = Get-Status $previousPercentage $previousChange $metric
        Average = $averageValue
        AverageChange = $averageChange
        AveragePercentage = $averagePercentage
        AverageStatus = Get-Status $averagePercentage $averageChange $metric
    }
}

$reportLines = [System.Collections.Generic.List[string]]::new()
[void]$reportLines.Add('# Clarity Historical Comparison')
[void]$reportLines.Add('')
[void]$reportLines.Add('## Current Day')
[void]$reportLines.Add('')
[void]$reportLines.Add(('Date: {0}' -f $current.date))
[void]$reportLines.Add(('Historical rows available: {0}' -f $rows.Count))
[void]$reportLines.Add('')

if ($rows.Count -eq 1) {
    [void]$reportLines.Add('Insufficient historical data for comparison.')
    [void]$reportLines.Add('')
}

[void]$reportLines.Add('## Today vs Previous Day')
[void]$reportLines.Add('')
[void]$reportLines.Add('| Metric | Current | Previous | Change | Change % | Status |')
[void]$reportLines.Add('|---|---:|---:|---:|---:|---|')
foreach ($row in $comparisonRows) {
    [void]$reportLines.Add(('| {0} | {1} | {2} | {3} | {4} | {5} |' -f @($row.Metric, (Format-Value $row.Current), (Format-Value $row.Previous), (Format-Change $row.PreviousChange), (Format-Percentage $row.PreviousPercentage), $row.PreviousStatus)))
}
[void]$reportLines.Add('')
[void]$reportLines.Add('## Today vs Previous 7-Day Average')
[void]$reportLines.Add('')
[void]$reportLines.Add('| Metric | Current | 7-day avg | Difference | Difference % | Status |')
[void]$reportLines.Add('|---|---:|---:|---:|---:|---|')
foreach ($row in $comparisonRows) {
    [void]$reportLines.Add(('| {0} | {1} | {2} | {3} | {4} | {5} |' -f @($row.Metric, (Format-Value $row.Current), (Format-Value $row.Average), (Format-Change $row.AverageChange), (Format-Percentage $row.AveragePercentage), $row.AverageStatus)))
}
[void]$reportLines.Add('')
[void]$reportLines.Add('## Significant Changes')
[void]$reportLines.Add('')
$significantRows = @($comparisonRows | Where-Object { $_.PreviousStatus -in @('WATCH', 'SIGNIFICANT') -or $_.AverageStatus -in @('WATCH', 'SIGNIFICANT') })
if ($significantRows.Count -eq 0) {
    [void]$reportLines.Add('None.')
} else {
    foreach ($row in $significantRows) {
        $statuses = @()
        if ($row.PreviousStatus -in @('WATCH', 'SIGNIFICANT')) { $statuses += "previous day: $($row.PreviousStatus)" }
        if ($row.AverageStatus -in @('WATCH', 'SIGNIFICANT')) { $statuses += "previous 7-day average: $($row.AverageStatus)" }
        [void]$reportLines.Add('- **{0}** — {1}; previous-day change {2} ({3}); 7-day difference {4} ({5}).' -f $row.Metric, ($statuses -join ', '), (Format-Change $row.PreviousChange), (Format-Percentage $row.PreviousPercentage), (Format-Change $row.AverageChange), (Format-Percentage $row.AveragePercentage))
    }
}
[void]$reportLines.Add('')
[void]$reportLines.Add('## Data Availability')
[void]$reportLines.Add('')
[void]$reportLines.Add(('Historical days available: {0}.' -f $rows.Count))
if ($baselineRows.Count -eq 7) {
    [void]$reportLines.Add('The previous 7-day baseline is complete with 7 available prior rows.')
} elseif ($baselineRows.Count -gt 0) {
    [void]$reportLines.Add(('The previous 7-day baseline is incomplete with {0} available prior rows.' -f $baselineRows.Count))
} else {
    [void]$reportLines.Add('The previous 7-day baseline is unavailable because no prior rows exist.')
}

$outputDirectory = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}
Set-Content -LiteralPath $OutputPath -Value $reportLines -Encoding UTF8
Write-Output ('Historical rows detected: {0}' -f $rows.Count)
Write-Output ('Report written: {0}' -f $OutputPath)
