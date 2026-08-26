import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";

import path from "node:path";

// ==================================================
// CONFIG
// ==================================================

const RECORDINGS_DIR =
  path.join("data", "recordings");

const CONTEXT_DIR =
  path.join("data", "analysis-context");

const REPORTS_DIR =
  "reports";

// These are diagnostic heuristics only.
// They are not treated as proof of a UX defect.
const HEURISTICS = {
  slowPageLoadMs: 2500,
  poorLcpSeconds: 2.5,
  highCls: 0.25,
  repeatedTargetClicks: 3,
};

// ==================================================
// HELPERS
// ==================================================

async function findLatestTargeted() {
  const files =
    await readdir(
      RECORDINGS_DIR
    );

  const matches =
    files
      .filter(
        (file) =>
          /^\d{4}-\d{2}-\d{2}-targeted\.json$/.test(
            file
          )
      )
      .sort();

  if (matches.length === 0) {
    throw new Error(
      "No targeted recordings file found."
    );
  }

  return matches[
    matches.length - 1
  ];
}

function asNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "Not available"
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function parseSecondsText(value) {
  if (
    typeof value !== "string"
  ) {
    return null;
  }

  const match =
    value.match(
      /^\s*([0-9.]+)s\s*$/i
    );

  if (!match) {
    return null;
  }

  return asNumber(
    match[1]
  );
}

function canonicalizeUrl(value) {
  if (
    typeof value !== "string" ||
    !value
  ) {
    return value ?? null;
  }

  try {
    const url =
      new URL(value);

    return (
      `${url.origin}${url.pathname}`
    );
  } catch {
    return value;
  }
}

function containsEncodingArtifact(
  value
) {
  if (
    typeof value !== "string"
  ) {
    return false;
  }

  return (
    value.includes("â€¢") ||
    value.includes("â–") ||
    value.includes("â–ª") ||
    value.includes("â–«") ||
    value.includes("Ã") ||
    value.includes("�")
  );
}

function getSessionsFromPayload(
  payload
) {
  if (Array.isArray(payload)) {
    return payload;
  }

  const candidates = [
    payload?.recordings,
    payload?.sessions,
    payload?.data,
    payload?.items,
    payload?.results,
  ];

  for (
    const candidate
    of candidates
  ) {
    if (
      Array.isArray(
        candidate
      )
    ) {
      return candidate;
    }
  }

  return [];
}

function incrementMap(
  map,
  key,
  amount = 1
) {
  if (
    key === null ||
    key === undefined ||
    key === ""
  ) {
    return;
  }

  map.set(
    key,
    (map.get(key) ?? 0) +
      amount
  );
}

function mapToTopArray(
  map,
  limit = 15,
  keyName = "value"
) {
  return [
    ...map.entries(),
  ]
    .map(
      ([key, count]) => ({
        [keyName]: key,
        count,
      })
    )
    .sort(
      (a, b) =>
        b.count - a.count
    )
    .slice(
      0,
      limit
    );
}

function normalizeEvent(
  event
) {
  return {
    event_type:
      event?.eventtype ??
      null,

    text:
      event?.text ??
      null,

    link:
      event?.link ??
      null,

    hash:
      event?.hash ??
      null,

    /*
     * IMPORTANT:
     * Clarity's event.start value is preserved only
     * as a raw timestamp string. We do not interpret
     * it as elapsed session time.
     */
    clarity_raw_start:
      event?.start ??
      null,
  };
}

