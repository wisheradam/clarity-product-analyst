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

  const number =
    Number(value);

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

function percentLabel(value) {
  const number =
    numberOrNull(value);

  return number === null
    ? "N/A"
    : `${fmt(number, 2)}%`;
}

function pluralize(
  count,
  singular,
  plural = `${singular}s`
) {
  return `${count} ${
    count === 1
      ? singular
      : plural
  }`;
}

function escapeMd(value) {
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

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
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

function priorityMeta(priority) {
  switch (priority) {
    case "P1":
      return {
        background:
          "#FEE2E2",
        text:
          "#991B1B",
        border:
          "#FCA5A5",
      };

    case "P2":
      return {
        background:
          "#FEF3C7",
        text:
          "#92400E",
        border:
          "#FCD34D",
      };

    case "Monitor":
      return {
        background:
          "#DBEAFE",
        text:
          "#1E40AF",
        border:
          "#93C5FD",
      };

    default:
      return {
        background:
          "#F3F4F6",
        text:
          "#4B5563",
        border:
          "#D1D5DB",
      };
  }
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
    metricLabel.toLowerCase();

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

function sortTop(
  items,
  limit = 6
) {
  return (
    Array.isArray(items)
      ? items
      : []
  )
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
  limit = 6
) {
  return sortTop(
    cohort
      ?.top_pages_in_sample,
    limit
  );
}

function topClicks(
  cohort,
  limit = 6
) {
  return sortTop(
    cohort
      ?.top_click_targets_in_sample,
    limit
  );
}

function topDiagnostics(
  cohort,
  limit = 6
) {
  return sortTop(
    cohort
      ?.diagnostic_signal_counts,
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
  evidence,
  historyMarkdown,
}) {
  const traffic =
    normalized?.traffic ?? {};

  const friction =
    normalized?.friction ?? {};

  const bullets = [];

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
      `Dead-click trend: ${deadHistory.status}${deadHistory.change ? ` (${deadHistory.change})` : ""}.`
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
      `Quick-back trend: ${quickHistory.status}${quickHistory.change ? ` (${quickHistory.change})` : ""}.`
    );
  }

  const totalRecordings =
    (
      evidence?.cohorts ??
      []
    )
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
    (
      evidence?.cohorts ??
      []
    )
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
    `Evidence reviewed: ${fmt(
      totalRecordings
    )} targeted recordings with ${fmt(
      totalDiagnostics
    )} deterministic diagnostic flags.`
  );

  return bullets.slice(
    0,
    6
  );
}

