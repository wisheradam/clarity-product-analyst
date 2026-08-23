# Clarity Daily Product Report

## Analysis Window

Local (Asia/Jerusalem): 2026-08-22 14:59:24.546 +03:00 to 2026-08-23 14:59:24.546 +03:00

UTC query range: 2026-08-22T11:59:24.546Z to 2026-08-23T11:59:24.546Z

## Executive Summary

### Observed

- Microsoft Clarity returned 71 sessions, 54 unique users, 185 page views, and 88.18 seconds average engagement time.
- Clarity returned 3 dead clicks and 16 quick backs. It returned 0 rage clicks, 0 excessive-scroll sessions, and 0 JavaScript errors.
- Dead clicks were attributed to `https://innova.co/aio/` (2) and `https://innova.co/documentation/technical-resources/` (1).
- Quick backs were attributed most often to `https://innova.co/` (5), followed by `https://innova.co/aio/ceiling-suspended-w-erv/` (2); eight other pages had one each.

### Derived

- Pages per session: 185 / 71 = **2.61**.
- The recording filters returned 9 quick-back recordings and 1 distinct dead-click recording. The dead-click recording contains 2 dead-click events.

### Hypothesis

- The repeated movement among product and documentation pages may represent comparison or resource-seeking behavior. This is a hypothesis only; Clarity does not provide the visitor's intent.

## Core Metrics

| Metric | Value |
|---|---:|
| Sessions | 71 |
| Users | 54 |
| Page views | 185 |
| Pages/session | 2.61 (Derived) |
| Avg engagement | 88.18 seconds |

## Top Pages

| Page | Page views |
|---|---:|
| https://innova.co/ | 41 |
| https://innova.co/aio/wall-mounted/ | 22 |
| https://innova.co/aio/ | 21 |
| https://innova.co/aio/vertical-stack/ | 14 |
| https://innova.co/aio/ceiling-ducted/ | 10 |
| https://innova.co/aio/ceiling-suspended/ | 8 |
| https://innova.co/aio/wall-mounted-pro/ | 8 |
| https://innova.co/documentation/user-guides/ | 7 |
| https://innova.co/documentation/technical-resources/ | 6 |
| https://innova.co/aio/ceiling-suspended-w-erv/ | 5 |

## Frustration Signals

| Signal | Count | Main affected pages |
|---|---:|---|
| Rage clicks | 0 | None returned |
| Dead clicks | 3 | `/aio/` (2), `/documentation/technical-resources/` (1) |
| Quick backs | 16 | `/` (5), `/aio/ceiling-suspended-w-erv/` (2), eight pages with 1 each |
| Excessive scroll | 0 sessions | None returned |
| Script errors | 0 | None returned |

## Sessions Worth Investigating

Clarity returned 9 recordings for the quick-back filter and 1 additional distinct dead-click recording. Device and browser were not returned. Clarity's event `start` values are preserved as raw timestamps and are not treated as session elapsed time.

### Session 1

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/eby2sd/1211g0q  
Session timestamp: 2026-08-22 14:01:16 (Clarity raw session timestamp)  
Duration: 30 minutes and 40 seconds  
Active duration: 13 minutes and 53 seconds  
Entry page: https://innova.co/  
Signals: Quick back (recording filter); exact event object not returned in the recording timeline.

Journey and page durations:

1. `https://innova.co/` — start `00:00`, duration 8.0s, referrer `https://www.google.com/`
2. `https://innova.co/split-systems/` — start `00:08`, duration 12.2s, referrer `https://innova.co/`
3. `https://innova.co/` — start `00:20`, duration 0.7s, referrer `https://www.google.com/`
4. `https://innova.co/` — start `09:57`, duration 9.4s, referrer `https://www.google.com/`
5. `https://innova.co/aio/wall-mounted/` — start `10:06`, duration 313.9s, referrer `https://innova.co/`
6. `https://innova.co/aio/wall-mounted/` — start `22:31`, duration 6.1s, referrer `https://innova.co/`
7. `https://innova.co/aio/wall-mounted/` — start `22:37`, duration 482.9s, referrer `https://innova.co/aio/wall-mounted/`

