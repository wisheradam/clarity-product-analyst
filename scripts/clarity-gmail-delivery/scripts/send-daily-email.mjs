import "dotenv/config";

import {
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";

import path from "node:path";
import nodemailer from "nodemailer";

// ==================================================
// CONFIG
// ==================================================

const REPORTS_DIR = "reports";
const NORMALIZED_DIR = path.join("data", "normalized");
const EMAIL_STATE_DIR = path.join("data", "email");

const forceSend =
  process.argv.includes("--force");

const gmailUser =
  process.env.REPORT_EMAIL_FROM;

const recipient =
  process.env.REPORT_EMAIL_TO;

const appPassword =
  process.env.GMAIL_APP_PASSWORD;

// ==================================================
// HELPERS
// ==================================================

async function findLatestNormalizedDate() {
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
      "No normalized Clarity JSON found."
    );
  }

  return matches[
    matches.length - 1
  ].slice(0, 10);
}

async function readRequired(
  targetPath,
  label
) {
  try {
    return await readFile(
      targetPath,
      "utf8"
    );
  } catch {
    throw new Error(
      `${label} not found: ${targetPath}`
    );
  }
}

function numberOrZero(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function buildSubject(
  date,
  normalized
) {
  const humanSessions =
    numberOrZero(
      normalized
        ?.traffic
        ?.human_sessions
    );

  const deadClicks =
    numberOrZero(
      normalized
        ?.friction
        ?.dead_clicks
        ?.count
    );

  const quickBacks =
    numberOrZero(
      normalized
        ?.friction
        ?.quick_backs
        ?.count
    );

  return (
    `INNOVA Clarity Daily — ${date}` +
    ` | ${humanSessions} sessions` +
    ` | ${deadClicks} dead` +
    ` | ${quickBacks} quick backs`
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
    "SEND DAILY CLARITY EMAIL"
  );

  console.log(
    "================================"
  );

  if (!gmailUser) {
    throw new Error(
      "REPORT_EMAIL_FROM is missing from .env."
    );
  }

  if (!recipient) {
    throw new Error(
      "REPORT_EMAIL_TO is missing from .env."
    );
  }

  if (!appPassword) {
    throw new Error(
      "GMAIL_APP_PASSWORD is missing from .env."
    );
  }

  const date =
    await findLatestNormalizedDate();

  const normalizedPath =
    path.join(
      NORMALIZED_DIR,
      `${date}.json`
    );

  const htmlPath =
    path.join(
      REPORTS_DIR,
      `clarity-local-daily-${date}.html`
    );

  const markdownPath =
    path.join(
      REPORTS_DIR,
      `clarity-local-daily-${date}.md`
    );

  const sentMarkerPath =
    path.join(
      EMAIL_STATE_DIR,
      `${date}-sent.json`
    );

  if (!forceSend) {
    try {
      await readFile(
        sentMarkerPath,
        "utf8"
      );

      console.log(
        `Email for ${date} was already sent.`
      );

      console.log(
        "Skipping duplicate delivery."
      );

      console.log(
        "Use --force only when you intentionally want to resend."
      );

      console.log(
        "================================"
      );

      process.exit(0);
    } catch {
      // No sent marker yet.
    }
  }

  const normalized =
    JSON.parse(
      await readRequired(
        normalizedPath,
        "Normalized data"
      )
    );

  const html =
    await readRequired(
      htmlPath,
      "HTML report"
    );

  const markdown =
    await readRequired(
      markdownPath,
      "Markdown report"
    );

  const transporter =
    nodemailer.createTransport({
      host:
        "smtp.gmail.com",

      port:
        465,

      secure:
        true,

      auth: {
        user:
          gmailUser,

        pass:
          appPassword,
      },
    });

  console.log(
    "Verifying Gmail SMTP connection..."
  );

  await transporter.verify();

  console.log(
    "Gmail SMTP: PASS"
  );

  const subject =
    buildSubject(
      date,
      normalized
    );

  console.log(
    `Sending to: ${recipient}`
  );

  const info =
    await transporter.sendMail({
      from:
        gmailUser,

      to:
        recipient,

      subject,

      html,

      text:
        markdown,

      attachments: [
        {
          filename:
            `clarity-daily-${date}.html`,

          path:
            path.resolve(
              htmlPath
            ),
        },

        {
          filename:
            `clarity-daily-${date}.md`,

          path:
            path.resolve(
              markdownPath
            ),
        },
      ],
    });

  await mkdir(
    EMAIL_STATE_DIR,
    {
      recursive: true,
    }
  );

  const marker = {
    date,

    sentAt:
      new Date()
        .toISOString(),

    from:
      gmailUser,

    to:
      recipient,

    subject,

    messageId:
      info.messageId ??
      null,

    transport:
      "Gmail SMTP",

    attachments: [
      `clarity-daily-${date}.html`,
      `clarity-daily-${date}.md`,
    ],

    security:
      "Gmail App Password intentionally omitted.",
  };

  await writeFile(
    sentMarkerPath,
    JSON.stringify(
      marker,
      null,
      2
    ),
    "utf8"
  );

  console.log("");
  console.log(
    "================================"
  );

  console.log(
    "EMAIL SENT"
  );

  console.log(
    "================================"
  );

  console.log(
    `Date: ${date}`
  );

  console.log(
    `To: ${recipient}`
  );

  console.log(
    `Subject: ${subject}`
  );

  console.log(
    `Message ID: ${info.messageId ?? "N/A"}`
  );

  console.log(
    `Marker: ${sentMarkerPath}`
  );

  console.log(
    "AI Credits: 0"
  );

  console.log(
    "================================"
  );

} catch (error) {
  console.error("");
  console.error(
    "EMAIL SEND FAILED"
  );

  console.error(
    error?.message ??
      error
  );

  process.exitCode = 1;
}
