// Advanced Pipeline Worker
//
// Lifecycle:
//   1. Register in workers table (upsert)
//   2. Recover stuck pipelines from dead workers
//   3. Start BullMQ worker on "advanced-pipeline" queue
//   4. Heartbeat every 30s → workers.last_seen + pub/sub broadcast
//   5. SIGTERM → drain → mark offline → quit Redis
//
// Separation from basic worker:
//   - Dedicated queue: "advanced-pipeline"
//   - Dedicated Redis connection (advancedRedis)
//   - Dedicated DB table: workers
//   - Does NOT share any state with render-worker.ts

import "dotenv/config";
import * as http from "http";
import * as os   from "os";
import { Worker, Job } from "bullmq";
import { getDb, runAdvancedMigrations } from "../lib/db";
import { getAdvancedRedis, ADVANCED_QUEUE } from "../lib/queue/advanced";
import { requireEnv } from "../lib/env";
import { runPipeline } from "../pipeline/engine";
import { publishWorkerHeartbeat, publishQueueStats } from "../lib/redis/pubsub";
import { ensureBrowser } from "@remotion/renderer";
import type { AdvancedPipelineJob } from "../lib/queue/advanced";

const CONCURRENCY    = parseInt(process.env.WORKER_CONCURRENCY ?? "1", 10);
const GIT_SHA        = process.env.GIT_SHA ?? "dev";
const WORKER_ID      = `${os.hostname()}:${process.pid}`;
const HEARTBEAT_MS   = 180_000; // 3 min — was 30s; reduces idle Redis traffic by 83%

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
  const mem  = process.memoryUsage();
  const rss  = Math.round(mem.rss       / 1024 / 1024);
  const heap = Math.round(mem.heapUsed  / 1024 / 1024);

  await getDb().query(
    `UPDATE workers SET last_seen = now(), memory_rss_mb = $2, memory_heap_mb = $3 WHERE id = $1`,
    [WORKER_ID, rss, heap]
  );

  // Derive queue stats from DB — one extended query replaces 3 Redis ZCARD calls (OPT-2).
  // `delayed` is always 0: the advanced pipeline does not use BullMQ delayed jobs.
  let stats = { waiting: 0, active: 0, delayed: 0 };
  try {
    const db = getDb();
    const { rows: [counts] } = await db.query<{
      waiting:   string;
      active:    string;
      done_24h:  string;
      failed_24h: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'queued')                                            AS waiting,
         COUNT(*) FILTER (WHERE status = 'running')                                           AS active,
         COUNT(*) FILTER (WHERE status = 'done'   AND completed_at > NOW() - INTERVAL '24 hours') AS done_24h,
         COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') AS failed_24h
       FROM pipelines`
    );
    stats = {
      waiting: parseInt(counts?.waiting   ?? "0", 10),
      active:  parseInt(counts?.active    ?? "0", 10),
      delayed: 0,
    };
    await db.query(
      `INSERT INTO queue_snapshots (waiting, active, delayed, done_24h, failed_24h)
       VALUES ($1, $2, $3, $4, $5)`,
      [stats.waiting, stats.active, 0,
       parseInt(counts?.done_24h   ?? "0", 10),
       parseInt(counts?.failed_24h ?? "0", 10)]
    );
    // Prune snapshots older than 7 days
    await db.query(`DELETE FROM queue_snapshots WHERE captured_at < NOW() - INTERVAL '7 days'`);
  } catch { /* non-fatal — stats fall back to zero */ }

  await publishWorkerHeartbeat(WORKER_ID, { concurrency: CONCURRENCY, version: GIT_SHA, memRssMb: rss, memHeapMb: heap });
  await publishQueueStats(stats);

  // Alert if memory crosses 1 GB
  if (rss > 1024) {
    console.warn(`[worker] HIGH MEMORY WARNING: RSS=${rss}MB — consider restart`);
  }
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
  requireEnv();   // exits with clear error if DATABASE_URL / REDIS_URL are missing
  startHealthServer();
  await runAdvancedMigrations().catch((e) =>
    console.warn("[worker] Advanced migrations skipped:", e.message)
  );
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
  const advancedRedis = getAdvancedRedis();
  const worker = new Worker<AdvancedPipelineJob>(ADVANCED_QUEUE, processJob, {
    connection:    advancedRedis,
    concurrency:   CONCURRENCY,
    lockDuration:  600_000,     // 10 min lock (pipeline can run up to 20m, renewed below)
    lockRenewTime: 120_000,     // renew every 2 min
  });

  worker.on("completed", (job) => {
    const pipelineId = job.id ?? job.data.pipelineId;
    console.log(`[worker] Job done: ${pipelineId}`);

    // Stage timing summary — logged at completion for validation + ops visibility
    getDb()
      .query<{ stage_name: string; status: string; duration_ms: number | null }>(
        `SELECT stage_name, status, duration_ms
           FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY started_at NULLS LAST`,
        [pipelineId]
      )
      .then(({ rows }) => {
        const total = rows.reduce((s, r) => s + (r.duration_ms ?? 0), 0);
        console.log(`[worker] Stage summary ${pipelineId} (${total}ms total):`);
        for (const r of rows) {
          const icon = r.status === "done" ? "✓" : r.status === "skipped" ? "–" : "✗";
          const dur  = r.duration_ms != null ? `${r.duration_ms}ms` : "—";
          console.log(`[worker]   ${icon} ${r.stage_name.padEnd(28)} ${dur}`);
        }
      })
      .catch(() => {});

    getDb()
      .query(`UPDATE workers SET renders_this_session = renders_this_session + 1 WHERE id = $1`, [WORKER_ID])
      .catch(() => {});
  });
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
