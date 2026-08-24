import {
  readFile,
  writeFile,
  readdir,
  mkdir,
} from "node:fs/promises";

const RAW_DIR = "data/raw";
const HISTORY_FILE = "data/history/daily-kpis.csv";

const CSV_HEADER =
  "date,local_start,local_end,sessions,users,page_views,pages_per_session,average_engagement_seconds,rage_clicks,dead_clicks,quick_backs,excessive_scroll_sessions,script_errors";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

function csvEscape(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function getMetricBlock(snapshot, key) {
  const block = snapshot.analytics?.[key];

  if (!block) {
    throw new Error(`Missing analytics block: ${key}`);
  }

  if (block.error === true) {
    throw new Error(
      `Analytics block "${key}" contains an error: ${
        block.message ?? "unknown error"
      }`
    );
  }

  if (block.dataErrorType !== 0) {
    throw new Error(
      `Analytics block "${key}" has dataErrorType=${block.dataErrorType}`
    );
  }

  if (!Array.isArray(block.data)) {
    throw new Error(
      `Analytics block "${key}" does not contain a data array.`
    );
  }

  return block;
}

function extractNumber(
  snapshot,
  key,
  candidates,
  pattern = null
) {
  const block = getMetricBlock(snapshot, key);

  if (block.data.length === 0) {
    throw new Error(
      `Analytics block "${key}" returned no rows.`
    );
  }

  const row = block.data[0];

  for (const candidate of candidates) {
    const value = row[candidate];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  if (pattern) {
    const matchingKey = Object.keys(row).find(
      (field) =>
        pattern.test(field) &&
        typeof row[field] === "number" &&
        Number.isFinite(row[field])
    );

    if (matchingKey) {
      return row[matchingKey];
    }
  }

  const numericEntries = Object.entries(row).filter(
    ([, value]) =>
      typeof value === "number" &&
      Number.isFinite(value)
  );

  if (numericEntries.length === 1) {
    return numericEntries[0][1];
  }

  throw new Error(
    `Could not determine numeric value for "${key}". Fields: ${Object.keys(
      row
    ).join(", ")}`
  );
}

function firstColumn(line) {
  const comma = line.indexOf(",");

  if (comma === -1) {
    return line.trim();
  }

  return line
    .slice(0, comma)
    .replaceAll('"', "")
    .trim();
}

// --------------------------------------------------
// FIND LATEST MCP SNAPSHOT
// --------------------------------------------------

const files = await readdir(RAW_DIR);

const mcpFiles = files
  .filter((file) =>
    /^\d{4}-\d{2}-\d{2}-mcp\.json$/.test(file)
  )
  .sort();

if (mcpFiles.length === 0) {
  throw new Error(
    "No MCP snapshots found in data/raw."
  );
}

const sourceFile = mcpFiles.at(-1);

const date = sourceFile.replace(
  "-mcp.json",
  ""
);

const sourcePath = `${RAW_DIR}/${sourceFile}`;

console.log(
  `Source snapshot: ${sourcePath}`
);

// --------------------------------------------------
// LOAD + VALIDATE
// --------------------------------------------------

const snapshot = JSON.parse(
  await readFile(sourcePath, "utf8")
);

if (
  snapshot.collectionStatus?.complete !== true
) {
  throw new Error(
    "Collection is incomplete. Refusing to normalize."
  );
}

// --------------------------------------------------
// EXTRACT CORE METRICS
// --------------------------------------------------

const sessions = extractNumber(
  snapshot,
  "sessions",
  ["TotalSessions"],
  /session/i
);

const users = extractNumber(
  snapshot,
  "users",
  [
    "uniq(UserID)",
    "UniqueUsers",
    "TotalUsers",
  ],
  /user/i
);

const pageViews = extractNumber(
  snapshot,
  "pageViews",
  ["TotalPageViews"],
  /page.*view/i
);

const averageEngagementSeconds =
  extractNumber(
    snapshot,
    "averageEngagement",
    [
      "AvgEngagementTimeInSeconds",
      "AverageEngagementTimeInSeconds",
    ],
    /engagement/i
  );

const rageClicks = extractNumber(
  snapshot,
  "rageClicks",
  ["TotalRageClicks"],
  /rage.*click/i
);

const deadClicks = extractNumber(
  snapshot,
  "deadClicks",
  ["TotalDeadClicks"],
  /dead.*click/i
);

const quickBacks = extractNumber(
  snapshot,
  "quickBacks",
  ["TotalQuickBacks"],
  /quick.*back/i
);

const excessiveScrollSessions =
  extractNumber(
    snapshot,
    "excessiveScroll",
    [
      "ExcessiveScrollSessions",
      "TotalExcessiveScrollSessions",
    ],
    /excessive.*scroll/i
  );

const scriptErrors = extractNumber(
  snapshot,
  "scriptErrors",
  [
    "TotalJavaScriptErrors",
    "TotalScriptErrors",
  ],
  /(javascript|script).*error/i
);

const pagesPerSession =
  sessions > 0
    ? round(pageViews / sessions, 2)
    : 0;

// --------------------------------------------------
// TOP PAGES
// --------------------------------------------------

const topPagesBlock =
  getMetricBlock(snapshot, "topPages");

const topPages = topPagesBlock.data.map(
  (row) => ({
    url:
      row.VisitedUrl ??
      row.URL ??
      row.Url ??
      null,

    page_views:
      row.PageViews ??
      row.TotalPageViews ??
      null,
  })
);

// --------------------------------------------------
// NORMALIZED SNAPSHOT
// --------------------------------------------------

const normalized = {
  date,

  timezone:
    snapshot.timezone ??
    "Asia/Jerusalem",

  analysis_window: {
    local_start:
      snapshot.analysisWindow
        ?.localStart ?? null,

    local_end:
      snapshot.analysisWindow
        ?.localEnd ?? null,

    utc_start:
      snapshot.analysisWindow
        ?.utcStart ?? null,

    utc_end:
      snapshot.analysisWindow
        ?.utcEnd ?? null,
  },

  metrics: {
    sessions,
    users,
    page_views: pageViews,
    pages_per_session:
      pagesPerSession,
    average_engagement_seconds:
      round(
        averageEngagementSeconds,
        2
      ),

    rage_clicks: rageClicks,
    dead_clicks: deadClicks,
    quick_backs: quickBacks,
    excessive_scroll_sessions:
      excessiveScrollSessions,
    script_errors: scriptErrors,
  },

  top_pages: topPages,

  recordings:
    snapshot.recordings ?? {},

  limitations: [
    "Microsoft Clarity event.start values must be preserved as raw timestamps unless their session-relative meaning can be proven.",
    "Recording payloads are preserved as returned by Microsoft Clarity and are not reinterpreted by the normalizer.",
  ],

  source: {
    file: sourceFile,
    platform: "Microsoft Clarity",
    transport: "MCP",
  },
};

// --------------------------------------------------
// SAVE NORMALIZED JSON
// --------------------------------------------------

const normalizedPath =
  `${RAW_DIR}/${date}.json`;

await writeFile(
  normalizedPath,
  JSON.stringify(
    normalized,
    null,
    2
  ),
  "utf8"
);

console.log(
  `Normalized JSON: ${normalizedPath}`
);

// --------------------------------------------------
// UPDATE KPI HISTORY
// --------------------------------------------------

await mkdir(
  "data/history",
  {
    recursive: true,
  }
);

let existingLines = [];

try {
  const existing = await readFile(
    HISTORY_FILE,
    "utf8"
  );

  existingLines = existing
    .split(/\r?\n/)
    .filter(
      (line) =>
        line.trim() !== ""
    );
} catch {
  existingLines = [];
}

let dataLines = existingLines;

if (
  dataLines.length > 0 &&
  dataLines[0].startsWith(
    "date,"
  )
) {
  dataLines =
    dataLines.slice(1);
}

// Remove existing row for same date.
dataLines = dataLines.filter(
  (line) =>
    firstColumn(line) !== date
);

const csvRow = [
  date,
  normalized.analysis_window
    .local_start,
  normalized.analysis_window
    .local_end,
  sessions,
  users,
  pageViews,
  pagesPerSession,
  round(
    averageEngagementSeconds,
    2
  ),
  rageClicks,
  deadClicks,
  quickBacks,
  excessiveScrollSessions,
  scriptErrors,
]
  .map(csvEscape)
  .join(",");

dataLines.push(csvRow);

// Sort by ISO date.
dataLines.sort((a, b) =>
  firstColumn(a).localeCompare(
    firstColumn(b)
  )
);

const csvOutput =
  `${CSV_HEADER}\n${dataLines.join(
    "\n"
  )}\n`;

await writeFile(
  HISTORY_FILE,
  csvOutput,
  "utf8"
);

// --------------------------------------------------
// FINAL VALIDATION
// --------------------------------------------------

const rereadJson = JSON.parse(
  await readFile(
    normalizedPath,
    "utf8"
  )
);

const rereadCsv =
  await readFile(
    HISTORY_FILE,
    "utf8"
  );

const todayRows = rereadCsv
  .split(/\r?\n/)
  .filter(
    (line) =>
      firstColumn(line) === date
  );

if (todayRows.length !== 1) {
  throw new Error(
    `Expected exactly one CSV row for ${date}, found ${todayRows.length}.`
  );
}

const requiredMetrics = [
  "sessions",
  "users",
  "page_views",
  "pages_per_session",
  "average_engagement_seconds",
  "rage_clicks",
  "dead_clicks",
  "quick_backs",
  "excessive_scroll_sessions",
  "script_errors",
];

for (
  const metric of requiredMetrics
) {
  const value =
    rereadJson.metrics[
      metric
    ];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    throw new Error(
      `Normalized metric "${metric}" is not a valid number.`
    );
  }
}

// --------------------------------------------------
// FINAL OUTPUT
// --------------------------------------------------

console.log("");
console.log(
  "================================"
);
console.log(
  "CLARITY NORMALIZATION COMPLETE"
);
console.log(
  "================================"
);

console.log(
  `Date: ${date}`
);

console.log(
  `Sessions: ${rereadJson.metrics.sessions}`
);

console.log(
  `Users: ${rereadJson.metrics.users}`
);

console.log(
  `Page views: ${rereadJson.metrics.page_views}`
);

console.log(
  `Pages/session: ${rereadJson.metrics.pages_per_session}`
);

console.log(
  `Avg engagement: ${rereadJson.metrics.average_engagement_seconds}s`
);

console.log(
  `Rage clicks: ${rereadJson.metrics.rage_clicks}`
);

console.log(
  `Dead clicks: ${rereadJson.metrics.dead_clicks}`
);

console.log(
  `Quick backs: ${rereadJson.metrics.quick_backs}`
);

console.log(
  `Excessive scroll: ${rereadJson.metrics.excessive_scroll_sessions}`
);

console.log(
  `Script errors: ${rereadJson.metrics.script_errors}`
);

console.log(
  `JSON: ${normalizedPath}`
);

console.log(
  `CSV: ${HISTORY_FILE}`
);

console.log(
  "Validation: PASS"
);

console.log(
  "================================"
);