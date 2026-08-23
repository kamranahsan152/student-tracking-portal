import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { google } from "googleapis";
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
  studentEnd: 73,

  trackingStart: 5,
  trackingEnd: 74,

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
   GOOGLE SHEET HELPERS
========================================================= */

async function get(range) {
  const response = await getSheets().spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range,
  });

  return response.data.values || [];
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
  const allStudents = await students();

  const student = allStudents.find(
    (item) => norm(item.rollNo) === norm(rollNo),
  );

  if (!student) {
    throw new Error("Roll No not found.");
  }

  const trackingRows = await get(
    `${cfg.tracking}!A${cfg.trackingStart}:AK${cfg.trackingEnd}`,
  );

  const trackingRow = trackingRows.find((row) => norm(row[0]) === norm(rollNo));

  if (!trackingRow) {
    throw new Error("Student tracking row not found.");
  }

  const weeksN = await activeWeeks();

  const allSubmissions = await submissions();

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
   Get student list
*/

app.get("/api/students", async (req, res) => {
  try {
    res.json(await students());
  } catch (error) {
    console.error("GET /api/students:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

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

    if (!/^https:\/\/github\.com\/[^/\\s]+\/[^/\\s]+/i.test(githubUrl)) {
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

    const emptyIndex = submissionRows.findIndex((row) => !row[0]);

    if (emptyIndex < 0) {
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

  const pending = allSubmissions
    .filter(x => !x.action)
    .map(x => ({ ...x, name: byRoll.get(norm(x.rollNo))?.name || "Unknown" }))
    .sort((a,b) => new Date(b.submittedOn || 0) - new Date(a.submittedOn || 0));

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
      studentsWithMissing: studentRows.filter(s => s.missing > 0).length,
      studentsWithPending: studentRows.filter(s => s.pending > 0).length,
    },
    weekly,
    leaderboard: leaderboard.slice(0, 20),
    students: leaderboard,
    pending,
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

    const current = (await get(`${cfg.admin}!G${adminRow}`))[0]?.[0];

    if (String(current || "").trim()) {
      throw new Error("This submission has already been reviewed.");
    }

    /*
        Write Approve / Reject.
      */

    await update(`${cfg.admin}!G${adminRow}`, [[action]]);

    res.json({
      ok: true,
      action,
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
   REACT STATIC FILES
========================================================= */

/*
   React production build:

   project/
   ├── client/
   │   └── dist/
   │       └── index.html
   │
   └── server/
       └── index.js

   __dirname = project/server
   ../client/dist = project/client/dist
*/

const clientPath = path.resolve(__dirname, "../client/dist");

app.use(express.static(clientPath));

/*
   Express 5 compatible SPA fallback.
*/

app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

/* =========================================================
   SERVER
========================================================= */

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

  console.log(`Client build: ${clientPath}`);

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
