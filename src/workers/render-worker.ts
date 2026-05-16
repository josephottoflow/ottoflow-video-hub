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
import { Worker, Job } from "bullmq";
import { redisConnection, RENDER_QUEUE, RenderJobData } from "../lib/queue";
import { PipelineOrchestrator }   from "../agents/pipeline/orchestrator";
import { PipelineOrchestratorV2 } from "../agents/pipeline/orchestrator-v2";
import { updateJobStatus, markStuckJobsError } from "../lib/db";
import { ensureBrowser } from "@remotion/renderer";

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "1", 10);

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
  const { rowIndex, template, topic, dbJobId, version } = job.data;

  console.log(`\n[worker] ── Job ${dbJobId} ──`);
  console.log(`[worker] Topic: ${topic} | Template: ${template} | Version: ${version ?? "v1"} | Row: ${rowIndex}`);

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
      : await new PipelineOrchestrator().processSingleByRowIndex(rowIndex, template);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    const durationMs = Date.now() - startTime;
    try {
      await updateJobStatus(dbJobId, "error", { error: message, duration_ms: durationMs });
    } catch (dbErr) {
      console.warn("[worker] Could not write error status to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
    }
    throw new Error(message);
  }

  const durationMs = Date.now() - startTime;

  if (result.success) {
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
    try {
      await updateJobStatus(dbJobId, "error", { error: result.error, duration_ms: durationMs });
    } catch (dbErr) {
      console.warn("[worker] Could not write error status to DB:", dbErr instanceof Error ? dbErr.message : dbErr);
    }
    throw new Error(result.error || "Pipeline failed");
  }
}

async function startup() {
  await checkRedis();

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
    await worker.close();
    await redisConnection.quit();
    process.exit(0);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT",  shutdown);
}

startup();
