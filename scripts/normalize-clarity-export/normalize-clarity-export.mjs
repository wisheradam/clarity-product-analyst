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

const RAW_DIR =
  path.join("data", "raw");

const NORMALIZED_DIR =
  path.join("data", "normalized");

const HISTORY_DIR =
  path.join("data", "history");

const HISTORY_PATH =
  path.join(
    HISTORY_DIR,
    "daily-kpis-export.csv"
  );

// ==================================================
// HELPERS
// ==================================================

function toNumber(value) {
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

function round(
  value,
  digits = 2
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const multiplier =
    10 ** digits;

  return (
    Math.round(
      value * multiplier
    ) / multiplier
  );
}

function csvCell(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const string =
    String(value);

  if (
    string.includes(",") ||
    string.includes('"') ||
    string.includes("\n")
  ) {
    return (
      '"' +
      string.replaceAll(
        '"',
        '""'
      ) +
      '"'
    );
  }

  return string;
}

// ==================================================
// FIND LATEST EXPORT SNAPSHOT
// ==================================================

async function findLatestExport() {
  const files =
    await readdir(RAW_DIR);

  const exportFiles =
    files
      .filter(
        (file) =>
          /^\d{4}-\d{2}-\d{2}-export\.json$/.test(
            file
          )
      )
      .sort();

  if (
    exportFiles.length === 0
  ) {
    throw new Error(
      "No Clarity Export snapshot found."
    );
  }

  return exportFiles[
    exportFiles.length - 1
  ];
}

// ==================================================
// METRIC ACCESS
// ==================================================

function getMetric(
  snapshot,
  metricName
) {
  const metric =
    snapshot.export?.project?.find(
      (item) =>
        item.metricName ===
        metricName
    );

  if (!metric) {
    throw new Error(
      `Required metric "${metricName}" is missing.`
    );
  }

  if (
    !Array.isArray(
      metric.information
    ) ||
    metric.information.length === 0
  ) {
    throw new Error(
      `Metric "${metricName}" has no information.`
    );
  }

  return metric;
}

function getProjectRow(
  snapshot,
  metricName
) {
  return getMetric(
    snapshot,
    metricName
  ).information[0];
}

function requireNumber(
  value,
  label
) {
  const number =
    toNumber(value);

  if (number === null) {
    throw new Error(
      `Required numeric field "${label}" is missing or invalid.`
    );
  }

  return number;
}

// ==================================================
// FRICTION METRIC
// ==================================================

function normalizeFriction(
  snapshot,
  metricName
) {
  const row =
    getProjectRow(
      snapshot,
      metricName
    );

  return {
    count:
      requireNumber(
        row.subTotal,
        `${metricName}.subTotal`
      ),

    sessions_count:
      requireNumber(
        row.sessionsCount,
        `${metricName}.sessionsCount`
      ),

    sessions_percent:
      requireNumber(
        row.sessionsWithMetricPercentage,
        `${metricName}.sessionsWithMetricPercentage`
      ),

    page_views_with_metric:
      requireNumber(
        row.pagesViews,
        `${metricName}.pagesViews`
      ),
  };
}

// ==================================================
// TOP PAGES
// ==================================================

function normalizeTopPages(
  snapshot
) {
  const metric =
    getMetric(
      snapshot,
      "PopularPages"
    );

  return metric.information
    .map(
      (row) => ({
        url:
          row.url ?? null,

        visits_count:
          toNumber(
            row.visitsCount
          ),
      })
    )
    .filter(
      (row) =>
        row.url &&
        row.visits_count !==
          null
    )
    .sort(
      (a, b) =>
        b.visits_count -
        a.visits_count
    )
    .slice(0, 10);
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
    "CLARITY EXPORT NORMALIZATION"
  );

  console.log(
    "================================"
  );

  const latestFile =
    await findLatestExport();

  const sourcePath =
    path.join(
      RAW_DIR,
      latestFile
    );

  console.log(
    `Source: ${sourcePath}`
  );

  const raw =
    await readFile(
      sourcePath,
      "utf8"
    );

  const snapshot =
    JSON.parse(raw);

  if (
    snapshot.collectionStatus
      ?.complete !== true
  ) {
    throw new Error(
      "Export snapshot is incomplete. Normalization stopped."
    );
  }

  const dateMatch =
    latestFile.match(
      /^(\d{4}-\d{2}-\d{2})-export\.json$/
    );

  if (!dateMatch) {
    throw new Error(
      "Could not determine snapshot date."
    );
  }

  const date =
    dateMatch[1];

  const traffic =
    getProjectRow(
      snapshot,
      "Traffic"
    );

  const totalSessions =
    requireNumber(
      traffic.totalSessionCount,
      "Traffic.totalSessionCount"
    );

  const botSessions =
    requireNumber(
      traffic.totalBotSessionCount,
      "Traffic.totalBotSessionCount"
    );

  const distinctUsers =
    requireNumber(
      traffic.distinctUserCount ??
        traffic.distantUserCount,
      "Traffic.distinctUserCount"
    );

  const pagesPerSessionReported =
    requireNumber(
      traffic.pagesPerSessionPercentage ??
        traffic.PagesPerSessionPercentage,
      "Traffic.pagesPerSessionPercentage"
    );

  const humanSessions =
    Math.max(
      0,
      totalSessions -
        botSessions
    );

  const engagement =
    getProjectRow(
      snapshot,
      "EngagementTime"
    );

  const engagementTotalSeconds =
    requireNumber(
      engagement.totalTime,
      "EngagementTime.totalTime"
    );

  const engagementActiveSeconds =
    requireNumber(
      engagement.activeTime,
      "EngagementTime.activeTime"
    );

  const engagementActivePercent =
    engagementTotalSeconds > 0
      ? round(
          (
            engagementActiveSeconds /
            engagementTotalSeconds
          ) * 100,
          2
        )
      : null;

  const deadClicks =
    normalizeFriction(
      snapshot,
      "DeadClickCount"
    );

  const quickBacks =
    normalizeFriction(
      snapshot,
      "QuickbackClick"
    );

  const rageClicks =
    normalizeFriction(
      snapshot,
      "RageClickCount"
    );

  const excessiveScroll =
    normalizeFriction(
      snapshot,
      "ExcessiveScroll"
    );

  const scriptErrors =
    normalizeFriction(
      snapshot,
      "ScriptErrorCount"
    );

  const errorClicks =
    normalizeFriction(
      snapshot,
      "ErrorClickCount"
    );

  const topPages =
    normalizeTopPages(
      snapshot
    );

  const normalized = {
    date,

    collected_at:
      snapshot.collectedAt,

    timezone:
      snapshot.timezone ??
      "Asia/Jerusalem",

    analysis_window:
      snapshot.analysisWindow,

    source: {
      platform:
        "Microsoft Clarity",

      method:
        "Data Export API",

      source_file:
        latestFile,

      requests_used:
        snapshot.source
          ?.requestsUsed ??
        null,

      schema_version:
        "export-v2",
    },

    traffic: {
      total_sessions:
        totalSessions,

      bot_sessions:
        botSessions,

      human_sessions:
        humanSessions,

      distinct_users:
        distinctUsers,

      pages_per_session_reported:
        round(
          pagesPerSessionReported,
          4
        ),

      total_page_views:
        null,

      total_page_views_status:
        "unavailable_from_current_export",

      total_page_views_note:
        "PopularPages contains only the top 10 URLs. pagesPerSessionPercentage is preserved as an observed Export API value and is not used to manufacture total page views.",
    },

    engagement: {
      total_time_seconds:
        engagementTotalSeconds,

      active_time_seconds:
        engagementActiveSeconds,

      active_time_percent:
        engagementActivePercent,

      average_engagement_seconds:
        null,

      average_engagement_status:
        "not_mapped",

      average_engagement_note:
        "Export API EngagementTime fields are preserved directly. They are not silently mapped to the previous MCP AvgEngagementTimeInSeconds metric.",
    },

    friction: {
      dead_clicks:
        deadClicks,

      quick_backs:
        quickBacks,

      rage_clicks:
        rageClicks,

      excessive_scroll:
        excessiveScroll,

      script_errors:
        scriptErrors,

      error_clicks:
        errorClicks,
    },

    top_pages: {
      type:
        "top_10_only",

      is_complete_page_view_dataset:
        false,

      pages:
        topPages,
    },

    comparability: {
      previous_mcp_history:
        "partial",

      warning:
        "Export v2 uses raw Data Export API definitions. Do not treat every field as directly equivalent to the earlier MCP-derived history.",

      safe_direct_comparisons: [
        "dead click count",
        "quick back count",
        "rage click count",
        "excessive scroll count",
        "script error count",
      ],
    },
  };

  await mkdir(
    NORMALIZED_DIR,
    {
      recursive: true,
    }
  );

  const normalizedPath =
    path.join(
      NORMALIZED_DIR,
      `${date}.json`
    );

  await writeFile(
    normalizedPath,
    JSON.stringify(
      normalized,
      null,
      2
    ),
    "utf8"
  );

  await mkdir(
    HISTORY_DIR,
    {
      recursive: true,
    }
  );

  const header = [
    "date",
    "collected_at",
    "total_sessions",
    "bot_sessions",
    "human_sessions",
    "distinct_users",
    "pages_per_session_reported",
    "engagement_total_seconds",
    "engagement_active_seconds",
    "engagement_active_percent",
    "dead_clicks",
    "dead_click_sessions_percent",
    "quick_backs",
    "quick_back_sessions_percent",
    "rage_clicks",
    "rage_click_sessions_percent",
    "excessive_scroll",
    "excessive_scroll_sessions_percent",
    "script_errors",
    "script_error_sessions_percent",
    "error_clicks",
    "error_click_sessions_percent",
  ];

  const values = [
    date,
    snapshot.collectedAt,
    totalSessions,
    botSessions,
    humanSessions,
    distinctUsers,
    round(
      pagesPerSessionReported,
      4
    ),
    engagementTotalSeconds,
    engagementActiveSeconds,
    engagementActivePercent,
    deadClicks.count,
    deadClicks.sessions_percent,
    quickBacks.count,
    quickBacks.sessions_percent,
    rageClicks.count,
    rageClicks.sessions_percent,
    excessiveScroll.count,
    excessiveScroll.sessions_percent,
    scriptErrors.count,
    scriptErrors.sessions_percent,
    errorClicks.count,
    errorClicks.sessions_percent,
  ];

  const newRow =
    values
      .map(csvCell)
      .join(",");

  let existingLines = [];

  try {
    const existing =
      await readFile(
        HISTORY_PATH,
        "utf8"
      );

    existingLines =
      existing
        .trim()
        .split(/\r?\n/)
        .slice(1)
        .filter(Boolean);

  } catch {
    existingLines = [];
  }

  existingLines =
    existingLines.filter(
      (line) =>
        !line.startsWith(
          `${date},`
        )
    );

  existingLines.push(
    newRow
  );

  existingLines.sort(
    (a, b) =>
      a
        .slice(0, 10)
        .localeCompare(
          b.slice(0, 10)
        )
  );

  const csv =
    [
      header.join(","),
      ...existingLines,
    ].join("\n") + "\n";

  await writeFile(
    HISTORY_PATH,
    csv,
    "utf8"
  );

  const requiredValues = {
    totalSessions,
    botSessions,
    humanSessions,
    distinctUsers,
    pagesPerSessionReported,
    engagementTotalSeconds,
    engagementActiveSeconds,

    deadClicks:
      deadClicks.count,

    quickBacks:
      quickBacks.count,

    rageClicks:
      rageClicks.count,

    excessiveScroll:
      excessiveScroll.count,

    scriptErrors:
      scriptErrors.count,
  };

  for (
    const [
      key,
      value,
    ] of Object.entries(
      requiredValues
    )
  ) {
    if (
      typeof value !==
        "number" ||
      !Number.isFinite(value)
    ) {
      throw new Error(
        `Validation failed: ${key}`
      );
    }
  }

  console.log("");
  console.log(
    "================================"
  );

  console.log(
    "CLARITY EXPORT NORMALIZATION COMPLETE"
  );

  console.log(
    "================================"
  );

  console.log(
    `Date: ${date}`
  );

  console.log(
    `Total sessions: ${totalSessions}`
  );

  console.log(
    `Bot sessions: ${botSessions}`
  );

  console.log(
    `Human sessions: ${humanSessions}`
  );

  console.log(
    `Distinct users: ${distinctUsers}`
  );

  console.log(
    `Pages/session reported: ${round(
      pagesPerSessionReported,
      4
    )}`
  );

  console.log(
    "Total page views: unavailable"
  );

  console.log(
    `Engagement total: ${engagementTotalSeconds}s`
  );

  console.log(
    `Engagement active: ${engagementActiveSeconds}s`
  );

  console.log(
    `Dead clicks: ${deadClicks.count}`
  );

  console.log(
    `Quick backs: ${quickBacks.count}`
  );

  console.log(
    `Rage clicks: ${rageClicks.count}`
  );

  console.log(
    `Excessive scroll: ${excessiveScroll.count}`
  );

  console.log(
    `Script errors: ${scriptErrors.count}`
  );

  console.log(
    `Top pages: ${topPages.length}`
  );

  console.log("");
  console.log(
    `JSON: ${normalizedPath}`
  );

  console.log(
    `CSV: ${HISTORY_PATH}`
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
    "NORMALIZATION FAILED"
  );

  console.error(
    error?.message ??
      error
  );

  process.exitCode = 1;
}
