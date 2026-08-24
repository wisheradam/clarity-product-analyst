import "dotenv/config";

import {
  mkdir,
  writeFile,
  rename,
} from "node:fs/promises";

// ==================================================
// CONFIG
// ==================================================

const API_URL =
  "https://www.clarity.ms/export-data/api/v1/project-live-insights";

const NUM_OF_DAYS = 1;

const REQUEST_DELAY_MS = 2000;

const token =
  process.env.CLARITY_API_TOKEN;

if (!token) {
  console.error(
    "ERROR: CLARITY_API_TOKEN is not configured."
  );

  process.exit(1);
}

// ==================================================
// HELPERS
// ==================================================

const sleep = (ms) =>
  new Promise(
    (resolve) =>
      setTimeout(resolve, ms)
  );

function jerusalemDate(date) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Jerusalem",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",
      }
    ).formatToParts(date);

  const map =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !==
            "literal"
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

function jerusalemDateTime(
  date
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      timeZone:
        "Asia/Jerusalem",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      second:
        "2-digit",

      hour12:
        false,
    }
  ).format(date);
}

function timeFilePart(date) {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone:
          "Asia/Jerusalem",

        hour:
          "2-digit",

        minute:
          "2-digit",

        second:
          "2-digit",

        hour12:
          false,
      }
    ).formatToParts(date);

  const map =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            part.type !==
            "literal"
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  return (
    `${map.hour}` +
    `${map.minute}` +
    `${map.second}`
  );
}

function metricMap(data) {
  return Object.fromEntries(
    data.map(
      (metric) => [
        metric.metricName,
        metric,
      ]
    )
  );
}

function validateExportPayload(
  data,
  label
) {
  if (
    !Array.isArray(data)
  ) {
    throw new Error(
      `${label}: response is not an array.`
    );
  }

  if (
    data.length === 0
  ) {
    throw new Error(
      `${label}: response is empty.`
    );
  }

  for (
    const entry of data
  ) {
    if (
      !entry ||
      typeof entry.metricName !==
        "string"
    ) {
      throw new Error(
        `${label}: metricName is missing.`
      );
    }

    if (
      !Array.isArray(
        entry.information
      )
    ) {
      throw new Error(
        `${label}: metric "${entry.metricName}" has no information array.`
      );
    }
  }

  return true;
}

function getMaxInformationRows(
  data
) {
  return Math.max(
    0,
    ...data.map(
      (metric) =>
        Array.isArray(
          metric.information
        )
          ? metric
              .information
              .length
          : 0
    )
  );
}

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

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

// ==================================================
// OPTIONAL PREVIEW
// ==================================================
//
// This is only diagnostic.
// It does NOT update KPI history.
//
// We will verify these fields against
// our own live Clarity response before
// using them as historical truth.
// ==================================================

function buildPreview(
  projectData
) {
  const metrics =
    metricMap(projectData);

  const traffic =
    metrics.Traffic
      ?.information?.[0] ??
    null;

  const engagement =
    metrics.EngagementTime
      ?.information?.[0] ??
    null;

  const frictionNames = [
    "DeadClickCount",
    "ExcessiveScroll",
    "RageClickCount",
    "QuickbackClick",
    "ScriptErrorCount",
    "ErrorClickCount",
  ];

  const friction = {};

  for (
    const metricName of
    frictionNames
  ) {
    const row =
      metrics[
        metricName
      ]?.information?.[0];

    friction[
      metricName
    ] = row
      ? {
          subTotal:
            toNumber(
              row.subTotal
            ),

          sessionsCount:
            toNumber(
              row.sessionsCount
            ),

          sessionsWithMetricPercentage:
            toNumber(
              row.sessionsWithMetricPercentage
            ),

          pagesViews:
            toNumber(
              row.pagesViews
            ),
        }
      : null;
  }

  return {
    traffic:
      traffic
        ? {
            totalSessionCount:
              toNumber(
                traffic.totalSessionCount
              ),

            totalBotSessionCount:
              toNumber(
                traffic.totalBotSessionCount
              ),

            distinctUserCount:
              toNumber(
                traffic.distinctUserCount ??
                  traffic.distantUserCount
              ),

            pagesPerSession:
              toNumber(
                traffic.pagesPerSessionPercentage ??
                  traffic.PagesPerSessionPercentage
              ),
          }
        : null,

    engagement:
      engagement
        ? {
            totalTime:
              toNumber(
                engagement.totalTime
              ),

            activeTime:
              toNumber(
                engagement.activeTime
              ),
          }
        : null,

    friction,
  };
}

