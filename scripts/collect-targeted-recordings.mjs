import "dotenv/config";

import {
  mkdir,
  readFile,
  readdir,
  writeFile,
  rename,
} from "node:fs/promises";

import path from "node:path";

// ==================================================
// CONFIG
// ==================================================

const NORMALIZED_DIR =
  path.join("data", "normalized");

const RECORDINGS_DIR =
  path.join("data", "recordings");

const FAILED_DIR =
  path.join(
    RECORDINGS_DIR,
    "failed"
  );

const RECORDINGS_URL =
  "https://clarity.microsoft.com/mcp/recordings/sample";

const SAMPLE_COUNT = 20;
const REQUEST_DELAY_MS = 3000;

const token =
  process.env.CLARITY_API_TOKEN;

if (!token) {
  console.error(
    "CLARITY_API_TOKEN is missing."
  );

  process.exit(1);
}

// ==================================================
// HELPERS
// ==================================================

function sleep(ms) {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );
}

async function findLatestNormalized() {
  const files =
    await readdir(
      NORMALIZED_DIR
    );

  const matches =
    files
      .filter(
        (file) =>
          /^\d{4}-\d{2}-\d{2}\.json$/.test(
            file
          )
      )
      .sort();

  if (matches.length === 0) {
    throw new Error(
      "No normalized Clarity export file found."
    );
  }

  return matches[
    matches.length - 1
  ];
}

function getCount(
  normalized,
  key
) {
  const value =
    normalized
      ?.friction
      ?.[key]
      ?.count;

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function resolveWindow(
  normalized
) {
  const collectedAt =
    normalized.collected_at;

  const end =
    collectedAt
      ? new Date(collectedAt)
      : new Date();

  if (
    Number.isNaN(
      end.getTime()
    )
  ) {
    throw new Error(
      "Invalid collected_at timestamp."
    );
  }

  const start =
    new Date(
      end.getTime() -
        24 * 60 * 60 * 1000
    );

  return {
    start:
      start.toISOString(),

    end:
      end.toISOString(),
  };
}

function detectArrayCount(
  payload
) {
  if (Array.isArray(payload)) {
    return payload.length;
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
      return candidate.length;
    }
  }

  return null;
}

async function requestRecordings({
  label,
  metricCount,
  filter,
  start,
  end,
}) {
  console.log(
    `Recording sample: ${label}`
  );

  const response =
    await fetch(
      RECORDINGS_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body:
          JSON.stringify({
            /*
             * Official Clarity MCP enum:
             * 0 = SessionStart_DESC.
             */
            sortBy: 0,

            start,
            end,

            filters: {
              ...filter,

              date: {
                start,
                end,
              },
            },

            count:
              SAMPLE_COUNT,
          }),
      }
    );

  const responseText =
    await response.text();

  let payload = null;

  try {
    payload =
      responseText
        ? JSON.parse(
            responseText
          )
        : null;
  } catch {
    payload =
      responseText;
  }

  if (!response.ok) {
    const error =
      new Error(
        `${label} failed with HTTP ${response.status}`
      );

    error.httpStatus =
      response.status;

    error.responseBody =
      payload;

    throw error;
  }

  if (
    typeof payload ===
      "string" &&
    payload
      .toLowerCase()
      .includes(
        "an error occurred"
      )
  ) {
    throw new Error(
      `${label} returned a generic Clarity error.`
    );
  }

  const detectedCount =
    detectArrayCount(
      payload
    );

  const suspiciousEmpty =
    metricCount > 0 &&
    detectedCount === 0;

  console.log(
    `${label}: PASS${
      detectedCount === null
        ? ""
        : ` (${detectedCount} returned)`
    }`
  );

  if (suspiciousEmpty) {
    console.log(
      `${label}: WARNING - aggregate metric is non-zero but recordings response is empty.`
    );
  }

  return {
    label,
    metricCount,
    requestedCount:
      SAMPLE_COUNT,

    detectedRecordingCount:
      detectedCount,

    suspiciousEmpty,

    filter,
    payload,
  };
}

async function writeJsonAtomic(
  targetPath,
  data
) {
  const tempPath =
    `${targetPath}.tmp`;

  await writeFile(
    tempPath,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );

  await rename(
    tempPath,
    targetPath
  );
}

