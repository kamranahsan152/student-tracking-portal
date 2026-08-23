# React + Node Student Submission System for Render

## What this does

Student portal:
- Roll No input with student list/autocomplete
- Shows only that student's 12-week progress
- Shows Submitted / Missing / Pending
- Missing weeks accept only GitHub repository URL
- Student submission is written to `Submissions`
- Status becomes Pending until admin review

Admin portal:
- `/admin`
- Protected by `ADMIN_KEY`
- Shows pending submissions
- Opens GitHub URL
- Approve / Reject
- Writes action to `Admin Review!G`
- Existing workbook formulas then update Student Tracking, Leaderboard and Dashboard

## Existing workbook is preserved

This backend is designed around the actual workbook structure:
Dashboard, Students, Student Tracking, Leaderboard, Student Portal, Submissions, Admin Review.

Important columns/ranges:
- Students: A4:L73
- Student Tracking: A5:AK74
- Dashboard active weeks: B4
- Submissions: A4:E203
- Admin Review: A5:H204, action in G
- Student Tracking LIVE grid: Z:AK
- Student Tracking statistics: Q:X

## 1. Prepare Google Sheets

1. Upload your existing `Student_Tracking_System_12Weeks(1).xlsx` to Google Drive.
2. Open it with Google Sheets.
3. Verify all sheet names exactly match the names above.
4. Do not delete the existing formulas.
5. Keep the Google Sheet private. Students must never get edit access.
6. Note the Google Sheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`

## 2. Google Cloud service account

1. Create/select a Google Cloud project.
2. Enable Google Sheets API.
3. Create a Service Account.
4. Create a JSON key.
5. Share the Google Sheet with the service-account email as Editor.
6. Do NOT commit the JSON key to GitHub.

For Render, store the whole JSON key as the environment variable `GOOGLE_SERVICE_ACCOUNT_JSON`.

## 3. Run locally

Requirements: Node 20+.

From the project root:
`npm install`
`npm --prefix client install`
`npm --prefix server install`

Build:
`npm run build`

Set environment variables:

GOOGLE_SHEET_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
ADMIN_KEY=a-long-random-secret

Start:
`npm start`

Student:
http://localhost:10000/

Admin:
http://localhost:10000/admin

## 4. Render deployment

Create a new Web Service from this project.

Build Command:
`npm run build`

Start Command:
`npm start`

Environment variables:
- GOOGLE_SHEET_ID
- GOOGLE_SERVICE_ACCOUNT_JSON
- ADMIN_KEY

No database is required; Google Sheets is the data store.

## 5. Important automation

Do not duplicate leaderboard logic in React.

The React/Node app writes only:
- `Submissions!A:D` when a student submits
- `Admin Review!G` when admin approves/rejects

The existing spreadsheet formulas remain responsible for:
- Pending
- Submitted
- Missing
- Student statistics
- Submission percentage
- Rank
- Leaderboard
- Dashboard

This keeps one source of truth.

## 6. Student URL

After Render deployment:
`https://YOUR-RENDER-DOMAIN.onrender.com/`

Admin:
`https://YOUR-RENDER-DOMAIN.onrender.com/admin`

Give students only the student URL.

## 7. Privacy

The current requested Roll No lookup intentionally exposes the list of Roll Nos to the student UI. If student progress must be private, add a PIN or Google login. Roll No alone is not authentication.

## 8. Google Sheets management

Admin should continue managing:
- Students: add/edit student master data
- Student Tracking: enter weekly Submitted/Missing/Pending
- Dashboard: change Active Weeks in B4
- Admin Portal: review student GitHub submissions

Do not manually edit:
- Student Tracking Q:X
- Student Tracking Z:AK
- Leaderboard formulas
- Dashboard formula cells
- Admin Review formula columns

## UI redesign and admin analytics

The portal UI now follows the supplied Liquid Glass design direction: translucent layered surfaces, Apple-inspired typography, restrained red accent, responsive layouts, floating admin navigation, glass tables, progress bars, status badges, mobile layouts and reduced-motion support.

### Student portal
- Roll No lookup with autocomplete suggestions
- Profile + completion overview
- Submitted / Missing / Pending statistics
- Only currently active weeks are displayed
- GitHub submission directly from a Missing week
- Pending review state after submission
- Repository link access after submission/review

### Admin portal
- `/admin` protected by `ADMIN_KEY`
- Overview command center
- Total students, submitted, missing, pending, active weeks and 100% completion metrics
- Submission rate and average completion
- Week-by-week submission health
- Top-student leaderboard
- Recent pending submission queue
- Students with missing work
- Full student directory with search
- Deep analytics with completion bands and per-week rates
- Approve / Reject actions remain connected to the existing Google Sheets workflow

### New analytics endpoint
`GET /api/admin/analytics` with `x-admin-key` returns the live summary, weekly analytics, leaderboard, full student analytics, pending submissions, missing-student list and completion distribution.

The source of truth remains Google Sheets. The React UI does not duplicate or persist spreadsheet data locally.
