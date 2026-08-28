import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { google } from "googleapis";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMPORTANT:
// Your .env is inside /server, not the project root.
dotenv.config({
  path: path.join(__dirname, ".env"),
});

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

app.use(cors());

app.use(
  express.json({
    limit: "20kb",
  }),
);

/* =========================================================
   CONFIG
========================================================= */

const cfg = {
  students: "Students",
  tracking: "Student Tracking",
  dashboard: "Dashboard",
  submissions: "Submissions",
  admin: "Admin Review",

  studentStart: 4,
  studentEnd: 153,

  trackingStart: 5,
  trackingEnd: 154,

  submissionStart: 4,
  submissionEnd: 203,

  adminStart: 5,
};

let sheets = null;

/* =========================================================
   ENVIRONMENT
========================================================= */

function validateEnvironment() {
  const missing = [];

  if (!process.env.GOOGLE_SHEET_ID) {
    missing.push("GOOGLE_SHEET_ID");
  }

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    missing.push("GOOGLE_SERVICE_ACCOUNT_JSON");
  }

  if (!process.env.ADMIN_KEY) {
    missing.push("ADMIN_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing environment variable(s): ${missing.join(", ")}. ` +
        `Make sure they are configured in server/.env`,
    );
  }
}

/* =========================================================
   GOOGLE SHEETS
========================================================= */

function getSheets() {
  if (sheets) {
    return sheets;
  }

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not configured. " + "Check server/.env",
    );
  }

  let creds;

  try {
    creds = JSON.parse(raw);
  } catch (error) {
    console.error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON.");
    console.error(error.message);

    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is invalid JSON. " +
        "Make sure the complete service-account JSON is stored on one line in server/.env.",
    );
  }

  if (!creds.client_email) {
    throw new Error("Google service account JSON is missing client_email.");
  }

  if (!creds.private_key) {
    throw new Error("Google service account JSON is missing private_key.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheets = google.sheets({
    version: "v4",
    auth,
  });

  return sheets;
}

function getSpreadsheetId() {
  if (!process.env.GOOGLE_SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID is not configured. Check server/.env");
  }

  return process.env.GOOGLE_SHEET_ID.trim();
}

/* =========================================================
   EMAIL
========================================================= */

let mailer = null;

function getMailer() {
  if (mailer) {
    return mailer;
  }

  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return null;
  }

  mailer = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  return mailer;
}

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );
}

function reviewEmailHtml({ name, rollNo, week, approved, reapproved }) {
  const statusColor = approved ? "#1d8c49" : "#b42318";
  const statusBg = approved ? "rgba(48,209,88,.12)" : "rgba(255,59,48,.1)";
  const statusLabel = reapproved ? "Approved after review" : approved ? "Approved" : "Rejected";
  const headerGradient = approved
    ? "linear-gradient(135deg,#30d158,#1d8c49)"
    : "linear-gradient(135deg,#ff453a,#b42318)";
  const headline = reapproved
    ? "Your rejected submission is now approved"
    : approved
      ? "Your submission has been approved"
      : "Your submission has been rejected";
  const message = reapproved
    ? "This week was rejected earlier, but your admin has reviewed it again and <b>approved</b> it. No resubmission is needed — the week is now marked <b>Submitted</b> in your tracker."
    : approved
      ? "Great work — this week is now marked <b>Submitted</b> in your tracker."
      : "This week has been returned to <b>Missing</b>. Please review the feedback from your admin and resubmit when ready.";

  return `
<div style="background:#f5f5f7;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#111113">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 60px rgba(0,0,0,.08)">
    <div style="background:${headerGradient};padding:28px 32px;color:#ffffff">
      <div style="font-size:12px;font-weight:800;letter-spacing:.13em;opacity:.85;text-transform:uppercase">Student Portal</div>
      <div style="font-size:22px;font-weight:800;margin-top:6px;letter-spacing:-.02em">${headline}</div>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 18px;font-size:14px;color:#6b6b73">Hi <b style="color:#111113">${escapeHtml(name)}</b>,</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#111113">${message}</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f5f5f7;border-radius:16px;overflow:hidden">
        <tr>
          <td style="padding:14px 18px;color:#6b6b73;border-bottom:1px solid rgba(0,0,0,.06)">Roll No</td>
          <td style="padding:14px 18px;text-align:right;font-weight:700;border-bottom:1px solid rgba(0,0,0,.06)">${escapeHtml(rollNo)}</td>
        </tr>
        <tr>
          <td style="padding:14px 18px;color:#6b6b73;border-bottom:1px solid rgba(0,0,0,.06)">Name</td>
          <td style="padding:14px 18px;text-align:right;font-weight:700;border-bottom:1px solid rgba(0,0,0,.06)">${escapeHtml(name)}</td>
        </tr>
        <tr>
          <td style="padding:14px 18px;color:#6b6b73;border-bottom:1px solid rgba(0,0,0,.06)">Week</td>
          <td style="padding:14px 18px;text-align:right;font-weight:700;border-bottom:1px solid rgba(0,0,0,.06)">Week ${week}</td>
        </tr>
        <tr>
          <td style="padding:14px 18px;color:#6b6b73">Status</td>
          <td style="padding:14px 18px;text-align:right">
            <span style="display:inline-block;padding:5px 12px;border-radius:999px;font-weight:800;font-size:11px;color:${statusColor};background:${statusBg}">${statusLabel}</span>
          </td>
        </tr>
      </table>
      <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#6b6b73">Log in to the Student Portal anytime to view your full 12-week progress.</p>
      <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#111113">Regards,<br/><b>Kamran Ahsan</b></p>
    </div>
  </div>
</div>`;
}

