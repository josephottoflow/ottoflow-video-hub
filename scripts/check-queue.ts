import "dotenv/config";
import { renderQueue } from "../src/lib/queue";

async function main() {
  const counts = await renderQueue.getJobCounts("waiting", "active", "delayed", "failed", "completed");
  console.log("Queue counts:", JSON.stringify(counts));

  const waiting = await renderQueue.getWaiting(0, 10);
  console.log("Waiting:", waiting.map(j => `${j.id} — ${j.data.topic}`));

  const active = await renderQueue.getActive(0, 5);
  console.log("Active:", active.map(j => `${j.id} — ${j.data.topic}`));

  const failed = await renderQueue.getFailed(0, 3);
  console.log("Failed:", failed.map(j => `${j.id} — ${j.failedReason}`));

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
