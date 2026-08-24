$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env"

if (-not (Test-Path $envFile)) {
    throw ".env file not found: $envFile"
}

$tokenLine = Get-Content $envFile |
    Where-Object { $_ -match '^\s*CLARITY_API_TOKEN=' } |
    Select-Object -First 1

if (-not $tokenLine) {
    throw "CLARITY_API_TOKEN was not found in .env"
}

$env:CLARITY_API_TOKEN = ($tokenLine -split '=', 2)[1].Trim()

if ([string]::IsNullOrWhiteSpace($env:CLARITY_API_TOKEN)) {
    throw "CLARITY_API_TOKEN is empty"
}

& npx.cmd -y "@microsoft/clarity-mcp-server"
exit $LASTEXITCODE