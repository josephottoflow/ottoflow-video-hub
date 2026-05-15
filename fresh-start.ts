/**
 * FRESH START — wipes all local artifacts and resets the Sheet with 5 new topics.
 * Run: npx tsx fresh-start.ts
 */

import * as fs from "fs";
import * as path from "path";
import { SheetsClient } from "./src/agents/sheets/client";

const NEW_TOPICS = [
  {
    topic: "The OODA Loop — how to make faster decisions than your competitors",
    style: "Educational",
  },
  {
    topic: "Jobs to Be Done — the framework that reveals what customers really want",
    style: "Educational",
  },
  {
    topic: "Survivorship bias — why your business role models are lying to you",
    style: "Educational",
  },
  {
    topic: "The 2-pizza rule — why Jeff Bezos limits team sizes",
    style: "Startup-focused",
  },
  {
    topic: "The Dunning-Kruger effect — why you're most dangerous right after you start",
    style: "Educational",
  },
];

function deleteDir(dirPath: string) {
  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved)) {
    console.log(`  skip (not found): ${dirPath}`);
    return;
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  console.log(`  deleted: ${dirPath}`);
}

async function main() {
  console.log("\n── Cleaning local artifacts ──────────────────────");
  deleteDir("outputs");
  deleteDir("temp");
  deleteDir("public/content");

  console.log("\n── Resetting Google Sheet ────────────────────────");
  const sheets = new SheetsClient();
  await sheets.initializeSheet();

  // Clear all data rows (row 2 onwards)
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID!;
  // Access internal sheets API via a second connect to get the raw client
  // We'll use the addContent method which already handles auth
  // Clear by overwriting with blank via a direct sheets call
  // Use the public API: getAllContent to find row count, then clear
  const existing = await sheets.getAllContent();
  console.log(`  Found ${existing.length} existing rows — clearing...`);

  // Mark every row as cleared by re-using updateStatus isn't enough —
  // we need a full clear. Use the sheets API via a workaround:
  // write empty arrays for all rows.
  if (existing.length > 0) {
    const lastRow = existing[existing.length - 1].rowIndex;
    // Use the internal sheets via dynamic import to call values.clear
    const { google, Auth } = await import("googleapis");
    const { OAuth2Client } = await import("google-auth-library");
    const oauthPath = path.resolve(".oauth-token.json");
    const secretPath = path.resolve("client_secret.json");

    let auth: any;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() && process.env.GOOGLE_PRIVATE_KEY?.trim()) {
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key:  process.env.GOOGLE_PRIVATE_KEY,
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    } else if (fs.existsSync(secretPath) && fs.existsSync(oauthPath)) {
      const secret = JSON.parse(fs.readFileSync(secretPath, "utf-8"));
      const { client_id, client_secret, redirect_uris } = secret.installed || secret.web;
      const oauth2Client = new OAuth2Client(client_id, client_secret, redirect_uris?.[0] || "http://localhost:3333");
      const token = JSON.parse(fs.readFileSync(oauthPath, "utf-8"));
      oauth2Client.setCredentials(token);
      auth = oauth2Client;
    } else {
      throw new Error("No Google credentials found in .env or client_secret.json");
    }

    const rawSheets = google.sheets({ version: "v4", auth });
    const meta = await rawSheets.spreadsheets.get({ spreadsheetId });
    const sheetName = meta.data.sheets?.[0]?.properties?.title || "Sheet1";

    await rawSheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A2:T${lastRow}`,
    });
    console.log(`  Cleared rows 2–${lastRow}`);
  }

  console.log("\n── Adding 5 new topics ───────────────────────────");
  for (const t of NEW_TOPICS) {
    const rowIndex = await sheets.addContent({
      topic: t.topic,
      style: t.style,
      voice: "Female energetic",
    });
    console.log(`  Row ${rowIndex}: ${t.topic}`);
  }

  console.log("\n✅ Fresh start complete — 5 topics queued as Pending\n");
}

main().catch((err) => {
  console.error("Fresh start failed:", err);
  process.exit(1);
});
