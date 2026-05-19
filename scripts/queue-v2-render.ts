import "dotenv/config";
import { SheetsClient } from "../src/agents/sheets/client";
import { createJob, upsertContentRow, getLastTemplatesForTopic } from "../src/lib/db";
import { enqueueRender } from "../src/lib/queue";
import type { RenderVariant } from "../src/lib/queue";

const VARIANTS: RenderVariant[]  = ["problem-first", "stat-first", "story-arc", "myth-bust"];
const HOOK_STYLES = ["question", "bold-statement", "conflict", "promise", "shock", "story"] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Sheet2 row to queue (3=Pending, 4=Pending, 5=Pending)
const ROW_INDEX = 3;

async function main() {
  const sheets = new SheetsClient("Sheet2");
  await sheets.initializeSheet();
  const all = await sheets.getAllContent();
  const row = all.find(r => r.rowIndex === ROW_INDEX);
  if (!row) throw new Error(`Row ${ROW_INDEX} not found in Sheet2`);

  const renderVariant = pick(VARIANTS);
  const hookStyle     = pick(HOOK_STYLES);

  console.log(`\nQueuing V2 render:`);
  console.log(`  Topic:   ${row.topic}`);
  console.log(`  Style:   ${row.style}`);
  console.log(`  Voice:   ${row.voice}`);
  console.log(`  Variant: ${renderVariant} / ${hookStyle}`);
  console.log(`  Version: v2 (Veo 3.1 Lite + ElevenLabs)\n`);

  await upsertContentRow({ row_index: ROW_INDEX, topic: row.topic, style: row.style ?? "Educational", voice: row.voice ?? "Female energetic" });
  const job = await createJob(ROW_INDEX, row.topic, "v2-ugc");
  await enqueueRender({
    rowIndex: ROW_INDEX,
    template: "v2-ugc",
    topic:    row.topic,
    dbJobId:  job.id,
    version:  "v2",
    renderVariant,
    hookStyle,
  });
  await sheets.updateStatus(ROW_INDEX, "Queued");

  console.log(`Job queued — id: ${job.id}`);
  console.log(`Watch worker output for progress.`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
