/**
 * Seeds one test topic into Sheet2 for V2 pipeline testing.
 * Run: node scripts/seed-sheet2.mjs
 */

import * as fs   from "fs";
import * as path from "path";
import * as http from "http";
import * as url  from "url";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
const envText = fs.readFileSync(path.resolve(__dirname, "../.env"), "utf8");
for (const line of envText.split("\n")) {
  const [k, ...v] = line.split("=");
  if (k && !k.startsWith("#") && v.length) process.env[k.trim()] = v.join("=").trim();
}

const TOKEN_PATH  = path.resolve(__dirname, "../.oauth-token.json");
const SECRET_PATH = path.resolve(__dirname, "../client_secret.json");

if (!fs.existsSync(TOKEN_PATH)) { console.error("No .oauth-token.json — run V1 pipeline first to auth"); process.exit(1); }
if (!fs.existsSync(SECRET_PATH)) { console.error("No client_secret.json"); process.exit(1); }

const { google } = await import("googleapis");

const secret = JSON.parse(fs.readFileSync(SECRET_PATH, "utf8"));
const creds  = secret.web || secret.installed;
const token  = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));

const oauth2 = new google.auth.OAuth2(creds.client_id, creds.client_secret, creds.redirect_uris?.[0] || "http://localhost:3333");
oauth2.setCredentials(token);

const sheets = google.sheets({ version: "v4", auth: oauth2 });
const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

// Ensure Sheet2 exists
const meta = await sheets.spreadsheets.get({ spreadsheetId });
const exists = meta.data.sheets?.some(s => s.properties?.title === "Sheet2");
if (!exists) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title: "Sheet2" } } }] },
  });
  console.log("Created Sheet2 tab");
}

// Check if header exists
const headerRes = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range: "Sheet2!A1:T1",
});

const hasHeader = headerRes.data.values?.[0]?.[0] === "Topic";
if (!hasHeader) {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Sheet2!A1:T1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "Topic", "Script",
        "Hook A", "Hook B", "Hook C",
        "Voice", "Style",
        "Status", "Output Link",
        "TikTok Status", "TikTok Link",
        "YouTube Status", "YouTube Link",
        "Instagram Status", "Instagram Link",
        "Facebook Status", "Facebook Link",
        "Date Scheduled", "Time Scheduled",
        "Performance",
      ]],
    },
  });
  console.log("Added header row");
}

// Add test topic at row 2
await sheets.spreadsheets.values.update({
  spreadsheetId,
  range: "Sheet2!A2:G2",
  valueInputOption: "RAW",
  requestBody: {
    values: [[
      "Why most people waste their morning routine",  // Topic
      "",                                              // Script (will be generated)
      "",                                              // Hook A
      "",                                              // Hook B
      "",                                              // Hook C
      "female energetic",                              // Voice
      "Educational",                                   // Style
    ]],
  },
});

console.log("✅ Added test topic to Sheet2 row 2:");
console.log("   Topic: Why most people waste their morning routine");
console.log("   Voice: female energetic | Style: Educational");
console.log("\nNow run:");
console.log("  POST /api/pipeline/v2 { rowIndex: 2 }");