Session click count: 15. Event fields for the quick-back signal: event type, text, link, hash, and raw timestamp were not returned.

### Session 2

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/1fh11rp/pm8zh6  
Session timestamp: 2026-08-22 14:38:19 (Clarity raw session timestamp)  
Duration: 8 minutes and 30 seconds  
Active duration: 8 minutes and 28 seconds  
Entry page: https://innova.co/  
Signals: Quick back (recording filter); exact event object not returned.

Journey: `https://innova.co/` (00:00, 13.5s) -> `https://innova.co/aio/nextgen-pthp/` (00:13, 337.5s) -> `https://innova.co/` (05:50, 25.8s) -> `https://innova.co/documentation/technical-resources/` (06:16, 27.5s) -> `https://innova.co/` (06:44, 0.8s) -> `https://innova.co/` (06:47, 21.0s) -> `https://innova.co/documentation/technical-resources/` (07:08, 82.1s). Referrers were returned per page in the raw payload; no additional referrer is reproduced here beyond the sequence. Session click count: 22.

### Session 3 (dead clicks)

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/5ibe1c/jb6t7l  
Session timestamp: 2026-08-22 15:49:02 (Clarity raw session timestamp)  
Duration: 24 minutes and 12 seconds  
Active duration: 15 minutes and 09 seconds  
Entry page: https://innova.co/  
Signals: Quick back (recording filter); 2 dead clicks.

Journey and page durations:

1. `https://innova.co/` — start `00:00`, duration 409.802s, referrer null
2. `https://innova.co/aio/vertical-stack/` — start `06:49`, duration 15.349s, referrer `https://innova.co/`
3. `https://innova.co/aio/vertical-stack/` — start `16:07`, duration 2.827s, referrer `https://innova.co/`
4. `https://innova.co/aio/vertical-stack/` — start `16:10`, duration 19.497s, referrer null
5. `https://innova.co/aio/` — start `16:30`, duration 456.735s, referrer `https://innova.co/aio/vertical-stack/`
6. `https://innova.co/aio/` — start `24:06`, duration 5.737s, referrer `https://innova.co/aio/vertical-stack/`

Dead-click events, in returned order:

1. Page: `https://innova.co/aio/`; Clarity raw timestamp: `01:03:47`; eventtype: `Dead click`; text: `""`; link: `""`; hash: `6gzvxvwb0`.
2. Page: `https://innova.co/aio/`; Clarity raw timestamp: `01:03:49`; eventtype: `Dead click`; text: `""`; link: `""`; hash: `7tmgv9haa`.

The preceding and following events in the returned timeline are not temporally reliable because Clarity raw event timestamps exceed the session duration. The nearest returned event before the dead-click entries is a `Click` with text `AIO All-In-One Heat Pump`, link `""`, hash `5ncbf10i8`, raw timestamp `01:03:17`, on `https://innova.co/aio/vertical-stack/`. No event after the two dead clicks was returned before the next page-timeline boundary. Exact clicked element/target: not returned.

Session click count: 11.

### Session 4

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/1ng1l05/1a31d7w  
Session timestamp: 2026-08-22 16:13:17 (Clarity raw session timestamp)  
Duration: 12 minutes and 02 seconds; active duration 12 minutes and 02 seconds; entry page `https://innova.co/aio/`; session clicks 14.  
Signal: Quick back (recording filter); exact event object not returned.

