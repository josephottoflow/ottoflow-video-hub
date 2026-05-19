import "dotenv/config";
import { SheetsClient } from "../src/agents/sheets/client";

async function main() {
  const sheets = new SheetsClient("Sheet2");
  await sheets.initializeSheet();
  const all = await sheets.getAllContent();
  console.log(`Sheet2 rows: ${all.length}`);
  all.forEach(r =>
    console.log(`  Row ${r.rowIndex}: [${r.status}] ${r.topic} | voice: ${r.voice} | style: ${r.style}`)
  );
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