function analyzeSession(
  session
) {
  const pageUrls =
    new Map();

  const eventTypes =
    new Map();

  const clickTargets =
    new Map();

  const clickHashes =
    new Map();

  const signals = [];

  const pages =
    Array.isArray(
      session?.timeline
    )
      ? session.timeline
      : [];

  const normalizedPages =
    pages.map(
      (page) => {
        const canonicalUrl =
          canonicalizeUrl(
            page?.url
          );

        incrementMap(
          pageUrls,
          canonicalUrl
        );

        const cls =
          asNumber(
            page?.CLS
          );

        const lcpSeconds =
          parseSecondsText(
            page?.LCP
          );

        const pageLoadMs =
          asNumber(
            page?.pageLoadTime
          );

        if (
          cls !== null &&
          cls >=
            HEURISTICS.highCls
        ) {
          signals.push({
            type:
              "high_cls",

            severity:
              cls >= 0.5
                ? "high"
                : "medium",

            url:
              canonicalUrl,

            observed:
              cls,

            threshold:
              HEURISTICS.highCls,
          });
        }

        if (
          lcpSeconds !== null &&
          lcpSeconds >
            HEURISTICS.poorLcpSeconds
        ) {
          signals.push({
            type:
              "slow_lcp",

            severity:
              "medium",

            url:
              canonicalUrl,

            observed_seconds:
              lcpSeconds,

            threshold_seconds:
              HEURISTICS.poorLcpSeconds,
          });
        }

        if (
          pageLoadMs !== null &&
          pageLoadMs >
            HEURISTICS.slowPageLoadMs
        ) {
          signals.push({
            type:
              "slow_page_load",

            severity:
              "medium",

            url:
              canonicalUrl,

            observed_ms:
              pageLoadMs,

            threshold_ms:
              HEURISTICS.slowPageLoadMs,
          });
        }

        const events =
          Array.isArray(
            page?.timelineEvents
          )
            ? page.timelineEvents
            : [];

        const normalizedEvents =
          events.map(
            normalizeEvent
          );

        for (
          const event
          of normalizedEvents
        ) {
          incrementMap(
            eventTypes,
            event.event_type
          );

          if (
            event.event_type ===
            "Click"
          ) {
            const target =
              (
                event.text &&
                event.text.trim()
              )
                ? event.text.trim()
                : "(blank click target)";

            incrementMap(
              clickTargets,
              target
            );

            if (
              event.hash &&
              event.hash !== "0"
            ) {
              incrementMap(
                clickHashes,
                event.hash
              );
            }

            if (
              containsEncodingArtifact(
                event.text
              )
            ) {
              signals.push({
                type:
                  "encoding_artifact_in_click_text",

                severity:
                  "medium",

                url:
                  canonicalUrl,

                observed_text:
                  event.text,
              });
            }
          }
        }

        return {
          url:
            page?.url ??
            null,

          canonical_url:
            canonicalUrl,

          display_title:
            page?.displayTitle ??
            null,

          referrer_url:
            page?.referrerUrl ??
            null,

          page_load_ms:
            pageLoadMs,

          cls,
          lcp:
            page?.LCP ??
            null,

          score:
            asNumber(
              page?.score
            ),

          /*
           * Preserve Clarity page duration as raw milliseconds.
           * Do not infer user intent from duration alone.
           */
          duration_ms:
            asNumber(
              page?.duration
            ),

          clarity_raw_start:
            page?.start ??
            null,

          event_count:
            normalizedEvents.length,

          events:
            normalizedEvents,
        };
      }
    );

  const repeatedTargets =
    [
      ...clickTargets.entries(),
    ]
      .filter(
        ([, count]) =>
          count >=
          HEURISTICS.repeatedTargetClicks
      )
      .map(
        ([target, count]) => ({
          target,
          count,
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      );

  const repeatedHashes =
    [
      ...clickHashes.entries(),
    ]
      .filter(
        ([, count]) =>
          count >=
          HEURISTICS.repeatedTargetClicks
      )
      .map(
        ([hash, count]) => ({
          hash,
          count,
        })
      )
      .sort(
        (a, b) =>
          b.count - a.count
      );

  for (
    const repeated
    of repeatedTargets
  ) {
    signals.push({
      type:
        "repeated_click_target",

      severity:
        repeated.count >= 5
          ? "high"
          : "medium",

      target:
        repeated.target,

      count:
        repeated.count,

      threshold:
        HEURISTICS.repeatedTargetClicks,
    });
  }

  for (
    const repeated
    of repeatedHashes
  ) {
    signals.push({
      type:
        "repeated_click_hash",

      severity:
        repeated.count >= 5
          ? "high"
          : "medium",

      hash:
        repeated.hash,

      count:
        repeated.count,

      threshold:
        HEURISTICS.repeatedTargetClicks,
    });
  }

  return {
    recording_link:
      session?.link ??
      null,

    timestamp:
      session?.timestamp ??
      null,

    total_duration:
      session?.totalDuration ??
      null,

    active_duration:
      session?.activeDuration ??
      null,

    pages_count:
      asNumber(
        session?.pagesCount
      ),

    session_click_count:
      asNumber(
        session?.sessionClickCount
      ),

    navigation_path:
      normalizedPages
        .map(
          (page) =>
            page.canonical_url
        )
        .filter(Boolean),

    event_types:
      mapToTopArray(
        eventTypes,
        20,
        "event_type"
      ),

    top_click_targets:
      mapToTopArray(
        clickTargets,
        15,
        "target"
      ),

    repeated_click_targets:
      repeatedTargets,

    repeated_click_hashes:
      repeatedHashes,

    diagnostic_signals:
      signals,

    pages:
      normalizedPages,
  };
}

function analyzeCohort(
  result
) {
  const sessions =
    getSessionsFromPayload(
      result?.payload
    );

  const pageOccurrences =
    new Map();

  const clickTargets =
    new Map();

  const eventTypes =
    new Map();

  const signalTypes =
    new Map();

  const analyzedSessions =
    sessions.map(
      analyzeSession
    );

  for (
    const session
    of analyzedSessions
  ) {
    for (
      const url
      of session.navigation_path
    ) {
      incrementMap(
        pageOccurrences,
        url
      );
    }

    for (
      const item
      of session.top_click_targets
    ) {
      incrementMap(
        clickTargets,
        item.target,
        item.count
      );
    }

    for (
      const item
      of session.event_types
    ) {
      incrementMap(
        eventTypes,
        item.event_type,
        item.count
      );
    }

    for (
      const signal
      of session.diagnostic_signals
    ) {
      incrementMap(
        signalTypes,
        signal.type
      );
    }
  }

  return {
    label:
      result?.label ??
      null,

    aggregate_metric_count:
      asNumber(
        result?.metricCount
      ),

    requested_recordings:
      asNumber(
        result?.requestedCount
      ),

    detected_recordings:
      asNumber(
        result?.detectedRecordingCount
      ) ??
      sessions.length,

    actual_sessions_parsed:
      sessions.length,

    suspicious_empty:
      Boolean(
        result?.suspiciousEmpty
      ),

    filter:
      result?.filter ??
      null,

    top_pages_in_sample:
      mapToTopArray(
        pageOccurrences,
        15,
        "url"
      ),

    top_click_targets_in_sample:
      mapToTopArray(
        clickTargets,
        15,
        "target"
      ),

    event_types_in_sample:
      mapToTopArray(
        eventTypes,
        20,
        "event_type"
      ),

    diagnostic_signal_counts:
      mapToTopArray(
        signalTypes,
        20,
        "signal"
      ),

    sessions:
      analyzedSessions,
  };
}

function markdownEscape(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "|",
      "\\|"
    )
    .replace(
      /\r?\n/g,
      " "
    );
}

function buildMarkdown(
  context
) {
  const lines = [];

  lines.push(
    "# Clarity Session Evidence"
  );

  lines.push("");

  lines.push(
    `- Date: ${context.date}`
  );

  lines.push(
    `- Source: ${context.source.targeted_recordings_file}`
  );

  lines.push(
    `- Cohorts: ${context.cohorts.length}`
  );

  lines.push(
    `- AI credits used to build this evidence: 0`
  );

  lines.push("");

  lines.push(
    "> Timestamp rule: Clarity `start` values are preserved as raw timestamps and are not interpreted as elapsed session time."
  );

  lines.push("");

  lines.push(
    "> Diagnostic flags below are heuristics for investigation, not proof of a UX defect."
  );

  lines.push("");

  for (
    const cohort
    of context.cohorts
  ) {
    lines.push(
      `## ${cohort.label}`
    );

    lines.push("");

    lines.push(
      `- Aggregate metric count: ${cohort.aggregate_metric_count ?? "N/A"}`
    );

    lines.push(
      `- Recordings parsed: ${cohort.actual_sessions_parsed}`
    );

    lines.push(
      `- Requested recordings: ${cohort.requested_recordings ?? "N/A"}`
    );

    lines.push("");

    lines.push(
      "### Top pages in sampled recordings"
    );

    lines.push("");

    lines.push(
      "| URL | Occurrences |"
    );

    lines.push(
      "|---|---:|"
    );

    for (
      const item
      of cohort.top_pages_in_sample
    ) {
      lines.push(
        `| ${markdownEscape(item.url)} | ${item.count} |`
      );
    }

    lines.push("");

    lines.push(
      "### Top click targets in sampled recordings"
    );

    lines.push("");

    lines.push(
      "| Target | Clicks |"
    );

    lines.push(
      "|---|---:|"
    );

    for (
      const item
      of cohort.top_click_targets_in_sample
    ) {
      lines.push(
        `| ${markdownEscape(item.target)} | ${item.count} |`
      );
    }

    lines.push("");

    lines.push(
      "### Diagnostic signals"
    );

    lines.push("");

    if (
      cohort
        .diagnostic_signal_counts
        .length === 0
    ) {
      lines.push(
        "No deterministic diagnostic flags were raised."
      );
    } else {
      lines.push(
        "| Signal | Count |"
      );

      lines.push(
        "|---|---:|"
      );

      for (
        const item
        of cohort
          .diagnostic_signal_counts
      ) {
        lines.push(
          `| ${markdownEscape(item.signal)} | ${item.count} |`
        );
      }
    }

    lines.push("");

    lines.push(
      "### Session index"
    );

    lines.push("");

    lines.push(
      "| # | Timestamp | Pages | Clicks | Recording |"
    );

    lines.push(
      "|---:|---|---:|---:|---|"
    );

    cohort.sessions.forEach(
      (
        session,
        index
      ) => {
        const recording =
          session.recording_link
            ? `[Open recording](${session.recording_link})`
            : "";

        lines.push(
          `| ${index + 1} | ${markdownEscape(session.timestamp)} | ${session.pages_count ?? "N/A"} | ${session.session_click_count ?? "N/A"} | ${recording} |`
        );
      }
    );

    lines.push("");
  }

  return (
    lines.join("\n") +
    "\n"
  );
}

// ==================================================
// MAIN
// ==================================================

try {
  console.log("");
  console.log(
    "================================"
  );

  console.log(
    "BUILD CLARITY SESSION EVIDENCE"
  );

  console.log(
    "================================"
  );

  const latestFile =
    await findLatestTargeted();

  const sourcePath =
    path.join(
      RECORDINGS_DIR,
      latestFile
    );

  const targeted =
    JSON.parse(
      await readFile(
        sourcePath,
        "utf8"
      )
    );

  if (
    !Array.isArray(
      targeted?.results
    )
  ) {
    throw new Error(
      "Targeted recordings file has no results array."
    );
  }

  const date =
    targeted.date;

  if (!date) {
    throw new Error(
      "Targeted recordings file has no date."
    );
  }

  const cohorts =
    targeted.results.map(
      analyzeCohort
    );

  const context = {
    date,

    generated_at:
      new Date()
        .toISOString(),

    source: {
      platform:
        "Microsoft Clarity",

      targeted_recordings_file:
        latestFile,

      schema_version:
        "session-evidence-v1",
    },

    analysis_window:
      targeted.analysisWindow ??
      null,

    methodology: {
      timestamp_rule:
        "Clarity start values are preserved as raw timestamps. They are not interpreted as elapsed session time.",

      sample_rule:
        "Evidence is based only on targeted recording samples returned for non-zero friction cohorts.",

      inference_rule:
        "Diagnostic signals are deterministic heuristics for investigation and are not proof of causation.",

      heuristics:
        HEURISTICS,
    },

    cohorts,
  };

  await mkdir(
    CONTEXT_DIR,
    {
      recursive: true,
    }
  );

  await mkdir(
    REPORTS_DIR,
    {
      recursive: true,
    }
  );

  const jsonPath =
    path.join(
      CONTEXT_DIR,
      `${date}-session-evidence.json`
    );

  const mdPath =
    path.join(
      REPORTS_DIR,
      `session-evidence-${date}.md`
    );

  await writeFile(
    jsonPath,
    JSON.stringify(
      context,
      null,
      2
    ),
    "utf8"
  );

  await writeFile(
    mdPath,
    buildMarkdown(
      context
    ),
    "utf8"
  );

  const totalSessions =
    cohorts.reduce(
      (
        sum,
        cohort
      ) =>
        sum +
        cohort
          .actual_sessions_parsed,
      0
    );

  const totalSignals =
    cohorts.reduce(
      (
        sum,
        cohort
      ) =>
        sum +
        cohort
          .diagnostic_signal_counts
          .reduce(
            (
              innerSum,
              item
            ) =>
              innerSum +
              item.count,
            0
          ),
      0
    );

  console.log(
    `Source: ${sourcePath}`
  );

  console.log(
    `Cohorts: ${cohorts.length}`
  );

  console.log(
    `Sessions parsed: ${totalSessions}`
  );

  console.log(
    `Diagnostic flags: ${totalSignals}`
  );

  console.log("");
  console.log(
    `JSON: ${jsonPath}`
  );

  console.log(
    `Markdown: ${mdPath}`
  );

  console.log(
    "AI Credits: 0"
  );

  console.log(
    "Validation: PASS"
  );

  console.log(
    "================================"
  );

} catch (error) {
  console.error("");
  console.error(
    "SESSION EVIDENCE BUILD FAILED"
  );

  console.error(
    error?.message ??
      error
  );

  process.exitCode = 1;
}
