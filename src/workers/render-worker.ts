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
import { updateJobStatus } from "../lib/db";

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "1", 10);

async function processJob(job: Job<RenderJobData>): Promise<void> {
  const { rowIndex, template, topic, dbJobId, version } = job.data;

  console.log(`\n[worker] ── Job ${dbJobId} ──`);
  console.log(`[worker] Topic: ${topic} | Template: ${template} | Version: ${version ?? "v1"} | Row: ${rowIndex}`);

  await updateJobStatus(dbJobId, "processing", { bull_job_id: job.id });

  const startTime = Date.now();
  const result    = version === "v2"
    ? await new PipelineOrchestratorV2().processSingleByRowIndex(rowIndex)
    : await new PipelineOrchestrator().processSingleByRowIndex(rowIndex, template);
  const durationMs = Date.now() - startTime;

  if (result.success) {
    await updateJobStatus(dbJobId, "done", {
      output_path: result.outputDir,
      output_link: result.outputLink,
      duration_ms: durationMs,
    });
    console.log(`[worker] Done: ${topic} → ${result.outputLink} (${Math.round(durationMs / 1000)}s)`);
  } else {
    await updateJobStatus(dbJobId, "error", {
      error:       result.error,
      duration_ms: durationMs,
    });
    // Re-throwing causes BullMQ to mark the job failed and handle retries
    throw new Error(result.error || "Pipeline failed");
  }
}

const worker = new Worker<RenderJobData>(RENDER_QUEUE, processJob, {
  connection:    redisConnection,
  concurrency:   CONCURRENCY,
  lockDuration:  600_000,   // 10 min — renders can be slow
  lockRenewTime: 120_000,   // renew every 2 min
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