async function sendReviewEmail({ to, name, rollNo, week, action, reapproved }) {
  const transport = getMailer();

  if (!transport || !to) {
    return;
  }

  const approved = action === "Approve";
  const subject = reapproved
    ? `Week ${week} submission approved after re-review`
    : approved
      ? `Week ${week} submission approved`
      : `Week ${week} submission rejected`;

  const text = reapproved
    ? `Hi ${name},\n\nYour Week ${week} submission (Roll No ${rollNo}) was rejected earlier, but your admin has reviewed it again and approved it. You do not need to resubmit — the week is now marked Submitted.\n\nRegards,\nKamran Ahsan`
    : approved
      ? `Hi ${name},\n\nYour Week ${week} submission (Roll No ${rollNo}) has been approved and is now marked Submitted.\n\nRegards,\nKamran Ahsan`
      : `Hi ${name},\n\nYour Week ${week} submission (Roll No ${rollNo}) has been rejected and the week is now marked Missing. Please review and resubmit.\n\nRegards,\nKamran Ahsan`;

  try {
    await transport.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text,
      html: reviewEmailHtml({ name, rollNo, week, approved, reapproved }),
    });
  } catch (error) {
    console.error("sendReviewEmail:", error.message);
  }
}

/* =========================================================
   GOOGLE SHEET HELPERS
========================================================= */

async function get(range) {
  const response = await getSheets().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range,
  });

  return response.data.values || [];
}

/*
    Fetches several independent ranges in one HTTP round-trip
    instead of one request per range (Sheets API round-trips
    are the slow part, not the read itself).
*/

async function batchGet(ranges) {
  const response = await getSheets().spreadsheets.values.batchGet({
    spreadsheetId: getSpreadsheetId(),
    ranges,
  });

  return response.data.valueRanges.map((vr) => vr.values || []);
}

async function update(range, values) {
  return getSheets().spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
}

async function append(range, values) {
  return getSheets().spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values,
    },
  });
}

let sheetIdsCache = null;

/*
    Sheet tab names -> numeric sheetId (gid),
    needed for batchUpdate row-copy requests.
*/

async function getSheetId(title) {
  if (!sheetIdsCache) {
    const meta = await getSheets().spreadsheets.get({
      spreadsheetId: getSpreadsheetId(),
      fields: "sheets.properties",
    });

    sheetIdsCache = Object.fromEntries(
      meta.data.sheets.map((sheet) => [
        sheet.properties.title,
        sheet.properties.sheetId,
      ]),
    );
  }

  return sheetIdsCache[title];
}

/*
    Copy an existing row's formatting + formulas onto a new
    row (relative references shift automatically), so a newly
    added student gets the same live stats columns, styles,
    and colors as everyone else instead of a blank/broken row.
*/

async function copyRowFormatting(sheetTitle, sourceRow, destRow) {
  const sheetId = await getSheetId(sheetTitle);

  const range = (row) => ({
    sheetId,
    startRowIndex: row - 1,
    endRowIndex: row,
  });

  await getSheets().spreadsheets.batchUpdate({
    spreadsheetId: getSpreadsheetId(),
    requestBody: {
      requests: [
        {
          copyPaste: {
            source: range(sourceRow),
            destination: range(destRow),
            pasteType: "PASTE_NORMAL",
          },
        },
      ],
    },
  });
}

/* =========================================================
   UTILITIES
========================================================= */

const norm = (value) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

/* =========================================================
   STUDENTS
========================================================= */

