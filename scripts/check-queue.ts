import "dotenv/config";
import { getRenderQueue } from "../src/lib/queue";

async function main() {
  const q      = getRenderQueue();
  const counts = await q.getJobCounts("waiting", "active", "delayed", "failed", "completed");
  console.log("Queue counts:", JSON.stringify(counts));

  const waiting = await q.getWaiting(0, 10);
  console.log("Waiting:", waiting.map((j: any) => `${j.id} — ${j.data.topic}`));

  const active = await q.getActive(0, 5);
  console.log("Active:", active.map((j: any) => `${j.id} — ${j.data.topic}`));

  const failed = await q.getFailed(0, 3);
  console.log("Failed:", failed.map((j: any) => `${j.id} — ${j.failedReason}`));

  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
