/**
 * One-off script: clear all data from Sheet2 and rename the tab to "Video Gen".
 * Run: npx tsx scripts/rename-sheet2-to-video-gen.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const OLD_NAME       = "Sheet2";
const NEW_NAME       = "Video Gen";

async function main() {
  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN!;

  const oauth2Client = new OAuth2Client(clientId, clientSecret, "http://localhost:3333");
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  // 1. Get spreadsheet metadata to find the Sheet2 sheetId
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === OLD_NAME);

  if (!sheet) {
    // Check if "Video Gen" already exists
    const already = meta.data.sheets?.find(s => s.properties?.title === NEW_NAME);
    if (already) {
      console.log(`Tab "${NEW_NAME}" already exists — just clearing data…`);
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: `${NEW_NAME}!A2:U1000`,
      });
      console.log(`✅ Cleared all data rows from "${NEW_NAME}"`);
    } else {
      console.error(`Tab "${OLD_NAME}" not found in spreadsheet.`);
      process.exit(1);
    }
    return;
  }

  const sheetId = sheet.properties!.sheetId!;

  // 2. Clear all data rows (keep header row 1)
  console.log(`Clearing data from "${OLD_NAME}"…`);
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${OLD_NAME}!A2:U1000`,
  });
  console.log(`  ✓ Data cleared`);

  // 3. Rename the tab
  console.log(`Renaming "${OLD_NAME}" → "${NEW_NAME}"…`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        updateSheetProperties: {
          properties: { sheetId, title: NEW_NAME },
          fields: "title",
        },
      }],
    },
  });
  console.log(`  ✓ Tab renamed`);
  console.log(`\n✅ Done — tab is now "${NEW_NAME}" with no data rows.`);
}

main().catch(err => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