async function students() {
  const rows = await get(
    `${cfg.students}!A${cfg.studentStart}:L${cfg.studentEnd}`,
  );

  return rows
    .filter((row) => row[0])
    .map((row) => ({
      rollNo: String(row[0]).trim(),
      name: row[1] || "",
      semester: row[2] || "",
      email: row[3] || "",
      githubProfile: row[4] || "",
    }));
}

/* =========================================================
   ACTIVE WEEKS
========================================================= */

async function activeWeeks() {
  const rows = await get(`${cfg.dashboard}!B4`);

  const value = Number(rows[0]?.[0]);

  if (!Number.isFinite(value) || value <= 0) {
    return 12;
  }

  return Math.min(12, Math.floor(value));
}

/* =========================================================
   SUBMISSIONS
========================================================= */

async function submissions() {
  const rows = await get(
    `${cfg.submissions}!A${cfg.submissionStart}:E${cfg.submissionEnd}`,
  );

  if (!rows.length) {
    return [];
  }

  const adminEnd = cfg.adminStart + rows.length - 1;

  const actions = await get(`${cfg.admin}!G${cfg.adminStart}:G${adminEnd}`);

  return rows
    .map((row, index) => {
      if (!row[0]) {
        return null;
      }

      return {
        row: cfg.submissionStart + index,

        rollNo: String(row[0]).trim(),

        week: Number(row[1]),

        url: row[2] || "",

        submittedOn: row[3] || "",

        action: String(actions[index]?.[0] || "").trim(),
      };
    })
    .filter(Boolean);
}

/* =========================================================
   STUDENT PROGRESS
========================================================= */

async function getStudent(rollNo) {
  /*
      Students, Student Tracking, Dashboard (active weeks) and
      Submissions don't depend on each other, so they're fetched
      in one Sheets API round-trip instead of four sequential
      ones — each round-trip is the slow part, not the read.
  */

  const [studentRows, trackingRows, dashboardRows, submissionRows] =
    await batchGet([
      `${cfg.students}!A${cfg.studentStart}:L${cfg.studentEnd}`,
      `${cfg.tracking}!A${cfg.trackingStart}:AK${cfg.trackingEnd}`,
      `${cfg.dashboard}!B4`,
      `${cfg.submissions}!A${cfg.submissionStart}:E${cfg.submissionEnd}`,
    ]);

  const allStudents = studentRows
    .filter((row) => row[0])
    .map((row) => ({
      rollNo: String(row[0]).trim(),
      name: row[1] || "",
      semester: row[2] || "",
      email: row[3] || "",
      githubProfile: row[4] || "",
    }));

  const student = allStudents.find(
    (item) => norm(item.rollNo) === norm(rollNo),
  );

  if (!student) {
    throw new Error("Roll No not found.");
  }

  const trackingRow = trackingRows.find((row) => norm(row[0]) === norm(rollNo));

  if (!trackingRow) {
    throw new Error("Student tracking row not found.");
  }

  const activeWeeksValue = Number(dashboardRows[0]?.[0]);
  const weeksN =
    Number.isFinite(activeWeeksValue) && activeWeeksValue > 0
      ? Math.min(12, Math.floor(activeWeeksValue))
      : 12;

  const allSubmissions = submissionRows.length
    ? await (async () => {
        const adminEnd = cfg.adminStart + submissionRows.length - 1;
        const actions = await get(`${cfg.admin}!G${cfg.adminStart}:G${adminEnd}`);

        return submissionRows
          .map((row, index) => {
            if (!row[0]) {
              return null;
            }

            return {
              row: cfg.submissionStart + index,
              rollNo: String(row[0]).trim(),
              week: Number(row[1]),
              url: row[2] || "",
              submittedOn: row[3] || "",
              action: String(actions[index]?.[0] || "").trim(),
            };
          })
          .filter(Boolean);
      })()
    : [];

  const studentSubmissions = allSubmissions.filter(
    (item) => norm(item.rollNo) === norm(rollNo),
  );

  const weeks = [];

  for (let week = 1; week <= weeksN; week++) {
    /*
      Student Tracking LIVE columns:

      Z  = Week 1
      AA = Week 2
      AB = Week 3
      ...
      AK = Week 12

      Array index:
      Z = 25
    */

    let status = String(trackingRow[25 + week - 1] || "").trim();

    if (!status) {
      status = "Missing";
    }

    const weekSubmissions = studentSubmissions.filter(
      (item) => item.week === week,
    );

    const approved = weekSubmissions.some(
      (item) => norm(item.action) === "APPROVE",
    );

    const pending = weekSubmissions.some((item) => !item.action);

    const rejected = weekSubmissions.some(
      (item) => norm(item.action) === "REJECT",
    );

    if (approved) {
      status = "Submitted";
    } else if (pending && status !== "Submitted") {
      status = "Pending";
    } else if (rejected && status !== "Submitted") {
      status = "Missing";
    }

    /*
      Prefer the pending submission URL.
      Otherwise show the latest rejected submission.
    */

    const submission =
      weekSubmissions.find((item) => !item.action) ||
      [...weekSubmissions]
        .reverse()
        .find((item) => norm(item.action) === "REJECT");

    weeks.push({
      week,
      status,
      githubUrl: submission?.url || "",
    });
  }

  const submitted = weeks.filter(
    (item) => norm(item.status) === "SUBMITTED",
  ).length;

  const missing = weeks.filter(
    (item) => norm(item.status) === "MISSING",
  ).length;

  const pending = weeks.filter(
    (item) => norm(item.status) === "PENDING",
  ).length;

  return {
    ...student,

    activeWeeks: weeksN,

    submitted,

    missing,

    pending,

    submissionPercent: weeksN > 0 ? submitted / weeksN : 0,

    weeks,
  };
}

