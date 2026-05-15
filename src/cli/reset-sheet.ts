/**
 * CLI: Reset all Error rows back to Pending and clear Performance column.
 * Usage: npx tsx src/cli/reset-sheet.ts
 *
 * On first run: opens browser for Google OAuth — authenticate once.
 * Subsequent runs use cached token (.oauth-token.json).
 */

import * as dotenv from "dotenv";
dotenv.config();

import { SheetsClient } from "../agents/sheets/client";

async function main() {
  console.log("🔄 Connecting to Google Sheets...\n");

  const sheets = new SheetsClient();
  await sheets.initializeSheet();

  const rows = await sheets.getAllContent();
  console.log(`📋 Found ${rows.length} row(s) in the sheet.\n`);

  const toReset = rows.filter((r) => r.status === "Error" || r.status === "Processing" || r.status === "Rendering");
  console.log(`🔧 Resetting ${toReset.length} row(s) to Pending...\n`);

  for (const row of toReset) {
    await sheets.updateStatus(row.rowIndex, "Pending");
    await sheets.clearPerformance(row.rowIndex);
    console.log(`  ✅ Row ${row.rowIndex}: "${row.topic.slice(0, 50)}" → Pending`);
  }

  console.log(`\n✅ Done — ${toReset.length} row(s) reset to Pending.`);
  console.log("Run 'npm run pipeline' to process them.\n");
}

main().catch((err) => {
  console.error("❌ Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
