## SECURITY RULE

Never read, inspect, search, print, open, summarize, or access `.env`.

The `.env` file contains secrets and must never enter AI context.

Do not use `.env` directly for any task.
Do not request its contents.
Do not expose authentication values.

---

# Microsoft Clarity — Daily Run

Run the complete daily Microsoft Clarity analytics workflow for innova.co.

First read and follow:

- prompts/daily-analysis.md
- prompts/session-investigation.md

Use Microsoft Clarity MCP for all Clarity data.

## Time

Use Asia/Jerusalem.

Determine the actual current local time.

Analyze exactly the previous 24 hours:

current time - 24 hours → current time

Convert the range to UTC before querying Clarity.

Never query into the future.

## Daily analysis

Collect:

- sessions
- unique users
- page views
- average engagement time
- top 10 pages
- rage clicks
- dead clicks
- quick backs
- excessive scrolling
- JavaScript/script errors

Inspect matching session recordings for frustration signals.

Follow all evidence, hypothesis, missing-data and timestamp rules defined in:

prompts/daily-analysis.md
prompts/session-investigation.md

Never interpret Clarity event.start as session-relative time unless the payload proves it.

## Create daily report

Create or replace:

reports/clarity-daily-YYYY-MM-DD.md

## Create raw snapshot

Create or replace:

data/raw/YYYY-MM-DD.json

Include:

- analysis window
- metrics
- top pages
- frustration pages
- recordings
- limitations

Do not invent unavailable fields.

## Update KPI history

Update:

data/history/daily-kpis.csv

Required columns:

date,local_start,local_end,sessions,users,page_views,pages_per_session,average_engagement_seconds,rage_clicks,dead_clicks,quick_backs,excessive_scroll_sessions,script_errors

Calculate:

pages_per_session = page_views / sessions

Protect against duplicate dates.

If today's row already exists, replace it.

Keep the CSV sorted by date.

## Validate

Validate:

- report exists
- JSON parses
- CSV parses
- numeric values are numeric
- today's date appears exactly once

If validation fails, stop.

## Historical comparison

Run:

powershell -ExecutionPolicy Bypass -File scripts/compare-history.ps1

Then read:

reports/history-comparison-latest.md

Only surface WATCH and SIGNIFICANT historical changes.

If there is not enough history, say:

Insufficient historical data for trend analysis.

## Protected files

Never modify:

- .env
- .gitignore
- .mcp.json
- .vscode/mcp.json
- prompts/daily-analysis.md
- prompts/session-investigation.md
- scripts/compare-history.ps1
- scripts/start-clarity-mcp.ps1

Never expose the Clarity API token.