/* =========================================================
   ADMIN AUTH
========================================================= */

function adminAuth(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    return res.status(500).json({
      error: "ADMIN_KEY is not configured.",
    });
  }

  const suppliedKey = req.get("x-admin-key");

  if (!suppliedKey || suppliedKey !== adminKey) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  next();
}

/* =========================================================
   API
========================================================= */

/*
   Get student progress
*/

app.get("/api/student/:roll", async (req, res) => {
  try {
    const result = await getStudent(req.params.roll);

    res.json(result);
  } catch (error) {
    console.error("GET /api/student:", error);

    res.status(404).json({
      error: error.message,
    });
  }
});

/*
   Student adds their personal email (once).
   Only writes the Email cell — cannot touch name/semester/github,
   and refuses to overwrite an email that's already set.
*/

app.post("/api/student/:roll/email", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address.");
    }

    if (/@uog\.edu\.pk$/i.test(email)) {
      throw new Error(
        "Please add your personal email, not your university email.",
      );
    }

    const existing = await students();

    const index = existing.findIndex(
      (student) => norm(student.rollNo) === norm(req.params.roll),
    );

    if (index < 0) {
      throw new Error("Roll No not found.");
    }

    if (existing[index].email) {
      throw new Error("Email is already set for this student.");
    }

    const studentRow = cfg.studentStart + index;

    await update(`${cfg.students}!D${studentRow}`, [[email]]);

    res.json({ ok: true, email });
  } catch (error) {
    console.error("POST /api/student/:roll/email:", error);

    res.status(400).json({
      error: error.message,
    });
  }
});

/*
   Student submits GitHub repository
*/

app.post("/api/submissions", async (req, res) => {
  try {
    const { rollNo, week, url } = req.body || {};

    if (!rollNo) {
      throw new Error("Roll No is required.");
    }

    const weekNumber = Number(week);

    if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 12) {
      throw new Error("Invalid week.");
    }

    const githubUrl = String(url || "").trim();

    if (!/^https:\/\/github\.com\/[^/\s]+\/[^/\s]+/i.test(githubUrl)) {
      throw new Error("Enter a valid GitHub repository URL.");
    }

    const currentStudent = await getStudent(rollNo);

    const targetWeek = currentStudent.weeks.find(
      (item) => item.week === weekNumber,
    );

    if (!targetWeek) {
      throw new Error("This week is not active.");
    }

    /*
        Student is allowed to submit only
        when current status is Missing.
      */

    if (norm(targetWeek.status) !== "MISSING") {
      throw new Error(`Week ${weekNumber} is currently ${targetWeek.status}.`);
    }

    const existingSubmissions = await submissions();

    /*
        Prevent duplicate pending submissions.
      */

    const alreadyPending = existingSubmissions.some(
      (item) =>
        norm(item.rollNo) === norm(rollNo) &&
        item.week === weekNumber &&
        !item.action,
    );

    if (alreadyPending) {
      throw new Error("This week already has a Pending submission.");
    }

    /*
        Find first empty row.
      */

    const submissionRows = await get(
      `${cfg.submissions}!A${cfg.submissionStart}:A${cfg.submissionEnd}`,
    );

    /*
        The Sheets API omits trailing rows that have
        no content, so a short array also means the
        rows after it are empty and available.
      */

    let emptyIndex = submissionRows.findIndex((row) => !row[0]);

    if (emptyIndex < 0) {
      emptyIndex = submissionRows.length;
    }

    if (cfg.submissionStart + emptyIndex > cfg.submissionEnd) {
      throw new Error("Submission table is full.");
    }

    const sheetRow = cfg.submissionStart + emptyIndex;

    await update(`${cfg.submissions}!A${sheetRow}:D${sheetRow}`, [
      [String(rollNo).trim(), weekNumber, githubUrl, new Date().toISOString()],
    ]);

    /*
        Return fresh student data.
      */

    const updated = await getStudent(rollNo);

    res.json(updated);
  } catch (error) {
    console.error("POST /api/submissions:", error);

    res.status(400).json({
      error: error.message,
    });
  }
});

