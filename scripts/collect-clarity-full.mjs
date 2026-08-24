import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ==================================================
// SECURITY
// ==================================================

const token = process.env.CLARITY_API_TOKEN;

if (!token) {
  console.error("ERROR: CLARITY_API_TOKEN is not configured.");
  process.exit(1);
}

// ==================================================
// CONFIG
// ==================================================

const MAX_ATTEMPTS = 3;

// Analytics:
// attempt 1 fails -> wait 15s
// attempt 2 fails -> wait 45s
// attempt 3 fails -> abort entire collection
const ANALYTICS_RETRY_DELAYS_MS = [
  15000,
  45000,
];

// Pause between successful analytics requests.
const ANALYTICS_INTER_REQUEST_DELAY_MS = 2000;

// Recordings:
// attempt 1 fails -> wait 30s
// attempt 2 fails -> wait 60s
// attempt 3 fails -> abort remaining recordings
const RECORDING_RETRY_DELAYS_MS = [
  30000,
  60000,
];

// Pause between successful recording queries.
const RECORDING_INTER_REQUEST_DELAY_MS = 5000;

// 100 is more than enough for our daily investigation
// and lighter than requesting the maximum 250.
const RECORDING_COUNT = 100;

// ==================================================
// ENVIRONMENT
// ==================================================

const safeEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([, value]) => value !== undefined
  )
);

// ==================================================
// MCP TRANSPORT
// ==================================================

const transport = new StdioClientTransport({
  command: "C:\\Program Files\\nodejs\\npx.cmd",

  args: [
    "-y",
    "@microsoft/clarity-mcp-server",
  ],

  env: {
    ...safeEnv,
    CLARITY_API_TOKEN: token,
  },
});

const client = new Client(
  {
    name: "clarity-product-analyst-collector",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

// ==================================================
// TIME WINDOW
// ==================================================

const now = new Date();

const start = new Date(
  now.getTime() -
    24 * 60 * 60 * 1000
);

const utcStart = start.toISOString();
const utcEnd = now.toISOString();

// ==================================================
// HELPERS
// ==================================================

const sleep = (ms) =>
  new Promise(
    (resolve) => setTimeout(resolve, ms)
  );

function jerusalemDate(date) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Jerusalem",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(date);

  const map =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !== "literal"
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  return `${map.year}-${map.month}-${map.day}`;
}

function jerusalemDateTime(date) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }
  ).format(date);
}

const date =
  jerusalemDate(now);

const queryWindow =
  `from ${utcStart} to ${utcEnd}`;

// ==================================================
// MCP RESPONSE PARSER
// ==================================================

function extractToolResponse(response) {
  const textItems =
    (response.content ?? [])
      .filter(
        (item) =>
          item.type === "text"
      )
      .map(
        (item) => item.text
      );

  if (textItems.length === 0) {
    return {
      raw:
        response.content ?? [],
    };
  }

  const joined =
    textItems.join("\n");

  try {
    return JSON.parse(joined);
  } catch {
    return {
      text: joined,
    };
  }
}

// ==================================================
// RESPONSE VALIDATION
// ==================================================

function analyticsResponseIsValid(parsed) {
  return (
    parsed &&
    parsed.dataErrorType === 0 &&
    Array.isArray(parsed.data)
  );
}

function recordingsResponseIsValid(parsed) {
  // Current Clarity recordings payload.
  if (Array.isArray(parsed)) {
    return true;
  }

  // Defensive fallback if Microsoft later
  // wraps recordings inside "data".
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray(parsed.data)
  ) {
    return true;
  }

  return false;
}

// ==================================================
// METRIC EXTRACTION
// ==================================================

