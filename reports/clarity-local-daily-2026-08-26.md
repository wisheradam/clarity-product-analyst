# INNOVA Clarity Daily — 2026-08-26

_Deterministic report — no AI used._

## Executive Summary

- Traffic: 227 human sessions from 178 distinct users.
- Dead clicks: 13 events across 3.43% of sessions.
- Quick backs: 96 events across 20.60% of sessions.
- Evidence reviewed: 26 targeted recordings with 110 deterministic diagnostic flags.

## KPI Snapshot

| Metric | Value |
|---|---:|
| Total sessions | 233 |
| Bot sessions | 6 |
| Human sessions | 227 |
| Distinct users | 178 |
| Pages/session (Clarity reported) | 3.121 |
| Total page views | Unavailable |
| Engagement total | 601 s |
| Engagement active | 203 s |
| Active-time ratio | 33.78% |
| Average engagement | Unmapped |

## Friction Signals

| Signal | Count | Sessions | Priority |
|---|---:|---:|---|
| Dead clicks | 13 | 3.43% | P2 |
| Quick backs | 96 | 20.60% | P1 |
| Rage clicks | 0 | 0.00% | None |
| Excessive scroll | 0 | 0.00% | None |
| Script errors | 0 | 0.00% | None |
| Error clicks | 0 | 0.00% | None |

## Targeted Session Evidence

### dead clicks

- Aggregate events: 13
- Sampled recordings parsed: 6

- https://innova.co/tools/aio-nomenclature-generator/ — 5 occurrences
- https://innova.co/louvers/ — 5 occurrences
- https://innova.co/innovacon-2026/ — 4 occurrences
- https://innova.co/documentation/technical-resources/ — 3 occurrences
- https://innova.co/tools/shipping-cost-calculator/ — 2 occurrences
- https://innova.co/contact-us/locations/ — 1 occurrence

### quick backs

- Aggregate events: 96
- Sampled recordings parsed: 20

- https://innova.co/ — 36 occurrences
- https://innova.co/aio/wall-mounted-pro/ — 15 occurrences
- https://innova.co/aio/wall-mounted/ — 12 occurrences
- https://innova.co/aio/ — 9 occurrences
- https://innova.co/aio/ceiling-ducted/ — 7 occurrences
- https://innova.co/osmo/wall-mounted/ — 5 occurrences

## Recommended Actions

1. **P1 — Review dead-click hotspots:** Inspect the highest-frequency dead-click pages and verify overlays, menu behavior, click affordances, and elements that appear interactive but may not respond.
2. **P1 — Investigate quick-back landing pages:** Compare referrer/search intent against first-screen content, navigation clarity, product naming, and whether users land on the page they expected.
3. **P2 — Check layout-shift pages:** Review pages flagged for high CLS and identify late-loading media, widgets, menus, fonts, or injected components that move content after render.
4. **P2 — Review performance bottlenecks:** Inspect pages with slow LCP/page-load flags, focusing on image weight, scripts, fonts, and third-party services.
5. **P2 — Watch repeated-click recordings:** Confirm whether repeated clicks indicate an unresponsive control, delayed feedback, a hidden overlay, or intentional repeated interaction.

## Data Quality & Limitations

- Targeted recordings are samples, not the complete population.
- Diagnostic flags are investigation heuristics, not confirmed UX defects.
- Total page views are unavailable from the current Export API mapping.
- Export API engagement fields are preserved directly and are not mapped to the earlier MCP average-engagement metric.
- Clarity `start` values are preserved as raw timestamps and are not interpreted as elapsed session time.
- This report is deterministic and uses no AI-generated interpretation.