/* =========================================================
   ADMIN - PENDING
========================================================= */

app.get("/api/admin/pending", adminAuth, async (req, res) => {
  try {
    const allStudents = await students();

    const studentMap = Object.fromEntries(
      allStudents.map((student) => [norm(student.rollNo), student.name]),
    );

    const pending = (await submissions())
      .filter((submission) => !submission.action)
      .map((submission) => ({
        ...submission,

        name: studentMap[norm(submission.rollNo)] || "Unknown",
      }));

    res.json(pending);
  } catch (error) {
    console.error("GET /api/admin/pending:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

/* =========================================================
   ADMIN - ADD STUDENT
========================================================= */

app.post("/api/admin/students", adminAuth, async (req, res) => {
  try {
    const { rollNo, name, semester, email, githubProfile } = req.body || {};

    const cleanRoll = String(rollNo || "").trim();
    const cleanName = String(name || "").trim();

    if (!cleanRoll) {
      throw new Error("Roll No is required.");
    }

    if (!cleanName) {
      throw new Error("Student name is required.");
    }

    const existing = await students();

    if (existing.some((student) => norm(student.rollNo) === norm(cleanRoll))) {
      throw new Error(`Roll No ${cleanRoll} already exists.`);
    }

    /*
        Students and Student Tracking must always add a
        student at the same relative position, or the two
        sheets drift out of alignment and every cross-sheet
        formula between them breaks. Derive both target rows
        from the same count (existing students already
        fetched above) instead of scanning each sheet for its
        own first empty row independently.
      */

    const nextIndex = existing.length;

    const studentRow = cfg.studentStart + nextIndex;
    const trackingRow = cfg.trackingStart + nextIndex;

    if (studentRow > cfg.studentEnd) {
      throw new Error("Students sheet is full.");
    }

    if (trackingRow > cfg.trackingEnd) {
      throw new Error("Student Tracking sheet is full.");
    }

    /*
        Copy the row above's formatting + formulas onto the
        new row first (skipped for the very first data row,
        which has nothing above it to copy).
      */

    if (studentRow > cfg.studentStart) {
      await copyRowFormatting(cfg.students, studentRow - 1, studentRow);
    }

    if (trackingRow > cfg.trackingStart) {
      await copyRowFormatting(cfg.tracking, trackingRow - 1, trackingRow);
    }

    await update(`${cfg.students}!A${studentRow}:E${studentRow}`, [
      [
        cleanRoll,
        cleanName,
        String(semester || "").trim(),
        String(email || "").trim(),
        String(githubProfile || "").trim(),
      ],
    ]);

    await update(`${cfg.tracking}!A${trackingRow}:C${trackingRow}`, [
      [cleanRoll, cleanName, String(semester || "").trim()],
    ]);

    res.json({ ok: true, rollNo: cleanRoll });
  } catch (error) {
    console.error("POST /api/admin/students:", error);

    res.status(400).json({
      error: error.message,
    });
  }
});

/* =========================================================
   ADMIN - EDIT STUDENT
========================================================= */

app.patch("/api/admin/students/:roll", adminAuth, async (req, res) => {
  try {
    const { name, semester, email, githubProfile } = req.body || {};

    const cleanName = String(name || "").trim();

    if (!cleanName) {
      throw new Error("Student name is required.");
    }

    const existing = await students();

    const index = existing.findIndex(
      (student) => norm(student.rollNo) === norm(req.params.roll),
    );

    if (index < 0) {
      throw new Error("Roll No not found.");
    }

    const cleanRoll = existing[index].rollNo;
    const cleanSemester = String(semester || "").trim();

    const studentRow = cfg.studentStart + index;
    const trackingRow = cfg.trackingStart + index;

    await update(`${cfg.students}!A${studentRow}:E${studentRow}`, [
      [
        cleanRoll,
        cleanName,
        cleanSemester,
        String(email || "").trim(),
        String(githubProfile || "").trim(),
      ],
    ]);

    await update(`${cfg.tracking}!B${trackingRow}:C${trackingRow}`, [
      [cleanName, cleanSemester],
    ]);

    res.json({ ok: true, rollNo: cleanRoll });
  } catch (error) {
    console.error("PATCH /api/admin/students:", error);

    res.status(400).json({
      error: error.message,
    });
  }
});

/* =========================================================
   ADMIN - DELETE STUDENT
========================================================= */

app.delete("/api/admin/students/:roll", adminAuth, async (req, res) => {
  try {
    const existing = await students();

    const index = existing.findIndex(
      (student) => norm(student.rollNo) === norm(req.params.roll),
    );

    if (index < 0) {
      throw new Error("Roll No not found.");
    }

    /*
        Students and Student Tracking must stay at the same
        relative position (see ADMIN - ADD STUDENT), so both
        rows are deleted as real sheet rows (not just cleared)
        so everything below shifts up together in both sheets.
      */

    const studentRow = cfg.studentStart + index;
    const trackingRow = cfg.trackingStart + index;

    const [studentsSheetId, trackingSheetId] = await Promise.all([
      getSheetId(cfg.students),
      getSheetId(cfg.tracking),
    ]);

    await getSheets().spreadsheets.batchUpdate({
      spreadsheetId: getSpreadsheetId(),
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: studentsSheetId,
                dimension: "ROWS",
                startIndex: studentRow - 1,
                endIndex: studentRow,
              },
            },
          },
          {
            deleteDimension: {
              range: {
                sheetId: trackingSheetId,
                dimension: "ROWS",
                startIndex: trackingRow - 1,
                endIndex: trackingRow,
              },
            },
          },
        ],
      },
    });

    /*
        Submissions rows aren't positionally tied to the student
        row (any student can land in any free row), so deleted
        students' submissions are found by roll no and cleared —
        their Admin Review mirror rows go blank automatically.
      */

    const deletedRoll = existing[index].rollNo;

    const submissionRows = await get(
      `${cfg.submissions}!A${cfg.submissionStart}:A${cfg.submissionEnd}`,
    );

    const matches = [];
    submissionRows.forEach((row, i) => {
      if (norm(row[0]) === norm(deletedRoll)) {
        matches.push(cfg.submissionStart + i);
      }
    });

    if (matches.length) {
      const submissionsSheetId = await getSheetId(cfg.submissions);
      const adminSheetId = await getSheetId(cfg.admin);

      const requests = [];
      for (const sheetRow of matches) {
        const adminRow = cfg.adminStart + (sheetRow - cfg.submissionStart);

        requests.push({
          updateCells: {
            range: {
              sheetId: submissionsSheetId,
              startRowIndex: sheetRow - 1,
              endRowIndex: sheetRow,
              startColumnIndex: 0,
              endColumnIndex: 4,
            },
            fields: "userEnteredValue",
          },
        });

        requests.push({
          updateCells: {
            range: {
              sheetId: adminSheetId,
              startRowIndex: adminRow - 1,
              endRowIndex: adminRow,
              startColumnIndex: 6,
              endColumnIndex: 7,
            },
            fields: "userEnteredValue",
          },
        });
      }

      await getSheets().spreadsheets.batchUpdate({
        spreadsheetId: getSpreadsheetId(),
        requestBody: { requests },
      });
    }

    res.json({ ok: true, rollNo: deletedRoll, clearedSubmissions: matches.length });
  } catch (error) {
    console.error("DELETE /api/admin/students:", error);

    res.status(400).json({
      error: error.message,
    });
  }
});