async function writeFailure(
  date,
  failure
) {
  await mkdir(
    FAILED_DIR,
    {
      recursive: true,
    }
  );

  const stamp =
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        "-"
      );

  const failurePath =
    path.join(
      FAILED_DIR,
      `${date}-${stamp}-targeted-recordings.json`
    );

  const safeFailure = {
    date,

    failedAt:
      new Date()
        .toISOString(),

    message:
      failure?.message ??
      String(failure),

    httpStatus:
      failure?.httpStatus ??
      null,

    responseBody:
      failure?.responseBody ??
      null,

    security:
      "Authorization token intentionally omitted.",
  };

  await writeFile(
    failurePath,
    JSON.stringify(
      safeFailure,
      null,
      2
    ),
    "utf8"
  );

  return failurePath;
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
    "CLARITY TARGETED RECORDINGS"
  );

  console.log(
    "================================"
  );

  const latestFile =
    await findLatestNormalized();

  const sourcePath =
    path.join(
      NORMALIZED_DIR,
      latestFile
    );

  const normalized =
    JSON.parse(
      await readFile(
        sourcePath,
        "utf8"
      )
    );

  const date =
    normalized.date;

  if (!date) {
    throw new Error(
      "Normalized file has no date."
    );
  }

  const window =
    resolveWindow(
      normalized
    );

  const candidates = [
    {
      key:
        "dead_clicks",

      label:
        "dead clicks",

      filter: {
        deadClickPresent:
          true,
      },
    },

    {
      key:
        "quick_backs",

      label:
        "quick backs",

      filter: {
        quickbackClickPresent:
          true,
      },
    },

    {
      key:
        "rage_clicks",

      label:
        "rage clicks",

      filter: {
        rageClickPresent:
          true,
      },
    },

    {
      key:
        "excessive_scroll",

      label:
        "excessive scroll",

      filter: {
        excessiveScrollPresent:
          true,
      },
    },

    {
      key:
        "script_errors",

      label:
        "JavaScript errors",

      filter: {
        javascriptErrors:
          [""],
      },
    },
  ];

  const triggers =
    candidates
      .map(
        (candidate) => ({
          ...candidate,

          metricCount:
            getCount(
              normalized,
              candidate.key
            ),
        })
      )
      .filter(
        (candidate) =>
          candidate.metricCount > 0
      );

  console.log(
    `Source: ${sourcePath}`
  );

  console.log(
    `Window: ${window.start} -> ${window.end}`
  );

  console.log(
    `Triggered cohorts: ${triggers.length}`
  );

  if (
    triggers.length === 0
  ) {
    console.log(
      "No non-zero friction signals. No recording requests needed."
    );

    process.exit(0);
  }

  console.log(
    `Planned recording requests: ${triggers.length}`
  );

  const results = [];

  for (
    let index = 0;
    index < triggers.length;
    index += 1
  ) {
    const trigger =
      triggers[index];

    const result =
      await requestRecordings({
        label:
          trigger.label,

        metricCount:
          trigger.metricCount,

        filter:
          trigger.filter,

        start:
          window.start,

        end:
          window.end,
      });

    results.push(
      result
    );

    if (
      index <
      triggers.length - 1
    ) {
      await sleep(
        REQUEST_DELAY_MS
      );
    }
  }

  await mkdir(
    RECORDINGS_DIR,
    {
      recursive: true,
    }
  );

  const outputPath =
    path.join(
      RECORDINGS_DIR,
      `${date}-targeted.json`
    );

  const output = {
    date,

    collectedAt:
      new Date()
        .toISOString(),

    source: {
      platform:
        "Microsoft Clarity",

      surface:
        "session recordings sample endpoint used by the official Clarity MCP server",

      normalizedSource:
        latestFile,

      sampleCountPerCohort:
        SAMPLE_COUNT,

      requestCount:
        results.length,
    },

    analysisWindow:
      window,

    triggerPolicy:
      "Request recordings only for friction metrics whose normalized count is greater than zero.",

    results,

    security:
      "Authorization token is never stored in this file.",
  };

  await writeJsonAtomic(
    outputPath,
    output
  );

  const warnings =
    results.filter(
      (item) =>
        item.suspiciousEmpty
    );

  console.log("");
  console.log(
    "================================"
  );

  console.log(
    "TARGETED RECORDINGS COMPLETE"
  );

  console.log(
    "================================"
  );

  console.log(
    `Date: ${date}`
  );

  console.log(
    `Requests used: ${results.length}`
  );

  console.log(
    `Warnings: ${warnings.length}`
  );

  console.log(
    `Saved: ${outputPath}`
  );

  console.log(
    "AI Credits: 0"
  );

  console.log(
    "================================"
  );

} catch (error) {
  const date =
    new Date()
      .toISOString()
      .slice(0, 10);

  let failurePath =
    null;

  try {
    failurePath =
      await writeFailure(
        date,
        error
      );
  } catch {
    // Do not mask the original error.
  }

  console.error("");
  console.error(
    "TARGETED RECORDINGS FAILED"
  );

  console.error(
    error?.message ??
      error
  );

  if (failurePath) {
    console.error(
      `Failure snapshot: ${failurePath}`
    );
  }

  process.exitCode = 2;
}