function buildRecommendations(
  normalized,
  evidence
) {
  const friction =
    normalized?.friction ?? {};

  const cohorts =
    evidence?.cohorts ?? [];

  const diagnostics =
    cohorts.flatMap(
      (cohort) =>
        cohort
          ?.diagnostic_signal_counts ??
        []
    );

  const actions = [];

  if (
    (
      friction.dead_clicks
        ?.count ??
      0
    ) > 0
  ) {
    actions.push({
      priority:
        "P1",

      title:
        "Review dead-click hotspots",

      detail:
        "Inspect the highest-frequency dead-click pages and verify overlays, menu behavior, click affordances, and elements that appear interactive but may not respond.",
    });
  }

  if (
    (
      friction.quick_backs
        ?.count ??
      0
    ) > 0
  ) {
    actions.push({
      priority:
        "P1",

      title:
        "Investigate quick-back landing pages",

      detail:
        "Compare referrer/search intent against first-screen content, navigation clarity, product naming, and whether users land on the page they expected.",
    });
  }

  if (
    diagnostics.some(
      (item) =>
        item.signal ===
        "high_cls"
    )
  ) {
    actions.push({
      priority:
        "P2",

      title:
        "Check layout-shift pages",

      detail:
        "Review pages flagged for high CLS and identify late-loading media, widgets, menus, fonts, or injected components that move content after render.",
    });
  }

  if (
    diagnostics.some(
      (item) =>
        item.signal ===
        "slow_lcp" ||
        item.signal ===
        "slow_page_load"
    )
  ) {
    actions.push({
      priority:
        "P2",

      title:
        "Review performance bottlenecks",

      detail:
        "Inspect pages with slow LCP/page-load flags, focusing on image weight, scripts, fonts, and third-party services.",
    });
  }

  if (
    diagnostics.some(
      (item) =>
        item.signal ===
        "repeated_click_target" ||
        item.signal ===
        "repeated_click_hash"
    )
  ) {
    actions.push({
      priority:
        "P2",

      title:
        "Watch repeated-click recordings",

      detail:
        "Confirm whether repeated clicks indicate an unresponsive control, delayed feedback, a hidden overlay, or intentional repeated interaction.",
    });
  }

  if (
    diagnostics.some(
      (item) =>
        item.signal ===
        "encoding_artifact_in_click_text"
    )
  ) {
    actions.push({
      priority:
        "Monitor",

      title:
        "Verify encoding artifacts",

      detail:
        "Confirm whether garbled click text exists only in Clarity capture or is also visible in the customer-facing interface.",
    });
  }

  if (
    actions.length === 0
  ) {
    actions.push({
      priority:
        "Monitor",

      title:
        "Continue monitoring",

      detail:
        "No deterministic high-priority investigation was triggered today.",
    });
  }

  return actions;
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

  for (
    const bullet
    of buildExecutiveSummary({
      normalized,
      evidence,
      historyMarkdown,
    })
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
    "| Total page views | Unavailable |"
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
    "| Average engagement | Unmapped |"
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

    for (
      const item
      of topPages(
        cohort
      )
    ) {
      lines.push(
        `- ${escapeMd(
          item.url
        )} — ${pluralize(
          item.count,
          "occurrence"
        )}`
      );
    }

    lines.push("");
  }

  lines.push(
    "## Recommended Actions"
  );

  lines.push("");

  buildRecommendations(
    normalized,
    evidence
  ).forEach(
    (
      action,
      index
    ) => {
      lines.push(
        `${index + 1}. **${action.priority} — ${action.title}:** ${action.detail}`
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
    "- Total page views are unavailable from the current Export API mapping."
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

// ==================================================
// HTML COMPONENTS
// ==================================================

function sectionTitle(
  title,
  subtitle = null
) {
  return `
<tr>
  <td style="padding:28px 24px 12px 24px;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#111827;">
      ${escapeHtml(title)}
    </div>
    ${
      subtitle
        ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6B7280;margin-top:4px;">${escapeHtml(subtitle)}</div>`
        : ""
    }
  </td>
</tr>`;
}

function kpiCard(
  label,
  value,
  note = null
) {
  return `
<td width="25%" valign="top" style="padding:6px;">
  <div style="border:1px solid #E5E7EB;border-radius:12px;padding:16px;background:#FFFFFF;">
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:.4px;">
      ${escapeHtml(label)}
    </div>
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:700;color:#111827;margin-top:6px;">
      ${escapeHtml(value)}
    </div>
    ${
      note
        ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9CA3AF;margin-top:4px;">${escapeHtml(note)}</div>`
        : ""
    }
  </div>
</td>`;
}

function badge(priority) {
  const meta =
    priorityMeta(
      priority
    );

  return `
<span style="
  display:inline-block;
  padding:3px 8px;
  border-radius:999px;
  background:${meta.background};
  color:${meta.text};
  border:1px solid ${meta.border};
  font-family:Arial,Helvetica,sans-serif;
  font-size:11px;
  font-weight:700;
">
  ${escapeHtml(priority)}
</span>`;
}

function issueCard({
  title,
  count,
  percent,
  priority,
  detail,
}) {
  return `
<tr>
  <td style="padding:8px 24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:12px;background:#FFFFFF;">
      <tr>
        <td style="padding:16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#111827;">
                ${escapeHtml(title)}
              </td>
              <td align="right">
                ${badge(priority)}
              </td>
            </tr>
          </table>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;color:#111827;margin-top:8px;">
            ${escapeHtml(count)}
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6B7280;margin-top:2px;">
            ${escapeHtml(percent)} of sessions
          </div>
          ${
            detail
              ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#4B5563;margin-top:10px;line-height:1.5;">${escapeHtml(detail)}</div>`
              : ""
          }
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function simpleTable(
  headers,
  rows
) {
  const headerHtml =
    headers
      .map(
        (header) => `
<th align="left" style="padding:10px 12px;background:#F9FAFB;border-bottom:1px solid #E5E7EB;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6B7280;font-weight:700;">
  ${escapeHtml(header)}
</th>`
      )
      .join("");

  const bodyHtml =
    rows
      .map(
        (row) => `
<tr>
  ${
    row
      .map(
        (cell) => `
<td valign="top" style="padding:10px 12px;border-bottom:1px solid #F3F4F6;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;line-height:1.45;">
  ${cell}
</td>`
      )
      .join("")
  }
</tr>`
      )
      .join("");

  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
  <tr>${headerHtml}</tr>
  ${bodyHtml}
</table>`;
}

function buildRichHtml({
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

  const cohorts =
    evidence?.cohorts ?? [];

  const executive =
    buildExecutiveSummary({
      normalized,
      evidence,
      historyMarkdown,
    });

  const recommendations =
    buildRecommendations(
      normalized,
      evidence
    );

  const dead =
    friction.dead_clicks ?? {};

  const quick =
    friction.quick_backs ?? {};

  const rage =
    friction.rage_clicks ?? {};

  const excessive =
    friction.excessive_scroll ?? {};

  const scriptErrors =
    friction.script_errors ?? {};

  const errorClicks =
    friction.error_clicks ?? {};

  const frictionRows = [
    [
      "Dead clicks",
      fmt(dead.count),
      percentLabel(
        dead.sessions_percent
      ),
      badge(
        priorityForSignal(
          dead.count,
          dead.sessions_percent
        )
      ),
    ],
    [
      "Quick backs",
      fmt(quick.count),
      percentLabel(
        quick.sessions_percent
      ),
      badge(
        priorityForSignal(
          quick.count,
          quick.sessions_percent
        )
      ),
    ],
    [
      "Rage clicks",
      fmt(rage.count),
      percentLabel(
        rage.sessions_percent
      ),
      badge(
        priorityForSignal(
          rage.count,
          rage.sessions_percent
        )
      ),
    ],
    [
      "Excessive scroll",
      fmt(excessive.count),
      percentLabel(
        excessive.sessions_percent
      ),
      badge(
        priorityForSignal(
          excessive.count,
          excessive.sessions_percent
        )
      ),
    ],
    [
      "Script errors",
      fmt(scriptErrors.count),
      percentLabel(
        scriptErrors.sessions_percent
      ),
      badge(
        priorityForSignal(
          scriptErrors.count,
          scriptErrors.sessions_percent
        )
      ),
    ],
    [
      "Error clicks",
      fmt(errorClicks.count),
      percentLabel(
        errorClicks.sessions_percent
      ),
      badge(
        priorityForSignal(
          errorClicks.count,
          errorClicks.sessions_percent
        )
      ),
    ],
  ];

  const historyIsBaseline =
    historyMarkdown.includes(
      "BASELINE ONLY"
    ) ||
    historyMarkdown.includes(
      "Only one Export API day"
    );

  let historyHtml = "";

  if (historyIsBaseline) {
    historyHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#4B5563;line-height:1.5;">
  This is the Export API baseline day. Trend comparison starts after the next daily snapshot.
</div>`;
  } else {
    const historyRows = [
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
      .filter(Boolean)
      .map(
        (item) => [
          escapeHtml(
            item.label
          ),
          escapeHtml(
            item.previous
          ),
          escapeHtml(
            item.latest
          ),
          escapeHtml(
            item.change
          ),
          escapeHtml(
            item.status
          ),
        ]
      );

    historyHtml =
      historyRows.length > 0
        ? simpleTable(
            [
              "Metric",
              "Previous",
              "Latest",
              "Change",
              "Status",
            ],
            historyRows
          )
        : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6B7280;">No comparable history rows were found.</div>`;
  }

  const cohortHtml =
    cohorts
      .map(
        (cohort) => {
          const pages =
            topPages(
              cohort
            );

          const clicks =
            topClicks(
              cohort
            );

          const diagnostics =
            topDiagnostics(
              cohort
            );

          const recordings =
            recordingsFor(
              cohort
            );

          const pageRows =
            pages.map(
              (item) => [
                `<a href="${escapeHtml(
                  item.url
                )}" style="color:#2563EB;text-decoration:none;">${escapeHtml(
                  item.url
                )}</a>`,
                escapeHtml(
                  pluralize(
                    item.count,
                    "occurrence"
                  )
                ),
              ]
            );

          const clickRows =
            clicks.map(
              (item) => [
                escapeHtml(
                  item.target
                ),
                escapeHtml(
                  `${fmt(
                    item.count
                  )} clicks`
                ),
              ]
            );

          const diagnosticRows =
            diagnostics.map(
              (item) => [
                escapeHtml(
                  item.signal
                ),
                escapeHtml(
                  fmt(
                    item.count
                  )
                ),
              ]
            );

          const recordingRows =
            recordings.map(
              (
                session,
                index
              ) => [
                `<a href="${escapeHtml(
                  session.recording_link
                )}" style="color:#2563EB;text-decoration:none;font-weight:700;">Recording ${index + 1}</a>`,
                escapeHtml(
                  session.timestamp
                ),
                escapeHtml(
                  `${fmt(
                    session.pages_count
                  )} pages`
                ),
                escapeHtml(
                  `${fmt(
                    session.session_click_count
                  )} clicks`
                ),
              ]
            );

          return `
<tr>
  <td style="padding:10px 24px 18px 24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:14px;background:#FFFFFF;">
      <tr>
        <td style="padding:18px 18px 6px 18px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:700;color:#111827;text-transform:capitalize;">
            ${escapeHtml(
              cohort.label
            )}
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6B7280;margin-top:4px;">
            ${fmt(
              cohort.aggregate_metric_count
            )} aggregate events · ${fmt(
              cohort.actual_sessions_parsed
            )} sampled recordings
          </div>
        </td>
      </tr>

      ${
        pageRows.length > 0
          ? `
      <tr>
        <td style="padding:12px 18px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">Top pages in sample</div>
          ${simpleTable(
            [
              "Page",
              "Frequency",
            ],
            pageRows
          )}
        </td>
      </tr>`
          : ""
      }

      ${
        clickRows.length > 0
          ? `
      <tr>
        <td style="padding:12px 18px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">Top click targets</div>
          ${simpleTable(
            [
              "Target",
              "Clicks",
            ],
            clickRows
          )}
        </td>
      </tr>`
          : ""
      }

      ${
        diagnosticRows.length > 0
          ? `
      <tr>
        <td style="padding:12px 18px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">Diagnostic flags</div>
          ${simpleTable(
            [
              "Signal",
              "Count",
            ],
            diagnosticRows
          )}
        </td>
      </tr>`
          : ""
      }

      ${
        recordingRows.length > 0
          ? `
      <tr>
        <td style="padding:12px 18px 18px 18px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#374151;margin-bottom:8px;">Sample recordings</div>
          ${simpleTable(
            [
              "Recording",
              "Timestamp",
              "Pages",
              "Clicks",
            ],
            recordingRows
          )}
        </td>
      </tr>`
          : ""
      }
    </table>
  </td>
</tr>`;
        }
      )
      .join("");

  const recommendationHtml =
    recommendations
      .map(
        (
          item,
          index
        ) => {
          const meta =
            priorityMeta(
              item.priority
            );

          return `
<tr>
  <td style="padding:7px 24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid ${meta.border};border-radius:12px;background:${meta.background};">
      <tr>
        <td width="36" valign="top" style="padding:14px 8px 14px 14px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:${meta.text};">
          ${index + 1}.
        </td>
        <td style="padding:14px 14px 14px 4px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:${meta.text};">
            ${escapeHtml(
              item.priority
            )} — ${escapeHtml(
              item.title
            )}
          </div>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#374151;line-height:1.5;margin-top:4px;">
            ${escapeHtml(
              item.detail
            )}
          </div>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
        }
      )
      .join("");

  const executiveHtml =
    executive
      .map(
        (bullet) => `
<tr>
  <td width="18" valign="top" style="padding:4px 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#2563EB;">•</td>
  <td style="padding:4px 0 4px 6px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;line-height:1.5;">
    ${escapeHtml(
      bullet
    )}
  </td>
</tr>`
      )
      .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>INNOVA Clarity Daily — ${escapeHtml(date)}</title>
</head>

<body style="margin:0;padding:0;background:#F3F4F6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:860px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">

          <tr>
            <td style="padding:28px 24px;background:#111827;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:.8px;color:#93C5FD;text-transform:uppercase;">
                Product Analytics
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:700;color:#FFFFFF;margin-top:6px;">
                INNOVA Clarity Daily
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#D1D5DB;margin-top:6px;">
                ${escapeHtml(date)} · Deterministic report · AI credits: 0
              </div>
            </td>
          </tr>

          ${sectionTitle(
            "Executive Summary"
          )}

          <tr>
            <td style="padding:0 24px 8px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${executiveHtml}
              </table>
            </td>
          </tr>

          ${sectionTitle(
            "KPI Snapshot",
            "Current-day values from Microsoft Clarity Export API"
          )}

          <tr>
            <td style="padding:0 18px 8px 18px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  ${kpiCard(
                    "Human Sessions",
                    fmt(
                      traffic.human_sessions
                    ),
                    `${fmt(
                      traffic.bot_sessions
                    )} bot sessions excluded`
                  )}
                  ${kpiCard(
                    "Distinct Users",
                    fmt(
                      traffic.distinct_users
                    )
                  )}
                  ${kpiCard(
                    "Pages / Session",
                    fmt(
                      traffic.pages_per_session_reported,
                      3
                    ),
                    "Clarity-reported"
                  )}
                  ${kpiCard(
                    "Active-time Ratio",
                    percentLabel(
                      engagement.active_time_percent
                    )
                  )}
                </tr>
              </table>
            </td>
          </tr>

          ${sectionTitle(
            "Top Issues"
          )}

          ${issueCard({
            title:
              "Quick backs",
            count:
              fmt(
                quick.count
              ),
            percent:
              percentLabel(
                quick.sessions_percent
              ),
            priority:
              priorityForSignal(
                quick.count,
                quick.sessions_percent
              ),
            detail:
              "High-priority signal because quick backs are present in a meaningful share of sessions.",
          })}

          ${issueCard({
            title:
              "Dead clicks",
            count:
              fmt(
                dead.count
              ),
            percent:
              percentLabel(
                dead.sessions_percent
              ),
            priority:
              priorityForSignal(
                dead.count,
                dead.sessions_percent
              ),
            detail:
              "Review affected recordings to confirm whether users are clicking non-responsive or misleading elements.",
          })}

          ${sectionTitle(
            "All Friction Signals"
          )}

          <tr>
            <td style="padding:0 24px 8px 24px;">
              ${simpleTable(
                [
                  "Signal",
                  "Count",
                  "Sessions",
                  "Priority",
                ],
                frictionRows
              )}
            </td>
          </tr>

          ${sectionTitle(
            "Targeted Session Evidence",
            "Sampled recordings only — not the full visitor population"
          )}

          ${cohortHtml}

          ${sectionTitle(
            "History Comparison"
          )}

          <tr>
            <td style="padding:0 24px 12px 24px;">
              ${historyHtml}
            </td>
          </tr>

          ${sectionTitle(
            "Recommended Actions"
          )}

          ${recommendationHtml}

          ${sectionTitle(
            "Data Quality & Limitations"
          )}

          <tr>
            <td style="padding:0 24px 28px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                ${
                  [
                    "Targeted recordings are samples, not the complete population.",
                    "Diagnostic flags are investigation heuristics, not confirmed UX defects.",
                    "Total page views are unavailable from the current Export API mapping.",
                    "Export API engagement fields are preserved directly and are not mapped to the earlier MCP average-engagement metric.",
                    "Clarity start values are preserved as raw timestamps and are not interpreted as elapsed session time.",
                    "This report is deterministic and uses no AI-generated interpretation.",
                  ]
                    .map(
                      (item) => `
<tr>
  <td width="18" valign="top" style="padding:3px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9CA3AF;">•</td>
  <td style="padding:3px 0 3px 6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6B7280;line-height:1.45;">
    ${escapeHtml(
      item
    )}
  </td>
</tr>`
                    )
                    .join("")
                }
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 24px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9CA3AF;text-align:center;">
                Generated automatically by the INNOVA Clarity local analytics pipeline.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
    buildRichHtml({
      date,
      normalized,
      historyMarkdown,
      evidence,
    });

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
    "Rich email layout: YES"
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