/* =========================================================
   ADMIN - ANALYTICS
========================================================= */

async function getAdminAnalytics() {
  const [allStudents, trackingRows, allSubmissions, weeksN] = await Promise.all([
    students(),
    get(`${cfg.tracking}!A${cfg.trackingStart}:AK${cfg.trackingEnd}`),
    submissions(),
    activeWeeks(),
  ]);

  const byRoll = new Map(allStudents.map(student => [norm(student.rollNo), student]));
  const pendingByStudentWeek = new Map();
  const approvedByStudentWeek = new Set();

  for (const submission of allSubmissions) {
    const key = `${norm(submission.rollNo)}:${submission.week}`;
    if (norm(submission.action) === "APPROVE") approvedByStudentWeek.add(key);
    if (!submission.action) pendingByStudentWeek.set(key, submission);
  }

  const studentRows = [];
  for (const student of allStudents) {
    const trackingRow = trackingRows.find(row => norm(row[0]) === norm(student.rollNo));
    const weeks = [];
    for (let week = 1; week <= weeksN; week++) {
      const key = `${norm(student.rollNo)}:${week}`;
      let status = String(trackingRow?.[25 + week - 1] || "").trim();
      if (!status) status = "Missing";
      if (approvedByStudentWeek.has(key)) status = "Submitted";
      else if (pendingByStudentWeek.has(key)) status = "Pending";
      else if (norm(status) === "APPROVE") status = "Submitted";
      else if (norm(status) !== "MISSING" && norm(status) !== "PENDING" && norm(status) !== "SUBMITTED") status = "Missing";
      weeks.push(status);
    }
    const submitted = weeks.filter(x => norm(x) === "SUBMITTED").length;
    const missing = weeks.filter(x => norm(x) === "MISSING").length;
    const pending = weeks.filter(x => norm(x) === "PENDING").length;
    studentRows.push({
      rollNo: student.rollNo,
      name: student.name,
      semester: student.semester,
      email: student.email,
      githubProfile: student.githubProfile,
      submitted,
      missing,
      pending,
      activeWeeks: weeksN,
      rate: weeksN ? submitted / weeksN : 0,
      weeks,
    });
  }

  const weekly = Array.from({length: weeksN}, (_, index) => {
    const week = index + 1;
    const submitted = studentRows.filter(s => norm(s.weeks[index]) === "SUBMITTED").length;
    const missing = studentRows.filter(s => norm(s.weeks[index]) === "MISSING").length;
    const pending = studentRows.filter(s => norm(s.weeks[index]) === "PENDING").length;
    return { week, total: allStudents.length, submitted, missing, pending, rate: allStudents.length ? submitted / allStudents.length : 0 };
  });

  const leaderboard = [...studentRows]
    .sort((a,b) => b.rate - a.rate || b.submitted - a.submitted || a.name.localeCompare(b.name))
    .map((s, index) => ({ ...s, rank: index + 1 }));

  const distribution = [
    { label: "100% complete", count: studentRows.filter(s => s.rate >= 1).length },
    { label: "75–99%", count: studentRows.filter(s => s.rate >= .75 && s.rate < 1).length },
    { label: "50–74%", count: studentRows.filter(s => s.rate >= .50 && s.rate < .75).length },
    { label: "25–49%", count: studentRows.filter(s => s.rate >= .25 && s.rate < .50).length },
    { label: "Below 25%", count: studentRows.filter(s => s.rate < .25).length },
  ];

  const withName = list => list
    .map(x => ({ ...x, name: byRoll.get(norm(x.rollNo))?.name || "Unknown" }))
    .sort((a,b) => new Date(b.submittedOn || 0) - new Date(a.submittedOn || 0));

  const pending = withName(allSubmissions.filter(x => !x.action));

  /*
      Every rejected row is listed so an admin can re-approve it.
      `resolved` marks the ones whose student/week was already
      approved on another row — still shown, just not actionable.
  */
  const rejected = withName(allSubmissions.filter(x => norm(x.action) === "REJECT"))
    .map(x => ({
      ...x,
      resolved: approvedByStudentWeek.has(`${norm(x.rollNo)}:${x.week}`),
    }));

  const totalSlots = allStudents.length * weeksN;
  const submitted = studentRows.reduce((n,s) => n + s.submitted, 0);
  const missing = studentRows.reduce((n,s) => n + s.missing, 0);
  const pendingCount = studentRows.reduce((n,s) => n + s.pending, 0);
  const averageRate = studentRows.length ? studentRows.reduce((n,s) => n + s.rate, 0) / studentRows.length : 0;

  return {
    summary: {
      students: allStudents.length,
      activeWeeks: weeksN,
      submitted,
      missing,
      pending: pendingCount,
      totalSlots,
      submissionRate: totalSlots ? submitted / totalSlots : 0,
      averageRate,
      studentsAt100: studentRows.filter(s => s.rate >= 1).length,
      rejected: rejected.filter(x => !x.resolved).length,
      studentsWithMissing: studentRows.filter(s => s.missing > 0).length,
      studentsWithPending: studentRows.filter(s => s.pending > 0).length,
    },
    weekly,
    leaderboard: leaderboard.slice(0, 20),
    students: leaderboard,
    pending,
    rejected,
    missingStudents: [...studentRows].filter(s => s.missing > 0).sort((a,b) => b.missing - a.missing || a.name.localeCompare(b.name)),
    distribution,
  };
}

