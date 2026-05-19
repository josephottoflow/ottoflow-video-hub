/**
 * RENDER WORKER — BullMQ job processor
 *
 * Start with: npm run worker
 *
 * Pulls render jobs from Redis/BullMQ queue, runs the full pipeline
 * via PipelineOrchestrator, and writes results back to PostgreSQL.
 *
 * Concurrency: WORKER_CONCURRENCY env var (default: 2)
 * Lock duration: 10 minutes (renders can take up to 8 min)
 */

import "dotenv/config";
import * as http from "http";
import * as fs   from "fs";
import * as path from "path";
import { Worker, Job } from "bullmq";
import { redisConnection, RENDER_QUEUE, RenderJobData } from "../lib/queue";
import { PipelineOrchestrator }   from "../agents/pipeline/orchestrator";
import { PipelineOrchestratorV2 } from "../agents/pipeline/orchestrator-v2";
import { updateJobStatus, markStuckJobsError, getJob, touchWorkerHeartbeat } from "../lib/db";
import { ensureBrowser } from "@remotion/renderer";
import { emitLog, inferAgent, inferLevel, setStatus, clearLogs } from "../lib/pipeline-store";

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "1", 10);

// Serve public/ on localhost:3000 so Remotion Chrome can fetch background files.
// Falls back silently if Next.js dev server already holds the port.
function startStaticServer() {
  const publicDir = path.resolve("public");
  const port      = parseInt(process.env.PORT || "3000", 10);
  const MIME: Record<string, string> = {
    ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".webp": "image/webp", ".json": "application/json",
  };

  const server = http.createServer((req, res) => {
    const relPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const filePath = path.join(publicDir, relPath);
    if (!filePath.startsWith(publicDir)) { res.writeHead(403); res.end(); return; }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404); res.end("Not found"); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.log(`[worker] Port ${port} in use — Next.js is already serving public/ ✓`);
    } else {
      console.error("[worker] Static server error:", err.message);
    }
  });

  server.listen(port, "127.0.0.1", () =>
    console.log(`[worker] Static file server → http://localhost:${port}/ (serves public/)`)
  );
}

async function checkRedis(): Promise<void> {
  try {
    await redisConnection.ping();
    console.log("[worker] Redis connected ✓");
  } catch (err) {
    console.error("[worker] Cannot reach Redis:", err instanceof Error ? err.message : err);
    console.error("[worker] Check REDIS_URL in .env and ensure Upstash is reachable.");
    process.exit(1);
  }
}

async function processJob(job: Job<RenderJobData>): Promise<void> {
  const { rowIndex, template, topic, dbJobId, version, renderVariant, hookStyle } = job.data;

  console.log(`\n[worker] ── Job ${dbJobId} ──`);
  console.log(`[worker] Topic: ${topic} | Template: ${template} | Version: ${version ?? "v1"} | Variant: ${renderVariant ?? "default"} | Row: ${rowIndex}`);

  // Check if this job was killed via the UI before we start any work
  try {
    const dbJob = await getJob(dbJobId);
    if (dbJob?.status === "error") {
      console.log(`[worker] Job ${dbJobId} was killed — skipping`);
      return;
    }
  } catch { /* db blip — proceed */ }

  clearLogs();

  try {
    await updateJobStatus(dbJobId, "processing", { bull_job_id: job.id });
  } catch (err) {
    console.warn("[worker] Could not update job status to processing:", err instanceof Error ? err.message : err);
  }

  const startTime = Date.now();
  let result;
  try {
    result = version === "v2"
      ? await new PipelineOrchestratorV2().processSingleByRowIndex(rowIndex)
      : await new PipelineOrchestrator().processSingleByRowIndex(rowIndex, template, renderVariant as any, hookStyle as any);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    const durationMs = Date.now() - startTime;
    setStatus("error");
    try {
      await updateJobStatus(dbJobId, "error", { error: message, duration_ms: durationMs });
    } catch (dbErr) {
      console.warn("[worker] Could not write error status to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
    }
    throw new Error(message);
  }

  const durationMs = Date.now() - startTime;

  if (result.success) {
    setStatus("done");
    try {
      await updateJobStatus(dbJobId, "done", {
        output_path: result.outputDir,
        output_link: result.outputLink,
        duration_ms: durationMs,
      });
    } catch (dbErr) {
      console.warn("[worker] Could not write done status to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
    }
    console.log(`[worker] Done: ${topic} → ${result.outputLink} (${Math.round(durationMs / 1000)}s)`);
  } else {
    setStatus("error");
    try {
      await updateJobStatus(dbJobId, "error", { error: result.error, duration_ms: durationMs });
    } catch (dbErr) {
      console.warn("[worker] Could not write error status to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
    }
    throw new Error(result.error || "Pipeline failed");
  }
}

async function startup() {
  startStaticServer();
  await checkRedis();

  // Forward console.log + console.error to Redis so Vercel SSE shows live progress
  const _origLog   = console.log.bind(console);
  const _origError = console.error.bind(console);
  console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    _origLog(msg);
    emitLog(inferAgent(msg), msg, inferLevel(msg));
  };
  console.error = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    _origError(msg);
    emitLog(inferAgent(msg), `ERROR: ${msg}`, "error");
  };

  // Ensure Chrome Headless Shell is available (downloads if missing, fast if cached)
  try {
    await ensureBrowser();
    console.log("[worker] Chrome Headless Shell ready ✓");
  } catch (err) {
    console.warn("[worker] Could not ensure browser:", err instanceof Error ? err.message : err);
  }

  // Clear any jobs that were left in "processing" from a previous crash
  try {
    const cleaned = await markStuckJobsError(15 * 60 * 1000);
    if (cleaned > 0) console.log(`[worker] Marked ${cleaned} stuck job(s) as error on startup`);
  } catch (err) {
    console.warn("[worker] Could not clean stuck jobs (DB may be unreachable):", err instanceof Error ? err.message : err);
  }

  // Write a heartbeat to Postgres every 30s so /api/worker-status can detect us reliably.
  // BullMQ's own heartbeat expires during long renders; this one doesn't.
  await touchWorkerHeartbeat();
  const heartbeatInterval = setInterval(touchWorkerHeartbeat, 30_000);

  const worker = new Worker<RenderJobData>(RENDER_QUEUE, processJob, {
    connection:    redisConnection,
    concurrency:   CONCURRENCY,
    lockDuration:  600_000,
    lockRenewTime: 120_000,
  });

  worker.on("completed", (job) => {
    console.log(`[worker] Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] Failed: ${job?.id} — ${err.message}`);
  });

  worker.on("error", (err) => {
    console.error(`[worker] Error:`, err.message);
  });

  console.log(`[worker] Render worker started`);
  console.log(`[worker] Queue: ${RENDER_QUEUE} | Concurrency: ${CONCURRENCY}`);
  console.log(`[worker] Waiting for jobs...\n`);

  async function shutdown() {
    console.log("[worker] Shutting down gracefully...");
    clearInterval(heartbeatInterval);
    await worker.close();
    await redisConnection.quit();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT",  shutdown);
}

startup();
