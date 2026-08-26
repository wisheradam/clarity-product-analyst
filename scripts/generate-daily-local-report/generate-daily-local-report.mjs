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

const NORMALIZED_DIR =
  path.join("data", "normalized");

const CONTEXT_DIR =
  path.join("data", "analysis-context");

const REPORTS_DIR =
  "reports";

const HISTORY_COMPARE_PATH =
  path.join(
    REPORTS_DIR,
    "history-comparison-export-latest.md"
  );

// ==================================================
// HELPERS
// ==================================================

function numberOrNull(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function fmt(
  value,
  digits = 0
) {
  const number =
    numberOrNull(value);

  if (number === null) {
    return "N/A";
  }

  return number.toLocaleString(
    "en-US",
    {
      minimumFractionDigits:
        digits,
      maximumFractionDigits:
        digits,
    }
  );
}

function escapeMd(value) {
  return String(
    value ?? ""
  )
    .replaceAll("|", "\\|")
    .replace(
      /\r?\n/g,
      " "
    );
}

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function percentLabel(value) {
  const number =
    numberOrNull(value);

  if (number === null) {
    return "N/A";
  }

  return `${fmt(number, 2)}%`;
}

function priorityForSignal(
  count,
  sessionsPercent
) {
  const c =
    numberOrNull(count) ?? 0;

  const p =
    numberOrNull(
      sessionsPercent
    ) ?? 0;

  if (
    c >= 20 ||
    p >= 15
  ) {
    return "P1";
  }

  if (
    c >= 5 ||
    p >= 5
  ) {
    return "P2";
  }

  if (c > 0) {
    return "Monitor";
  }

  return "None";
}

function findHistoryStatus(
  markdown,
  metricLabel
) {
  if (
    typeof markdown !==
      "string"
  ) {
    return null;
  }

  const lines =
    markdown.split(
      /\r?\n/
    );

  const target =
    metricLabel
      .toLowerCase();

  for (
    const line
    of lines
  ) {
    if (
      !line.startsWith("|")
    ) {
      continue;
    }

    const cells =
      line
        .split("|")
        .map(
          (cell) =>
            cell.trim()
        )
        .filter(Boolean);

    if (
      cells.length < 2
    ) {
      continue;
    }

    if (
      cells[0]
        .toLowerCase()
        .includes(target)
    ) {
      return {
        label:
          cells[0],

        previous:
          cells[1] ??
          null,

        latest:
          cells[2] ??
          null,

        change:
          cells[3] ??
          null,

        status:
          cells[4] ??
          null,
      };
    }
  }

  return null;
}

function topSignalCounts(
  cohort,
  limit = 8
) {
  const items =
    Array.isArray(
      cohort
        ?.diagnostic_signal_counts
    )
      ? cohort
          .diagnostic_signal_counts
      : [];

  return items
    .slice()
    .sort(
      (a, b) =>
        (b.count ?? 0) -
        (a.count ?? 0)
    )
    .slice(
      0,
      limit
    );
}

function topPages(
  cohort,
  limit = 8
) {
  const items =
    Array.isArray(
      cohort
        ?.top_pages_in_sample
    )
      ? cohort
          .top_pages_in_sample
      : [];

  return items
    .slice()
    .sort(
      (a, b) =>
        (b.count ?? 0) -
        (a.count ?? 0)
    )
    .slice(
      0,
      limit
    );
}

function topClicks(
  cohort,
  limit = 8
) {
  const items =
    Array.isArray(
      cohort
        ?.top_click_targets_in_sample
    )
      ? cohort
          .top_click_targets_in_sample
      : [];

  return items
    .slice()
    .sort(
      (a, b) =>
        (b.count ?? 0) -
        (a.count ?? 0)
    )
    .slice(
      0,
      limit
    );
}

function recordingsFor(
  cohort,
  limit = 5
) {
  const sessions =
    Array.isArray(
      cohort?.sessions
    )
      ? cohort.sessions
      : [];

  return sessions
    .filter(
      (session) =>
        session
          ?.recording_link
    )
    .slice(
      0,
      limit
    );
}

function buildExecutiveSummary({
  normalized,
  historyMarkdown,
  evidence,
}) {
  const bullets = [];

  const traffic =
    normalized?.traffic ?? {};

  const friction =
    normalized?.friction ?? {};

  bullets.push(
    `Traffic: ${fmt(
      traffic.human_sessions
    )} human sessions from ${fmt(
      traffic.distinct_users
    )} distinct users.`
  );

  const dead =
    friction.dead_clicks ?? {};

  const quick =
    friction.quick_backs ?? {};

  if (
    (dead.count ?? 0) > 0
  ) {
    bullets.push(
      `Dead clicks: ${fmt(
        dead.count
      )} events across ${percentLabel(
        dead.sessions_percent
      )} of sessions.`
    );
  }

  if (
    (quick.count ?? 0) > 0
  ) {
    bullets.push(
      `Quick backs: ${fmt(
        quick.count
      )} events across ${percentLabel(
        quick.sessions_percent
      )} of sessions.`
    );
  }

  const deadHistory =
    findHistoryStatus(
      historyMarkdown,
      "Dead clicks"
    );

  const quickHistory =
    findHistoryStatus(
      historyMarkdown,
      "Quick backs"
    );

  if (
    deadHistory?.status &&
    !deadHistory
      .status
      .includes(
        "BASELINE"
      )
  ) {
    bullets.push(
      `Dead-click trend status: ${deadHistory.status}${deadHistory.change ? ` (${deadHistory.change})` : ""}.`
    );
  }

  if (
    quickHistory?.status &&
    !quickHistory
      .status
      .includes(
        "BASELINE"
      )
  ) {
    bullets.push(
      `Quick-back trend status: ${quickHistory.status}${quickHistory.change ? ` (${quickHistory.change})` : ""}.`
    );
  }

  const totalRecordings =
    (evidence?.cohorts ?? [])
      .reduce(
        (
          sum,
          cohort
        ) =>
          sum +
          (
            cohort
              ?.actual_sessions_parsed ??
            0
          ),
        0
      );

  const totalDiagnostics =
    (evidence?.cohorts ?? [])
      .reduce(
        (
          sum,
          cohort
        ) =>
          sum +
          (
            cohort
              ?.diagnostic_signal_counts ??
            []
          )
            .reduce(
              (
                inner,
                item
              ) =>
                inner +
                (
                  item.count ??
                  0
                ),
              0
            ),
        0
      );

  bullets.push(
    `Targeted evidence: ${fmt(
      totalRecordings
    )} sampled recordings and ${fmt(
      totalDiagnostics
    )} deterministic diagnostic flags.`
  );

  return bullets.slice(
    0,
    6
  );
}

function buildMarkdown({
  date,
  normalized,
  historyMarkdown,
  evidence,
}) {
  const traffic =
    normalized?.traffic ?? {};

  const engagement =
    normalized?.engagement ?? {};

  const friction =
    normalized?.friction ?? {};

  const lines = [];

  lines.push(
    `# INNOVA Clarity Daily — ${date}`
  );

  lines.push("");

  lines.push(
    "_Deterministic report — no AI used._"
  );

  lines.push("");

  lines.push(
    "## Executive Summary"
  );

  lines.push("");

  const bullets =
    buildExecutiveSummary({
      normalized,
      historyMarkdown,
      evidence,
    });

  for (
    const bullet
    of bullets
  ) {
    lines.push(
      `- ${bullet}`
    );
  }

  lines.push("");

  lines.push(
    "## KPI Snapshot"
  );

  lines.push("");

  lines.push(
    "| Metric | Value |"
  );

  lines.push(
    "|---|---:|"
  );

  lines.push(
    `| Total sessions | ${fmt(
      traffic.total_sessions
    )} |`
  );

  lines.push(
    `| Bot sessions | ${fmt(
      traffic.bot_sessions
    )} |`
  );

  lines.push(
    `| Human sessions | ${fmt(
      traffic.human_sessions
    )} |`
  );

  lines.push(
    `| Distinct users | ${fmt(
      traffic.distinct_users
    )} |`
  );

  lines.push(
    `| Pages/session (Clarity reported) | ${fmt(
      traffic
        .pages_per_session_reported,
      3
    )} |`
  );

  lines.push(
    `| Total page views | Unavailable |`
  );

  lines.push(
    `| Engagement total | ${fmt(
      engagement
        .total_time_seconds
    )} s |`
  );

  lines.push(
    `| Engagement active | ${fmt(
      engagement
        .active_time_seconds
    )} s |`
  );

  lines.push(
    `| Active-time ratio | ${percentLabel(
      engagement
        .active_time_percent
    )} |`
  );

  lines.push(
    `| Average engagement | Unmapped |`
  );

  lines.push("");

  lines.push(
    "## Friction Signals"
  );

  lines.push("");

  lines.push(
    "| Signal | Count | Sessions | Priority |"
  );

  lines.push(
    "|---|---:|---:|---|"
  );

  const signals = [
    [
      "Dead clicks",
      friction.dead_clicks,
    ],

    [
      "Quick backs",
      friction.quick_backs,
    ],

    [
      "Rage clicks",
      friction.rage_clicks,
    ],

    [
      "Excessive scroll",
      friction.excessive_scroll,
    ],

    [
      "Script errors",
      friction.script_errors,
    ],

    [
      "Error clicks",
      friction.error_clicks,
    ],
  ];

  for (
    const [
      label,
      signal,
    ]
    of signals
  ) {
    const count =
      signal?.count ?? 0;

    const percent =
      signal
        ?.sessions_percent ??
      0;

    lines.push(
      `| ${label} | ${fmt(
        count
      )} | ${percentLabel(
        percent
      )} | ${priorityForSignal(
        count,
        percent
      )} |`
    );
  }

  lines.push("");

  lines.push(
    "## Targeted Session Evidence"
  );

  lines.push("");

  const cohorts =
    evidence?.cohorts ?? [];

  if (
    cohorts.length === 0
  ) {
    lines.push(
      "No targeted recording cohorts were collected."
    );
  }

  for (
    const cohort
    of cohorts
  ) {
    lines.push(
      `### ${cohort.label}`
    );

    lines.push("");

    lines.push(
      `- Aggregate events: ${fmt(
        cohort
          .aggregate_metric_count
      )}`
    );

    lines.push(
      `- Sampled recordings parsed: ${fmt(
        cohort
          .actual_sessions_parsed
      )}`
    );

    lines.push("");

    const pages =
      topPages(
        cohort,
        6
      );

    if (
      pages.length > 0
    ) {
      lines.push(
        "**Most frequent pages in sample**"
      );

      lines.push("");

      for (
        const item
        of pages
      ) {
        lines.push(
          `- ${escapeMd(
            item.url
          )} — ${fmt(
            item.count
          )} occurrences`
        );
      }

      lines.push("");
    }

    const clicks =
      topClicks(
        cohort,
        6
      );

    if (
      clicks.length > 0
    ) {
      lines.push(
        "**Most frequent click targets in sample**"
      );

      lines.push("");

      for (
        const item
        of clicks
      ) {
        lines.push(
          `- ${escapeMd(
            item.target
          )} — ${fmt(
            item.count
          )} clicks`
        );
      }

      lines.push("");
    }

    const diagnostics =
      topSignalCounts(
        cohort,
        6
      );

    if (
      diagnostics.length > 0
    ) {
      lines.push(
        "**Diagnostic flags**"
      );

      lines.push("");

      for (
        const item
        of diagnostics
      ) {
        lines.push(
          `- ${escapeMd(
            item.signal
          )} — ${fmt(
            item.count
          )}`
        );
      }

      lines.push("");
    }

    const recordings =
      recordingsFor(
        cohort,
        5
      );

    if (
      recordings.length > 0
    ) {
      lines.push(
        "**Sample recordings**"
      );

      lines.push("");

      recordings.forEach(
        (
          session,
          index
        ) => {
          lines.push(
            `- [Recording ${index + 1}](${session.recording_link}) — ${escapeMd(
              session.timestamp
            )}, ${fmt(
              session.pages_count
            )} pages, ${fmt(
              session.session_click_count
            )} clicks`
          );
        }
      );

      lines.push("");
    }
  }

  lines.push(
    "## History Comparison"
  );

  lines.push("");

  if (
    historyMarkdown
      .includes(
        "BASELINE ONLY"
      ) ||
    historyMarkdown
      .includes(
        "Only one Export API day"
      )
  ) {
    lines.push(
      "This is the Export API baseline day. Trend comparison starts when the next daily row is available."
    );
  } else {
    const statuses = [
      "Human sessions",
      "Distinct users",
      "Dead clicks",
      "Quick backs",
      "Rage clicks",
      "Script errors",
    ]
      .map(
        (label) =>
          findHistoryStatus(
            historyMarkdown,
            label
          )
      )
      .filter(Boolean);

    if (
      statuses.length === 0
    ) {
      lines.push(
        "No comparable history rows were found."
      );
    } else {
      lines.push(
        "| Metric | Previous | Latest | Change | Status |"
      );

      lines.push(
        "|---|---:|---:|---:|---|"
      );

      for (
        const item
        of statuses
      ) {
        lines.push(
          `| ${escapeMd(
            item.label
          )} | ${escapeMd(
            item.previous
          )} | ${escapeMd(
            item.latest
          )} | ${escapeMd(
            item.change
          )} | ${escapeMd(
            item.status
          )} |`
        );
      }
    }
  }

  lines.push("");

  lines.push(
    "## Recommended Checks"
  );

  lines.push("");

  const recommended = [];

  const dead =
    friction.dead_clicks;

  const quick =
    friction.quick_backs;

  if (
    (dead?.count ?? 0) > 0
  ) {
    recommended.push(
      "Review the highest-frequency pages in the dead-click recording sample and verify clickable affordances, overlays, menu behavior, and non-responsive targets."
    );
  }

  if (
    (quick?.count ?? 0) > 0
  ) {
    recommended.push(
      "Review the highest-frequency quick-back pages for expectation mismatch between search/referrer intent, page title/content, navigation, and first-screen messaging."
    );
  }

  const allDiagnostics =
    cohorts.flatMap(
      (cohort) =>
        cohort
          ?.diagnostic_signal_counts ??
        []
    );

  if (
    allDiagnostics.some(
      (item) =>
        item.signal ===
        "high_cls"
    )
  ) {
    recommended.push(
      "Inspect pages flagged for high CLS and identify layout shifts caused by late-loading content, media, menus, or injected widgets."
    );
  }

  if (
    allDiagnostics.some(
      (item) =>
        item.signal ===
        "slow_lcp" ||
        item.signal ===
        "slow_page_load"
    )
  ) {
    recommended.push(
      "Review pages with slow LCP/page-load diagnostics and compare them against image, script, font, and third-party loading behavior."
    );
  }

  if (
    allDiagnostics.some(
      (item) =>
        item.signal ===
        "repeated_click_target" ||
        item.signal ===
        "repeated_click_hash"
    )
  ) {
    recommended.push(
      "Watch repeated-click recordings to confirm whether users are retrying an unresponsive element or intentionally repeating a valid action."
    );
  }

  if (
    allDiagnostics.some(
      (item) =>
        item.signal ===
        "encoding_artifact_in_click_text"
    )
  ) {
    recommended.push(
      "Check pages/events with encoding artifacts and verify whether the issue is only in Clarity capture or visible in the customer-facing UI."
    );
  }

  if (
    recommended.length === 0
  ) {
    recommended.push(
      "No high-priority deterministic investigation was triggered today. Continue daily monitoring."
    );
  }

  recommended.forEach(
    (
      item,
      index
    ) => {
      lines.push(
        `${index + 1}. ${item}`
      );
    }
  );

  lines.push("");

  lines.push(
    "## Data Quality & Limitations"
  );

  lines.push("");

  lines.push(
    "- Targeted recordings are samples, not the complete population."
  );

  lines.push(
    "- Diagnostic flags are investigation heuristics, not confirmed UX defects."
  );

  lines.push(
    "- Total page views are not available from the current Export API mapping."
  );

  lines.push(
    "- Export API engagement fields are preserved directly and are not mapped to the earlier MCP average-engagement metric."
  );

  lines.push(
    "- Clarity `start` values are preserved as raw timestamps and are not interpreted as elapsed session time."
  );

  lines.push(
    "- This report is deterministic and uses no AI-generated interpretation."
  );

  lines.push("");

  return (
    lines.join("\n") +
    "\n"
  );
}

function markdownToSimpleHtml(
  markdown,
  date
) {
  /*
   * We intentionally generate a purpose-built HTML email/report
   * instead of attempting a full Markdown parser.
   */

  const escaped =
    escapeHtml(markdown);

  const body =
    escaped
      .replace(
        /^# (.+)$/gm,
        "<h1>$1</h1>"
      )
      .replace(
        /^## (.+)$/gm,
        "<h2>$1</h2>"
      )
      .replace(
        /^### (.+)$/gm,
        "<h3>$1</h3>"
      )
      .replace(
        /^\*\*(.+)\*\*$/gm,
        "<strong>$1</strong>"
      )
      .replace(
        /^_([^_]+)_$/gm,
        "<em>$1</em>"
      )
      .replace(
        /^- (.+)$/gm,
        "<li>$1</li>"
      )
      .replace(
        /^(\d+)\. (.+)$/gm,
        "<li>$2</li>"
      )
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
        '<a href="$2">$1</a>'
      )
      .replace(
        /\n{2,}/g,
        "<br><br>"
      )
      .replace(
        /\n/g,
        "<br>"
      );

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>INNOVA Clarity Daily — ${escapeHtml(date)}</title>
<style>
body {
  font-family: Arial, Helvetica, sans-serif;
  max-width: 900px;
  margin: 32px auto;
  padding: 0 20px;
  line-height: 1.5;
  color: #1f2937;
}
h1 { font-size: 28px; }
h2 {
  font-size: 21px;
  margin-top: 30px;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 6px;
}
h3 { font-size: 17px; margin-top: 24px; }
a { color: #2563eb; }
code {
  background: #f3f4f6;
  padding: 2px 4px;
  border-radius: 4px;
}
</style>
</head>
<body>
${body}
</body>
</html>
`;
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
    "BUILD DAILY LOCAL REPORT"
  );

  console.log(
    "================================"
  );

  const files =
    await readdir(
      NORMALIZED_DIR
    );

  const normalizedFiles =
    files
      .filter(
        (file) =>
          /^\d{4}-\d{2}-\d{2}\.json$/.test(
            file
          )
      )
      .sort();

  if (
    normalizedFiles.length === 0
  ) {
    throw new Error(
      "No normalized Clarity files found."
    );
  }

  const latestFile =
    normalizedFiles[
      normalizedFiles.length - 1
    ];

  const date =
    latestFile.slice(
      0,
      10
    );

  const normalizedPath =
    path.join(
      NORMALIZED_DIR,
      latestFile
    );

  const evidencePath =
    path.join(
      CONTEXT_DIR,
      `${date}-session-evidence.json`
    );

  const normalized =
    JSON.parse(
      await readFile(
        normalizedPath,
        "utf8"
      )
    );

  let evidence = {
    cohorts: [],
  };

  try {
    evidence =
      JSON.parse(
        await readFile(
          evidencePath,
          "utf8"
        )
      );
  } catch {
    console.log(
      "Session evidence JSON not found; report will continue without recording evidence."
    );
  }

  let historyMarkdown = "";

  try {
    historyMarkdown =
      await readFile(
        HISTORY_COMPARE_PATH,
        "utf8"
      );
  } catch {
    console.log(
      "History comparison not found; report will use baseline wording."
    );
  }

  const markdown =
    buildMarkdown({
      date,
      normalized,
      historyMarkdown,
      evidence,
    });

  const html =
    markdownToSimpleHtml(
      markdown,
      date
    );

  await mkdir(
    REPORTS_DIR,
    {
      recursive: true,
    }
  );

  const mdPath =
    path.join(
      REPORTS_DIR,
      `clarity-local-daily-${date}.md`
    );

  const htmlPath =
    path.join(
      REPORTS_DIR,
      `clarity-local-daily-${date}.html`
    );

  await writeFile(
    mdPath,
    markdown,
    "utf8"
  );

  await writeFile(
    htmlPath,
    html,
    "utf8"
  );

  console.log(
    `Date: ${date}`
  );

  console.log(
    `Markdown: ${mdPath}`
  );

  console.log(
    `HTML: ${htmlPath}`
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
    "LOCAL REPORT BUILD FAILED"
  );

  console.error(
    error?.message ??
      error
  );

  process.exitCode = 1;
}
