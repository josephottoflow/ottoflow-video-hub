// Advanced Pipeline Worker
//
// Lifecycle:
//   1. Register in workers table (upsert)
//   2. Recover stuck pipelines from dead workers
//   3. Start BullMQ worker on "advanced:pipeline" queue
//   4. Heartbeat every 30s → workers.last_seen + pub/sub broadcast
//   5. SIGTERM → drain → mark offline → quit Redis
//
// Separation from basic worker:
//   - Dedicated queue: "advanced:pipeline"
//   - Dedicated Redis connection (advancedRedis)
//   - Dedicated DB table: workers
//   - Does NOT share any state with render-worker.ts

import "dotenv/config";
import * as http from "http";
import * as os   from "os";
import { Worker, Job } from "bullmq";
import { getDb } from "../lib/db";
import { advancedRedis, ADVANCED_QUEUE, getQueueStats } from "../lib/queue/advanced";
import { runPipeline } from "../pipeline/engine";
import { publishWorkerHeartbeat, publishQueueStats } from "../lib/redis/pubsub";
import { ensureBrowser } from "@remotion/renderer";
import type { AdvancedPipelineJob } from "../lib/queue/advanced";

const CONCURRENCY    = parseInt(process.env.WORKER_CONCURRENCY ?? "1", 10);
const GIT_SHA        = process.env.GIT_SHA ?? "dev";
const WORKER_ID      = `${os.hostname()}:${process.pid}`;
const HEARTBEAT_MS   = 30_000;

// ── Worker registration ───────────────────────────────────────────────────────

async function registerWorker(): Promise<void> {
  await getDb().query(
    `INSERT INTO workers (id, status, tier, concurrency, version, hostname, pid)
     VALUES ($1, 'online', 'advanced', $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE
       SET status      = 'online',
           concurrency = EXCLUDED.concurrency,
           version     = EXCLUDED.version,
           last_seen   = now()`,
    [WORKER_ID, CONCURRENCY, GIT_SHA, os.hostname(), process.pid]
  );
  console.log(`[worker] Registered: ${WORKER_ID}`);
}

async function touchHeartbeat(): Promise<void> {
  await getDb().query(
    `UPDATE workers SET last_seen = now() WHERE id = $1`,
    [WORKER_ID]
  );
  const stats = await getQueueStats().catch(() => ({ waiting: 0, active: 0, delayed: 0 }));
  await publishWorkerHeartbeat(WORKER_ID, { concurrency: CONCURRENCY, version: GIT_SHA });
  await publishQueueStats(stats);
}

// ── Dead worker recovery ──────────────────────────────────────────────────────
// If a worker crashes without cleanup, its pipelines are left in 'running' state.
// On startup we find those pipelines and re-queue them.

async function recoverStuckPipelines(): Promise<void> {
  const DEAD_THRESHOLD_S = 120; // worker is considered dead if no heartbeat for 2 minutes

  // Mark workers that stopped sending heartbeats as crashed
  const { rows: deadWorkers } = await getDb().query<{ id: string }>(
    `UPDATE workers
       SET status = 'crashed'
     WHERE status = 'online'
       AND last_seen < now() - ($1 * interval '1 second')
       AND id != $2
     RETURNING id`,
    [DEAD_THRESHOLD_S, WORKER_ID]
  );

  if (deadWorkers.length > 0) {
    console.log(`[worker] Marked ${deadWorkers.length} dead worker(s) as crashed`);
  }

  // Re-queue pipelines owned by crashed workers
  const deadIds = deadWorkers.map((w) => w.id);
  if (deadIds.length > 0) {
    const { rows: stuck } = await getDb().query<{ id: string; config: Record<string, unknown> }>(
      `UPDATE pipelines
         SET status    = 'queued',
             worker_id = NULL,
             locked_at = NULL,
             error     = 'Worker crashed — re-queued for retry'
       WHERE status    = 'running'
         AND worker_id = ANY($1::text[])
       RETURNING id, config`,
      [deadIds]
    );

    for (const p of stuck) {
      const { enqueueAdvancedPipeline } = await import("../lib/queue/advanced");
      await enqueueAdvancedPipeline(p.id, p.config as any).catch((e) =>
        console.warn(`[worker] Re-queue failed for ${p.id}:`, e.message)
      );
    }
    if (stuck.length > 0) {
      console.log(`[worker] Re-queued ${stuck.length} stuck pipeline(s)`);
    }
  }
}

// ── Static server for Remotion Chrome health check ────────────────────────────

function startHealthServer(): void {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const server = http.createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code !== "EADDRINUSE") console.error("[worker] Health server error:", err.message);
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`[worker] Health check → http://0.0.0.0:${port}/health`)
  );
}

// ── Job processor ─────────────────────────────────────────────────────────────

async function processJob(job: Job<AdvancedPipelineJob>): Promise<void> {
  const { pipelineId, config } = job.data;
  console.log(`[worker] Starting pipeline: ${pipelineId}`);

  await runPipeline({ pipelineId, workerId: WORKER_ID, config });

  console.log(`[worker] Pipeline complete: ${pipelineId}`);
}

// ── Startup ───────────────────────────────────────────────────────────────────

async function startup(): Promise<void> {
  startHealthServer();
  await registerWorker();
  await recoverStuckPipelines();

  try {
    await ensureBrowser();
    console.log("[worker] Chrome Headless Shell ready ✓");
  } catch (err) {
    console.warn("[worker] Could not ensure browser:", (err as Error).message);
  }

  // Heartbeat loop
  const heartbeatInterval = setInterval(
    () => touchHeartbeat().catch((e) => console.warn("[worker] Heartbeat failed:", e.message)),
    HEARTBEAT_MS
  );

  // BullMQ worker
  const worker = new Worker<AdvancedPipelineJob>(ADVANCED_QUEUE, processJob, {
    connection:    advancedRedis,
    concurrency:   CONCURRENCY,
    lockDuration:  600_000,     // 10 min lock (pipeline can run up to 20m, renewed below)
    lockRenewTime: 120_000,     // renew every 2 min
  });

  worker.on("completed", (job) => console.log(`[worker] Job done: ${job.id}`));
  worker.on("failed",    (job, err) => console.error(`[worker] Job failed: ${job?.id} — ${err.message}`));
  worker.on("error",     (err) => console.error(`[worker] Worker error:`, err.message));

  console.log(`[worker] Advanced pipeline worker started`);
  console.log(`[worker] ID: ${WORKER_ID} | Queue: ${ADVANCED_QUEUE} | Concurrency: ${CONCURRENCY}`);

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  async function shutdown(signal: string): Promise<void> {
    console.log(`[worker] ${signal} received — draining`);
    clearInterval(heartbeatInterval);

    await getDb()
      .query(`UPDATE workers SET status = 'draining' WHERE id = $1`, [WORKER_ID])
      .catch(() => {});

    await worker.close();

    await getDb()
      .query(`UPDATE workers SET status = 'offline', last_seen = now() WHERE id = $1`, [WORKER_ID])
      .catch(() => {});

    await advancedRedis.quit().catch(() => {});
    console.log("[worker] Shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

startup().catch((err) => {
  console.error("[worker] Fatal startup error:", err);
  process.exit(1);
});