// ==================================================
// HTTP REQUEST
// ==================================================

async function requestExport(
  label,
  dimensions = {}
) {
  const url =
    new URL(API_URL);

  url.searchParams.set(
    "numOfDays",
    String(NUM_OF_DAYS)
  );

  if (
    dimensions.dimension1
  ) {
    url.searchParams.set(
      "dimension1",
      dimensions.dimension1
    );
  }

  if (
    dimensions.dimension2
  ) {
    url.searchParams.set(
      "dimension2",
      dimensions.dimension2
    );
  }

  if (
    dimensions.dimension3
  ) {
    url.searchParams.set(
      "dimension3",
      dimensions.dimension3
    );
  }

  console.log(
    `Export API: ${label}`
  );

  const response =
    await fetch(
      url,
      {
        method: "GET",

        headers: {
          Authorization:
            `Bearer ${token}`,

          "Content-Type":
            "application/json",
        },
      }
    );

  const contentType =
    response.headers.get(
      "content-type"
    ) ?? "";

  let body;

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    try {
      body =
        await response.json();
    } catch {
      body = null;
    }
  } else {
    body =
      await response.text();
  }

  if (!response.ok) {
    const retryAfter =
      response.headers.get(
        "retry-after"
      );

    const error =
      new Error(
        `Clarity Export API "${label}" failed with HTTP ${response.status}.`
      );

    error.status =
      response.status;

    error.retryAfter =
      retryAfter;

    error.responseBody =
      body;

    throw error;
  }

  validateExportPayload(
    body,
    label
  );

  return {
    label,

    dimensions,

    status:
      response.status,

    receivedAt:
      new Date()
        .toISOString(),

    data:
      body,
  };
}

// ==================================================
// FAILURE WRITER
// ==================================================

async function writeFailure({
  now,
  failure,
  completedRequests,
}) {
  const date =
    jerusalemDate(now);

  const time =
    timeFilePart(now);

  await mkdir(
    "data/raw/failed",
    {
      recursive: true,
    }
  );

  const path =
    `data/raw/failed/${date}-${time}-export.json`;

  const payload = {
    collectedAt:
      now.toISOString(),

    timezone:
      "Asia/Jerusalem",

    source: {
      platform:
        "Microsoft Clarity",

      api:
        "Data Export API",

      endpoint:
        API_URL,

      numOfDays:
        NUM_OF_DAYS,
    },

    collectionStatus: {
      complete:
        false,

      httpStatus:
        failure.status ??
        null,

      retryAfter:
        failure.retryAfter ??
        null,

      message:
        failure.message,
    },

    completedRequests,
  };

  await writeFile(
    path,
    JSON.stringify(
      payload,
      null,
      2
    ),
    "utf8"
  );

  return path;
}

// ==================================================
// MAIN
// ==================================================

const now =
  new Date();

const approximateStart =
  new Date(
    now.getTime() -
      24 *
        60 *
        60 *
        1000
  );

const date =
  jerusalemDate(now);

const completedRequests =
  [];

