import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dir, "../.env") });

import { Queue } from "bullmq";
import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
  tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});

const queue = new Queue("render", { connection: redis });

// Move all active jobs back to waiting by obliterating and re-adding
const active = await queue.getActive(0, 50);
console.log(`Found ${active.length} active job(s)`);

for (const job of active) {
  console.log(`\nJob ${job.id}: ${job.data.topic}`);
  console.log(`  Template: ${job.data.template} | Variant: ${job.data.renderVariant} | Hook: ${job.data.hookStyle}`);

  // Move back to waiting state
  await job.moveToFailed(new Error("Force-retried: stalled from previous worker"), "token", true);
  console.log(`  → Moved to failed (will retry)`);

  // Re-add as fresh job
  const newJob = await queue.add("render-video", job.data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  });
  console.log(`  → Re-queued as job ${newJob.id}`);
}

await queue.close();
await redis.quit();
console.log("\nDone. Start the worker to process.");
