/**
 * CLI: Test Google Sheets OAuth2 authentication.
 * Run once to log in and save the token.
 * Usage: npx tsx src/cli/auth-google.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { SheetsClient } from "../agents/sheets/client";

async function main() {
  console.log("🔐 Testing Google Sheets authentication...\n");

  const sheets = new SheetsClient();

  try {
    await sheets.initializeSheet();
    console.log("✅ Google Sheets connected successfully!");
    console.log(`📊 Spreadsheet ID: ${process.env.GOOGLE_SPREADSHEET_ID}`);

    const rows = await sheets.getAllContent();
    console.log(`📋 Found ${rows.length} row(s) in the sheet.`);

    if (rows.length > 0) {
      console.log("\nFirst row:");
      console.log(`  Topic:  ${rows[0].topic || "(empty)"}`);
      console.log(`  Status: ${rows[0].status}`);
      console.log(`  Style:  ${rows[0].style || "(empty)"}`);
    }
  } catch (err) {
    console.error("❌ Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