app.get("/api/admin/analytics", adminAuth, async (req, res) => {
  try {
    res.json(await getAdminAnalytics());
  } catch (error) {
    console.error("GET /api/admin/analytics:", error);
    res.status(500).json({ error: error.message });
  }
});

/* =========================================================
   ADMIN - SUMMARY
========================================================= */

app.get("/api/admin/summary", adminAuth, async (req, res) => {
  try {
    const analytics = await getAdminAnalytics();
    res.json(analytics.summary);
  } catch (error) {
    console.error("GET /api/admin/summary:", error);
    res.status(500).json({ error: error.message });
  }
});

/* =========================================================
   ADMIN - APPROVE / REJECT
========================================================= */

app.post("/api/admin/review", adminAuth, async (req, res) => {
  try {
    const { row, action } = req.body || {};

    const sheetRow = Number(row);

    if (
      !Number.isInteger(sheetRow) ||
      sheetRow < cfg.submissionStart ||
      sheetRow > cfg.submissionEnd
    ) {
      throw new Error("Invalid submission row.");
    }

    if (!["Approve", "Reject"].includes(action)) {
      throw new Error("Action must be Approve or Reject.");
    }

    /*
        Find corresponding Admin Review row.
        Submission row 4 -> Admin row 5
        Submission row 5 -> Admin row 6
        etc.
      */

    const adminRow = cfg.adminStart + (sheetRow - cfg.submissionStart);

    const current = String((await get(`${cfg.admin}!G${adminRow}`))[0]?.[0] || "").trim();

    /*
        A rejected submission can be re-approved (admin changed
        their mind / student fixed the repo in place). Anything
        else that already carries a decision stays locked.
      */

    const reapproved = norm(current) === "REJECT" && action === "Approve";

    if (current && !reapproved) {
      throw new Error("This submission has already been reviewed.");
    }

    /*
        Write Approve / Reject.
      */

    await update(`${cfg.admin}!G${adminRow}`, [[action]]);

    /*
        Mirror the decision into Student Tracking's manual
        Week columns (D:O), so the "source of truth" grid
        matches the live columns without the admin having to
        retype it. D = Week 1 ... O = Week 12.
      */

    const [rollNo, weekRaw] = (
      await get(`${cfg.submissions}!A${sheetRow}:B${sheetRow}`)
    )[0] || [];

    const week = Number(weekRaw);

    if (rollNo && Number.isInteger(week) && week >= 1 && week <= 12) {
      const trackingRows = await get(
        `${cfg.tracking}!A${cfg.trackingStart}:A${cfg.trackingEnd}`,
      );

      const trackingIndex = trackingRows.findIndex(
        (row) => norm(row[0]) === norm(rollNo),
      );

      if (trackingIndex !== -1) {
        const trackingRow = cfg.trackingStart + trackingIndex;
        const weekCol = String.fromCharCode("D".charCodeAt(0) + week - 1);

        await update(`${cfg.tracking}!${weekCol}${trackingRow}`, [
          [action === "Approve" ? "Submitted" : "Missing"],
        ]);
      }

      const allStudents = await students();
      const student = allStudents.find(
        (item) => norm(item.rollNo) === norm(rollNo),
      );

      if (student?.email) {
        await sendReviewEmail({
          to: student.email,
          name: student.name,
          rollNo: student.rollNo,
          week,
          action,
          reapproved,
        });
      }
    }

    res.json({
      ok: true,
      action,
      reapproved,
      row: sheetRow,
      adminRow,
    });
  } catch (error) {
    console.error("POST /api/admin/review:", error);

    res.status(400).json({
      error: error.message,
    });
  }
});

