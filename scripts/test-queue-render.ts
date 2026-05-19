import "dotenv/config";
import { SheetsClient } from "../src/agents/sheets/client";
import { RenderAgent } from "../src/agents/render/render-agent";
import { createJob, upsertContentRow, getLastTemplatesForTopic } from "../src/lib/db";
import { enqueueRender } from "../src/lib/queue";
import type { RenderVariant } from "../src/lib/queue";

const TOPIC   = "Why most startup metrics are completely meaningless";
const STYLE   = "Startup-focused";
const VOICE   = "Female energetic";
const VARIANT: RenderVariant = "myth-bust";
const HOOK    = "bold-statement";

async function main() {
  console.log(`\nQueuing test render:`);
  console.log(`  Topic:   ${TOPIC}`);
  console.log(`  Style:   ${STYLE}`);
  console.log(`  Variant: ${VARIANT} / ${HOOK}\n`);

  const sheets = new SheetsClient();
  await sheets.initializeSheet();

  const rowIndex = await sheets.addContent({ topic: TOPIC, style: STYLE, voice: VOICE });
  console.log(`✓ Added to Sheet1 → row ${rowIndex}`);

  const recentTemplates = await getLastTemplatesForTopic(TOPIC);
  const template = await RenderAgent.selectTemplate(TOPIC, STYLE, recentTemplates);
  console.log(`✓ Template selected: ${template} (recent: ${recentTemplates.join(", ") || "none"})`);

  await upsertContentRow({ row_index: rowIndex, topic: TOPIC, style: STYLE, voice: VOICE });
  const job = await createJob(rowIndex, TOPIC, template);
  await enqueueRender({ rowIndex, template, topic: TOPIC, dbJobId: job.id, renderVariant: VARIANT, hookStyle: HOOK });
  await sheets.updateStatus(rowIndex, "Queued");

  console.log(`✓ Queued — job id: ${job.id}`);
  console.log(`\nWorker will pick this up. Watch worker.log for progress.`);
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