try {
  console.log("");
  console.log(
    "================================"
  );

  console.log(
    "CLARITY DATA EXPORT COLLECTION"
  );

  console.log(
    "================================"
  );

  console.log(
    "Planned API requests: 2"
  );

  console.log(
    "Request 1: project totals"
  );

  console.log(
    "Request 2: URL breakdown"
  );

  console.log(
    "================================"
  );

  // -----------------------------------------------
  // REQUEST 1 — PROJECT TOTALS
  // -----------------------------------------------

  const project =
    await requestExport(
      "project totals"
    );

  completedRequests.push({
    label:
      project.label,

    receivedAt:
      project.receivedAt,

    status:
      project.status,
  });

  console.log(
    "Project totals: PASS"
  );

  // Do not hit Clarity twice
  // back-to-back.
  await sleep(
    REQUEST_DELAY_MS
  );

  // -----------------------------------------------
  // REQUEST 2 — URL BREAKDOWN
  // -----------------------------------------------

  const byUrl =
    await requestExport(
      "URL breakdown",
      {
        dimension1:
          "URL",
      }
    );

  completedRequests.push({
    label:
      byUrl.label,

    receivedAt:
      byUrl.receivedAt,

    status:
      byUrl.status,
  });

  console.log(
    "URL breakdown: PASS"
  );

  // -----------------------------------------------
  // VALIDATION
  // -----------------------------------------------

  const projectMetricNames =
    project.data.map(
      (metric) =>
        metric.metricName
    );

  const urlMetricNames =
    byUrl.data.map(
      (metric) =>
        metric.metricName
    );

  const maxUrlRows =
    getMaxInformationRows(
      byUrl.data
    );

  const possiblyTruncated =
    maxUrlRows >= 1000;

  const preview =
    buildPreview(
      project.data
    );

  // -----------------------------------------------
  // SNAPSHOT
  // -----------------------------------------------

  const snapshot = {
    collectedAt:
      now.toISOString(),

    timezone:
      "Asia/Jerusalem",

    analysisWindow: {
      type:
        "rolling_last_24_hours",

      numOfDays:
        NUM_OF_DAYS,

      approximateLocalStart:
        jerusalemDateTime(
          approximateStart
        ),

      approximateLocalEnd:
        jerusalemDateTime(
          now
        ),

      approximateUtcStart:
        approximateStart
          .toISOString(),

      approximateUtcEnd:
        now.toISOString(),

      note:
        "Microsoft Clarity Data Export API defines numOfDays=1 as the previous 24 hours. The API response itself is UTC.",
    },

    source: {
      platform:
        "Microsoft Clarity",

      api:
        "Data Export API",

      endpoint:
        API_URL,

      requestsUsed:
        2,
    },

    collectionStatus: {
      complete:
        true,

      possiblyTruncated,

      maxInformationRows:
        maxUrlRows,

      warning:
        possiblyTruncated
          ? "At least one metric contains 1000 rows. The Export API has no pagination, so the URL breakdown may be truncated."
          : null,
    },

    metricNames: {
      project:
        projectMetricNames,

      url:
        urlMetricNames,
    },

    preview,

    export: {
      project:
        project.data,

      byUrl:
        byUrl.data,
    },
  };

  // -----------------------------------------------
  // ATOMIC SAVE
  // -----------------------------------------------

  await mkdir(
    "data/raw",
    {
      recursive: true,
    }
  );

  const outputPath =
    `data/raw/${date}-export.json`;

  const tempPath =
    `${outputPath}.tmp`;

  await writeFile(
    tempPath,
    JSON.stringify(
      snapshot,
      null,
      2
    ),
    "utf8"
  );

  await rename(
    tempPath,
    outputPath
  );

  // -----------------------------------------------
  // SUMMARY
  // -----------------------------------------------

  console.log("");
  console.log(
    "================================"
  );

  console.log(
    "CLARITY EXPORT COMPLETE"
  );

  console.log(
    "================================"
  );

  console.log(
    `Date: ${date}`
  );

  console.log(
    "Requests used: 2"
  );

  console.log(
    `Project metric groups: ${projectMetricNames.length}`
  );

  console.log(
    `URL metric groups: ${urlMetricNames.length}`
  );

  console.log(
    `Largest URL result set: ${maxUrlRows}`
  );

  console.log(
    `Possible truncation: ${
      possiblyTruncated
        ? "YES"
        : "NO"
    }`
  );

  console.log(
    `Saved: ${outputPath}`
  );

  console.log(
    "Collection complete: YES"
  );

  console.log(
    "================================"
  );

} catch (error) {
  console.error("");
  console.error(
    "CLARITY EXPORT FAILED"
  );

  console.error(
    error?.message ??
      error
  );

  if (
    error?.status === 429
  ) {
    console.error(
      "Daily Clarity API quota is exhausted."
    );

    console.error(
      "Do not retry today."
    );
  }

  const failurePath =
    await writeFailure({
      now,
      failure:
        error,

      completedRequests,
    });

  console.error(
    `Failure snapshot: ${failurePath}`
  );

  process.exitCode = 2;
}