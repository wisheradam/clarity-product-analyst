# Clarity Export History Comparison

- Latest date: 2026-08-26
- Export history rows: 1
- Source: Microsoft Clarity Data Export API
- Note: this report compares Export API history only; it does not merge older MCP-derived KPI definitions.

## Baseline

Only one Export API day is available, so there is no previous-day comparison yet.

| Metric | Latest | Status |
|---|---:|---|
| Total sessions | 233 | BASELINE |
| Bot sessions | 6 | BASELINE |
| Human sessions | 227 | BASELINE |
| Distinct users | 178 | BASELINE |
| Pages/session (Export reported) | 3.1210 | BASELINE |
| Engagement total (s) | 601 | BASELINE |
| Engagement active (s) | 203 | BASELINE |
| Engagement active (%) | 33.78 | BASELINE |
| Dead clicks | 13 | BASELINE |
| Quick backs | 96 | BASELINE |
| Rage clicks | 0 | BASELINE |
| Excessive scroll | 0 | BASELINE |
| Script errors | 0 | BASELINE |
| Error clicks | 0 | BASELINE |

## Interpretation rules

- STABLE: absolute percentage change below 20%.
- WATCH: absolute percentage change of at least 20%.
- SIGNIFICANT: absolute percentage change of at least 40%.
- For friction metrics, SIGNIFICANT also requires an absolute change of at least 2 events.
- If the previous value is zero, percentage change is reported as N/A instead of infinity.
- pages_per_session_reported is preserved exactly as exported by Clarity and is not used to manufacture page-view totals.
- engagement_total_seconds and engagement_active_seconds are Export API fields and are not treated as the old MCP average-engagement metric.