Journey: `aio/` (00:00, 17.0s) -> `aio/nextgen-pthp/` (00:16, 31.4s) -> `aio/` (00:48, 6.3s) -> `aio/vertical-stack/` (00:54, 72.2s) -> `aio/` (02:06, 7.1s) -> `aio/ceiling-suspended-w-erv/` (02:13, 150.6s) -> `aio/ceiling-suspended/` (04:44, 9.0s) -> `aio/ceiling-suspended-w-erv/` (04:53, 3.0s) -> `aio/ceiling-ducted/` (04:56, 20.1s) -> `aio/ceiling-suspended-w-erv/` (05:16, 4.5s) -> same page (05:21, 47.5s) -> `aio/` (06:08, 7.0s) -> `aio/ceiling-suspended-w-erv/` (07:08, 17.0s). URLs are shortened only by removing the common `https://innova.co/` prefix.

### Session 5

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/ejbbbu/111tdam  
Session timestamp: 2026-08-22 18:50:10 (Clarity raw session timestamp)  
Duration: 12 minutes and 24 seconds; active duration 12 minutes and 24 seconds; entry page `https://innova.co/`; session clicks 17.  
Signal: Quick back (recording filter); exact event object not returned.

Journey: `https://innova.co/` (00:00, 4.2s) -> `https://innova.co/louvers/#Round-vents` (00:04, 31.6s) -> `https://innova.co/documentation/brochures/` (00:35, 20.7s) -> `https://innova.co/contact-us/locations/` (00:56, 25.6s) -> `https://innova.co/documentation/brochures/` (01:22, 11.0s) -> `https://innova.co/documentation/` (01:33, 4.6s) -> `https://innova.co/documentation/technical-resources/` (01:37, 647.1s).

### Session 6

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/acsyxq/1sf33d9  
Session timestamp: 2026-08-22 20:35:25 (Clarity raw session timestamp)  
Duration: 33 minutes and 13 seconds; active duration 29 minutes and 39 seconds; entry page `https://innova.co/`; session clicks 23.  
Signal: Quick back (recording filter); exact event object not returned.

Journey: `/` (00:00, 848.3s) -> `/osmo/` (14:08, 319.2s) -> `/osmo/recessed-ceiling-plaster-frame/` (19:27, 10.8s) -> `/osmo/high-wall/` (19:38, 9.8s) -> `/osmo/recessed-high-wall-plaster-frame/` (19:48, 5.3s) -> `/osmo/vertical-stack/` (19:53, 26.0s) -> `/osmo/multi-zone-ducted/` (20:19, 13.6s) -> `/osmo/wall-mounted/` (20:33, 4.3s) -> `/osmo/recessed-wall/` (20:37, 342.9s) -> same page (29:54, 7.1s) -> `/osmo/frameless-trench/` (30:01, 6.7s) -> `/osmo/recessed-wall/` (30:08, 185.2s).

### Session 7

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/43b3x4/69r6jl  
Session timestamp: 2026-08-22 23:59:14 (Clarity raw session timestamp)  
Duration: 10 minutes and 40 seconds; active duration 10 minutes and 30 seconds; entry page `https://innova.co/`; session clicks 19.  
Signal: Quick back (recording filter); exact event object not returned.

Journey: `/` (00:00, 25.6s) -> `/aio/` (00:29, 81.2s) -> `/aio/vertical-stack-xl/` (01:54, 105.0s) -> `/aio/#models` (03:39, 65.9s) -> `/aio/ceiling-suspended/` (04:48, 121.7s) -> `/aio/#models` (06:49, 91.1s) -> `/aio/vertical-stack-xl/` (08:20, 133.7s) -> `/aio/#models` (10:34, 6.3s).

### Session 8

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/10teu48/1ere724  
Session timestamp: 2026-08-23 01:37:59 (Clarity raw session timestamp)  
Duration: 4 minutes and 24 seconds; active duration 4 minutes and 20 seconds; entry page `https://innova.co/`; session clicks 12.  
Signal: Quick back (recording filter); exact event object not returned.