function getMetricNumber(
  analytics,
  key,
  candidates
) {
  const block =
    analytics?.[key];

  if (
    !block ||
    block.error === true ||
    !Array.isArray(block.data) ||
    block.data.length === 0
  ) {
    return null;
  }

  const row =
    block.data[0];

  for (
    const candidate of candidates
  ) {
    const value =
      row[candidate];

    if (
      typeof value === "number" &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  // Safe fallback only if exactly one
  // numeric field exists.
  const numericValues =
    Object.values(row).filter(
      (value) =>
        typeof value === "number" &&
        Number.isFinite(value)
    );

  if (
    numericValues.length === 1
  ) {
    return numericValues[0];
  }

  return null;
}

// ==================================================
// ANALYTICS REQUEST WITH RETRY
// ==================================================

async function callAnalytics(
  label,
  query
) {
  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    console.log(
      `Analytics: ${label} (attempt ${attempt}/${MAX_ATTEMPTS})`
    );

    try {
      const response =
        await client.callTool({
          name:
            "query-analytics-dashboard",

          arguments: {
            query,
          },
        });

      if (response.isError) {
        throw new Error(
          `MCP tool error: ${JSON.stringify(
            response.content
          )}`
        );
      }

      const parsed =
        extractToolResponse(
          response
        );

      if (
        !analyticsResponseIsValid(
          parsed
        )
      ) {
        const details =
          parsed?.text ??
          `dataErrorType=${parsed?.dataErrorType}`;

        throw new Error(
          `Invalid Clarity analytics response: ${details}`
        );
      }

      return parsed;
    } catch (error) {
      const message =
        error?.message ??
        String(error);

      console.error(
        `Analytics "${label}" failed on attempt ${attempt}: ${message}`
      );

      if (
        attempt ===
        MAX_ATTEMPTS
      ) {
        return {
          error: true,
          attempts:
            MAX_ATTEMPTS,
          message,
          data: null,
          dataErrorType: null,
        };
      }

      const waitMs =
        ANALYTICS_RETRY_DELAYS_MS[
          attempt - 1
        ];

      console.log(
        `Rate limit/error detected. Waiting ${waitMs / 1000}s before retrying "${label}"...`
      );

      await sleep(waitMs);
    }
  }
}

// ==================================================
// RECORDINGS REQUEST WITH RETRY
// ==================================================

async function callRecordings(
  label,
  filters,
  sortBy
) {
  for (
    let attempt = 1;
    attempt <= MAX_ATTEMPTS;
    attempt++
  ) {
    console.log(
      `Recordings: ${label} (attempt ${attempt}/${MAX_ATTEMPTS})`
    );

    try {
      const response =
        await client.callTool({
          name:
            "list-session-recordings",

          arguments: {
            filters,
            sortBy,
            count:
              RECORDING_COUNT,
          },
        });

      if (response.isError) {
        throw new Error(
          `MCP tool error: ${JSON.stringify(
            response.content
          )}`
        );
      }

      const parsed =
        extractToolResponse(
          response
        );

      /*
       * Microsoft Clarity MCP currently catches
       * HTTP failures itself and can return:
       *
       * "An error occurred while fetching the data."
       *
       * as normal MCP text.
       *
       * Therefore response.isError alone is
       * not sufficient.
       */
      if (
        !recordingsResponseIsValid(
          parsed
        )
      ) {
        const details =
          parsed?.text ??
          JSON.stringify(parsed);

        throw new Error(
          `Invalid Clarity recordings response: ${details}`
        );
      }

      return parsed;
    } catch (error) {
      const message =
        error?.message ??
        String(error);

      console.error(
        `Recordings "${label}" failed on attempt ${attempt}: ${message}`
      );

      if (
        attempt ===
        MAX_ATTEMPTS
      ) {
        return {
          error: true,
          attempts:
            MAX_ATTEMPTS,
          message,
          data: null,
        };
      }

      const waitMs =
        RECORDING_RETRY_DELAYS_MS[
          attempt - 1
        ];

      console.log(
        `Rate limit/error detected. Waiting ${waitMs / 1000}s before retrying recordings "${label}"...`
      );

      await sleep(waitMs);
    }
  }
}

// ==================================================
// SNAPSHOT WRITER
// ==================================================

async function saveSnapshot({
  analytics,
  recordings,
  failedAnalytics,
  failedRecordings,
  abortedAt,
}) {
  const collectionComplete =
    failedAnalytics.length === 0 &&
    failedRecordings.length === 0 &&
    abortedAt === null;

  const snapshot = {
    collectedAt:
      now.toISOString(),

    timezone:
      "Asia/Jerusalem",

    analysisWindow: {
      localStart:
        jerusalemDateTime(
          start
        ),

      localEnd:
        jerusalemDateTime(
          now
        ),

      utcStart,
      utcEnd,
    },

    source: {
      platform:
        "Microsoft Clarity",

      transport:
        "MCP",

      analyticsTool:
        "query-analytics-dashboard",

      recordingsTool:
        "list-session-recordings",
    },

    collectionStatus: {
      complete:
        collectionComplete,

      abortedAt,

      failedAnalytics,

      failedRecordings,

      maxAttemptsPerRequest:
        MAX_ATTEMPTS,

      analyticsInterRequestDelayMs:
        ANALYTICS_INTER_REQUEST_DELAY_MS,

      recordingInterRequestDelayMs:
        RECORDING_INTER_REQUEST_DELAY_MS,

      recordingCount:
        RECORDING_COUNT,
    },

    analytics,

    recordings,
  };

  await mkdir(
    "data/raw",
    {
      recursive: true,
    }
  );

  const outputPath =
    `data/raw/${date}-mcp.json`;

  await writeFile(
    outputPath,
    JSON.stringify(
      snapshot,
      null,
      2
    ),
    "utf8"
  );

  return {
    snapshot,
    outputPath,
    collectionComplete,
  };
}

// ==================================================
// SUMMARY
// ==================================================

function printSummary(
  snapshot,
  outputPath
) {
  console.log("");
  console.log(
    "================================"
  );

  console.log(
    "CLARITY COLLECTION COMPLETE"
  );

  console.log(
    "================================"
  );

  console.log(
    `Date: ${date}`
  );

  console.log(
    `Local start: ${snapshot.analysisWindow.localStart}`
  );

  console.log(
    `Local end:   ${snapshot.analysisWindow.localEnd}`
  );

  console.log(
    `UTC start:   ${utcStart}`
  );

  console.log(
    `UTC end:     ${utcEnd}`
  );

  console.log(
    `Saved: ${outputPath}`
  );

  console.log(
    `Collection complete: ${
      snapshot.collectionStatus.complete
        ? "YES"
        : "NO"
    }`
  );

  if (
    snapshot.collectionStatus
      .abortedAt
  ) {
    console.log(
      `Aborted at: ${snapshot.collectionStatus.abortedAt}`
    );
  }

  if (
    snapshot.collectionStatus
      .failedAnalytics.length >
    0
  ) {
    console.log(
      `Failed analytics: ${snapshot.collectionStatus.failedAnalytics.join(", ")}`
    );
  }

  if (
    snapshot.collectionStatus
      .failedRecordings.length >
    0
  ) {
    console.log(
      `Failed recordings: ${snapshot.collectionStatus.failedRecordings.join(", ")}`
    );
  }

  console.log(
    "================================"
  );
}

// ==================================================
// MAIN
// ==================================================

let connected = false;

try {
  console.log(
    "Connecting to Microsoft Clarity MCP..."
  );

  await client.connect(
    transport
  );

  connected = true;

  const toolsResult =
    await client.listTools();

  const tools =
    toolsResult.tools.map(
      (tool) => tool.name
    );

  console.log(
    "Connected."
  );

  console.log(
    "Available tools:",
    tools.join(", ")
  );

  if (
    !tools.includes(
      "query-analytics-dashboard"
    )
  ) {
    throw new Error(
      "query-analytics-dashboard is unavailable."
    );
  }

  if (
    !tools.includes(
      "list-session-recordings"
    )
  ) {
    throw new Error(
      "list-session-recordings is unavailable."
    );
  }

  // =================================================
  // ANALYTICS PLAN
  // =================================================

  const analytics = {};

  const failedAnalytics = [];

  const recordings = {};

  const failedRecordings = [];

  let abortedAt = null;

  const analyticsPlan = [
    {
      key: "sessions",
      label: "sessions",
      query:
        `Total sessions for non-bot users ${queryWindow}`,
    },

    {
      key: "users",
      label: "users",
      query:
        `Unique users for non-bot users ${queryWindow}`,
    },

    {
      key: "pageViews",
      label: "page views",
      query:
        `Total page views for non-bot users ${queryWindow}`,
    },

    {
      key:
        "averageEngagement",

      label:
        "average engagement",

      query:
        `Average engagement time per session for non-bot users ${queryWindow}`,
    },

    {
      key: "topPages",
      label: "top pages",

      query:
        `Top 10 pages by page views for non-bot users ${queryWindow}`,
    },

    {
      key: "rageClicks",
      label: "rage clicks",

      query:
        `Total rage clicks for non-bot users ${queryWindow}`,
    },

    {
      key: "deadClicks",
      label: "dead clicks",

      query:
        `Total dead clicks for non-bot users ${queryWindow}`,
    },

    {
      key: "quickBacks",
      label: "quick backs",

      query:
        `Total quick backs for non-bot users ${queryWindow}`,
    },

    {
      key:
        "excessiveScroll",

      label:
        "excessive scrolling",

      query:
        `Total excessive scrolling sessions for non-bot users ${queryWindow}`,
    },

    {
      key:
        "scriptErrors",

      label:
        "JavaScript errors",

      query:
        `Total JavaScript errors for non-bot users ${queryWindow}`,
    },
  ];

  // =================================================
  // COLLECT ANALYTICS — FAIL FAST
  // =================================================

  for (
    let index = 0;
    index <
    analyticsPlan.length;
    index++
  ) {
    const step =
      analyticsPlan[index];

    const result =
      await callAnalytics(
        step.label,
        step.query
      );

    analytics[
      step.key
    ] = result;

    if (
      result?.error === true
    ) {
      failedAnalytics.push(
        step.key
      );

      abortedAt =
        `analytics:${step.key}`;

      console.error("");
      console.error(
        `Analytics collection failed permanently at "${step.label}".`
      );

      console.error(
        "Stopping additional Clarity requests to protect against further rate limiting."
      );

      break;
    }

    // Pause before next analytics request.
    if (
      index <
      analyticsPlan.length - 1
    ) {
      await sleep(
        ANALYTICS_INTER_REQUEST_DELAY_MS
      );
    }
  }

  // If analytics failed, DO NOT query recordings.
  if (
    failedAnalytics.length > 0
  ) {
    const {
      snapshot,
      outputPath,
    } =
      await saveSnapshot({
        analytics,
        recordings,
        failedAnalytics,
        failedRecordings,
        abortedAt,
      });

    printSummary(
      snapshot,
      outputPath
    );

    console.error("");
    console.error(
      "Collection incomplete. Pipeline must stop."
    );

    process.exitCode = 2;
  } else {
    // =================================================
    // READ FRUSTRATION COUNTS
    // =================================================

    const rageClicks =
      getMetricNumber(
        analytics,
        "rageClicks",
        [
          "TotalRageClicks",
        ]
      );

    const deadClicks =
      getMetricNumber(
        analytics,
        "deadClicks",
        [
          "TotalDeadClicks",
        ]
      );

    const quickBacks =
      getMetricNumber(
        analytics,
        "quickBacks",
        [
          "TotalQuickBacks",
        ]
      );

    const excessiveScroll =
      getMetricNumber(
        analytics,
        "excessiveScroll",
        [
          "ExcessiveScrollSessions",
          "TotalExcessiveScrollSessions",
        ]
      );

    const scriptErrors =
      getMetricNumber(
        analytics,
        "scriptErrors",
        [
          "TotalJavaScriptErrors",
          "TotalScriptErrors",
        ]
      );

    const requiredCounts = {
      rageClicks,
      deadClicks,
      quickBacks,
      excessiveScroll,
      scriptErrors,
    };

    const missingCount =
      Object.entries(
        requiredCounts
      ).find(
        ([, value]) =>
          value === null
      );

    if (missingCount) {
      failedAnalytics.push(
        missingCount[0]
      );

      abortedAt =
        `metric-value:${missingCount[0]}`;

      console.error(
        `Could not determine numeric value for ${missingCount[0]}.`
      );
    }

    // =================================================
    // RECORDINGS PLAN
    // =================================================

    if (
      failedAnalytics.length ===
      0
    ) {
      const baseDateFilter = {
        date: {
          start: utcStart,
          end: utcEnd,
        },
      };

      const recordingPlan = [
        {
          key: "quickBack",
          label: "quick backs",
          metricValue:
            quickBacks,

          filters: {
            ...baseDateFilter,

            quickbackClickPresent:
              true,
          },
        },

        {
          key: "deadClick",
          label: "dead clicks",
          metricValue:
            deadClicks,

          filters: {
            ...baseDateFilter,

            deadClickPresent:
              true,
          },
        },

        {
          key: "rageClick",
          label: "rage clicks",
          metricValue:
            rageClicks,

          filters: {
            ...baseDateFilter,

            rageClickPresent:
              true,
          },
        },

        {
          key:
            "excessiveScroll",

          label:
            "excessive scrolling",

          metricValue:
            excessiveScroll,

          filters: {
            ...baseDateFilter,

            excessiveScrollPresent:
              true,
          },
        },

        {
          key:
            "scriptErrors",

          label:
            "JavaScript errors",

          metricValue:
            scriptErrors,

          filters: {
            ...baseDateFilter,

            javascriptErrors: [
              "",
            ],
          },
        },
      ];

      // Clarity's current MCP schema explicitly supports
      // javascriptErrors: [""] to match any JS error.

      let actualRecordingQueryMade =
        false;

      for (
        const step of
        recordingPlan
      ) {
        if (
          step.metricValue === 0
        ) {
          console.log(
            `Recordings: ${step.label} skipped (metric = 0)`
          );

          recordings[
            step.key
          ] = {
            skipped: true,
            reason:
              "metric_zero",
            metricValue: 0,
          };

          continue;
        }

        if (
          actualRecordingQueryMade
        ) {
          console.log(
            `Waiting ${RECORDING_INTER_REQUEST_DELAY_MS / 1000}s before next recordings request...`
          );

          await sleep(
            RECORDING_INTER_REQUEST_DELAY_MS
          );
        }

        const result =
          await callRecordings(
            step.label,
            step.filters,
            "SessionStart_ASC"
          );

        recordings[
          step.key
        ] = result;

        actualRecordingQueryMade =
          true;

        if (
          result?.error ===
          true
        ) {
          failedRecordings.push(
            step.key
          );

          abortedAt =
            `recordings:${step.key}`;

          console.error("");
          console.error(
            `Recordings collection failed permanently at "${step.label}".`
          );

          console.error(
            "Stopping additional recording requests."
          );

          break;
        }
      }
    }

    // =================================================
    // SAVE FINAL/PARTIAL SNAPSHOT
    // =================================================

    const {
      snapshot,
      outputPath,
      collectionComplete,
    } =
      await saveSnapshot({
        analytics,
        recordings,
        failedAnalytics,
        failedRecordings,
        abortedAt,
      });

    printSummary(
      snapshot,
      outputPath
    );

    if (
      !collectionComplete
    ) {
      console.error("");
      console.error(
        "Collection incomplete. Pipeline must stop."
      );

      process.exitCode = 2;
    }
  }
} catch (error) {
  console.error("");
  console.error(
    "Collector failed:"
  );

  console.error(
    error?.message ??
      error
  );

  process.exitCode = 1;
} finally {
  if (connected) {
    await client.close();
  }
}