/* =========================================================
   REACT STATIC FILES (local / non-Vercel only)

   On Vercel the client build is served as static output
   directly (see vercel.json) and this API runs as a
   serverless function, so Express never needs to serve
   the built files itself there.
========================================================= */

if (!process.env.VERCEL) {
  const clientPath = path.resolve(__dirname, "../client/dist");

  app.use(express.static(clientPath));

  /*
     Express 5 compatible SPA fallback.
  */

  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientPath, "index.html"));
  });
}

/* =========================================================
   SERVER (local / non-Vercel only)

   On Vercel, the exported app is invoked per-request by
   the Node runtime instead of listening on a port.
========================================================= */

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 10000;

  try {
    validateEnvironment();

    /*
      Initialize Google Sheets once
      during server startup so configuration
      problems are detected immediately.
    */

    getSheets();

    console.log("");
    console.log("========================================");
    console.log("Student Tracking Portal");
    console.log("========================================");

    console.log("GOOGLE_SHEET_ID: OK");

    console.log("GOOGLE_SERVICE_ACCOUNT_JSON: OK");

    console.log("ADMIN_KEY: OK");

    console.log(
      `Google Service Account: ${
        JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON).client_email
      }`,
    );

    console.log(`Google Sheet ID: ${getSpreadsheetId()}`);

    console.log("========================================");
    console.log("");
  } catch (error) {
    console.error("");
    console.error("========================================");
    console.error("STARTUP CONFIGURATION ERROR");
    console.error("========================================");
    console.error(error.message);
    console.error("");
    console.error("Check server/.env and Google Sheets permissions.");
    console.error("");

    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`Portal running on http://localhost:${port}`);
  });
}

export default app;