Journey: `/` (00:00, 34.9s) -> `/single-package-systems/` (00:34, 17.9s) -> `/` (00:52, 3.6s) -> `/split-systems/` (00:56, 7.4s) -> `/` (01:03, 3.8s) -> `/aio/wall-mounted/` (01:07, 42.0s) -> `/` (01:49, 47.5s) -> `/contact-us/` (02:37, 68.9s) -> `/` (03:46, 1.8s) -> `/aio/wall-mounted/` (03:47, 1.7s) -> `/` (03:49, 1.6s) -> `/` (03:54, 29.5s).

### Session 9

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/a45w8/rgvosf  
Session timestamp: 2026-08-23 03:46:26 (Clarity raw session timestamp)  
Duration: 21 seconds; active duration 21 seconds; entry page `https://innova.co/`; session clicks 2.  
Signal: Quick back (recording filter); exact event object not returned.

Journey: `/` (00:00, 11.4s) -> `/aio/wall-mounted/` (00:11, 9.7s) -> `/` (00:21, 0.1s).

### Session 10 (distinct dead-click recording)

Recording: https://clarity.microsoft.com/player/w3qrlxl7vj/14gmckw/8f76if  
Session timestamp: 2026-08-22 14:55:27 (Clarity raw session timestamp)  
Duration: 8 minutes and 10 seconds; active duration 8 minutes and 10 seconds; entry page `https://innova.co/documentation/technical-resources/`; session clicks 7.  
Signal: 1 dead click.

Journey: `https://innova.co/documentation/technical-resources/` — start `00:00`, duration 490.704s, referrer null.

Dead-click event: page `https://innova.co/documentation/technical-resources/`; Clarity raw timestamp `00:02`; eventtype `Dead click`; text `""`; link `""`; hash `53dnemxp7`. The preceding returned event was `Click`, text `Wall Mounted`, raw timestamp `00:01`, hash `1ldjfs5ui`. The following returned event was `Click`, text `" "`, raw timestamp `00:04`, hash `59u1rj5k1`. Exact clicked element/target: not returned.

## Product Findings

### Finding 1

Problem: Dead-click activity was observed on two pages.

Evidence: Clarity returned 3 dead clicks: 2 on `/aio/` in one recording and 1 on `/documentation/technical-resources/` in another.

Hypothesis: The recorded click targets may not have responded as expected, but the payload does not identify the target or cause.

Affected pages: `/aio/`; `/documentation/technical-resources/`.

Confidence: MEDIUM.

Priority: P2.

Recording evidence: `5ibe1c/jb6t7l`; `14gmckw/8f76if`.

### Finding 2

Problem: Quick-back activity was observed across multiple pages, with the highest count on the home page.

Evidence: Clarity returned 16 quick backs; page ranking was `/` (5), `/aio/ceiling-suspended-w-erv/` (2), and eight pages with 1 each. Nine quick-back recordings were returned.

Hypothesis: Some visitors may have been navigating back while comparing pages or looking for a different destination. Intent is not returned by Clarity.

Affected pages: Primarily `/`; also the pages listed in the frustration ranking.

Confidence: MEDIUM.

Priority: P3.

Recording evidence: The nine quick-back recording URLs listed above. Exact quick-back event objects were not returned in the recording timeline payload.

## Data Limitations

- Device, browser, geography, and user identity were not returned in the recording payload.
- Quick-back recordings were returned by the signal filter, but their individual quick-back event objects were not present in the timeline event arrays.
- Rage-click, excessive-scroll, and JavaScript-error recording filters returned no recordings.
- `event.start` is preserved as a Clarity raw timestamp. The payload does not reliably map it to session elapsed time; it must not be converted or described as elapsed session time.
- The session timestamp returned by Clarity is preserved as a raw session timestamp. It was not independently labeled by Clarity as UTC, so no unsupported timezone conversion is applied to recording starts.
- Exact dead-click DOM element, coordinates, selector, and target were not returned. Event text and link were empty strings for the returned dead-click objects.
- Some page timeline durations and event timestamps are inconsistent with the session `totalDuration`; both are reproduced as returned and not reconciled.
- Page-level referrer, performance fields, and event arrays are available in the raw payload, but not every page detail is repeated in full for every session above.