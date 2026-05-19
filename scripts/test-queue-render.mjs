import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dir, "../.env") });

import { Queue } from "bullmq";
import IORedis from "ioredis";
import pg from "pg";
import { randomUUID } from "crypto";

const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
  tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: { rejectUnauthorized: false },
});

const queue = new Queue("render", { connection: redis });

const topic    = "Why most startup metrics are completely meaningless";
const style    = "Startup-focused";
const template = "myth-buster";
const variant  = "myth-bust";
const hookStyle = "bold-statement";

console.log(`\nQueuing test render:`);
console.log(`  Topic:   ${topic}`);
console.log(`  Template: ${template}`);
console.log(`  Variant:  ${variant} / ${hookStyle}\n`);

// Insert DB job
const dbId = randomUUID();
await pool.query(
  `INSERT INTO jobs (id, row_index, topic, template, status) VALUES ($1, $2, $3, $4, 'pending')`,
  [dbId, 999, topic, template]
);

// Enqueue in BullMQ
const job = await queue.add("render-video", {
  rowIndex: 999,
  template,
  topic,
  dbJobId: dbId,
  version: "v1",
  renderVariant: variant,
  hookStyle,
}, { jobId: dbId });

console.log(`✓ Job queued — BullMQ id: ${job.id}`);
console.log(`  DB job id: ${dbId}`);
console.log(`\nWatch the worker log for progress...`);

await queue.close();
await redis.quit();
await pool.end();
