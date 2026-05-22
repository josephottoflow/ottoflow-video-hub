// Pipeline Engine — core state machine
//
// Responsibilities:
//   - Atomically claims ownership of a pipeline from the worker
//   - Loads existing stage statuses from DB (enables resume after crash)
//   - Executes stages in order, skipping already-done ones
//   - Emits events to Redis pub/sub + DB on every transition
//   - Persists artifacts and progress after each stage
//   - Handles per-stage retry, timeout, and cancellation
//   - Cleans up workDir on completion

import * as fs   from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getDb } from "../lib/db";
import { STAGE_REGISTRY, getStagesForTier } from "./registry";
import { buildContext } from "./context";
import { emitEvent } from "./events";
import { createPipelineAbortController } from "./abort-controller";
import { executeWithRetry } from "./retry-policy";
import { recordStageMetric } from "./metrics";
import type { PipelineConfig, StageStatus } from "./types";

const PIPELINE_HARD_TIMEOUT_MS = 20 * 60 * 1_000;   // 20 minutes absolute ceiling
const WORK_DIR_BASE            = process.env.PIPELINE_WORK_DIR ?? "/tmp/pipelines";

export interface RunPipelineInput {
  pipelineId: string;
  workerId:   string;
  config:     PipelineConfig;
}

export async function runPipeline({ pipelineId, workerId, config }: RunPipelineInput): Promise<void> {
  const db      = getDb();
  const traceId = crypto.randomUUID();

  // ── Claim ownership (atomic — prevents two workers from running same pipeline) ──
  const claimed = await db.query(
    `UPDATE pipelines
       SET status     = 'running',
           worker_id  = $1,
           locked_at  = now(),
           trace_id   = $2,
           started_at = COALESCE(started_at, now())
     WHERE id = $3
       AND status IN ('queued','pending')
       AND (worker_id IS NULL OR worker_id = $1)`,
    [workerId, traceId, pipelineId]
  );
  if (!claimed.rowCount) {
    throw new Error(`Pipeline ${pipelineId} already claimed or in terminal state`);
  }

  // ── Load pipeline row ────────────────────────────────────────────────────────
  const { rows: [row] } = await db.query<{
    topic: string; style: string; render_variant: string | null;
    hook_style: string | null; music_vibe: string | null; template: string | null;
    tier: string; artifacts: Record<string, string>;
  }>(
    `SELECT topic, style, render_variant, hook_style, music_vibe, template, tier, artifacts
       FROM pipelines WHERE id = $1`,
    [pipelineId]
  );
  if (!row) throw new Error(`Pipeline ${pipelineId} not found after claim`);

  // ── Create workdir ───────────────────────────────────────────────────────────
  const workDir = path.join(WORK_DIR_BASE, pipelineId);
  fs.mkdirSync(workDir, { recursive: true });

  // ── Hard-timeout abort controller ────────────────────────────────────────────
  const { controller: hardAbort, cleanup: cleanupHard } = createPipelineAbortController(PIPELINE_HARD_TIMEOUT_MS);

  // ── Rehydrate artifacts from DB ──────────────────────────────────────────────
  const artifacts: Record<string, string> = { ...(row.artifacts ?? {}) };

  // ── Build execution context ──────────────────────────────────────────────────
  const ctx = buildContext({
    pipelineId,
    traceId,
    workerId,
    topic:         row.topic,
    style:         row.style,
    renderVariant: (row.render_variant as any) ?? "story-arc",
    hookStyle:     (row.hook_style     as any) ?? "question",
    musicVibe:     row.music_vibe  ?? undefined,
    template:      row.template    ?? undefined,
    tier:          (row.tier       as any) ?? "advanced",
    workDir,
    artifacts,
    config,
    signal:        hardAbort.signal,
  });

  await emitEvent({ type: "pipeline_started", pipelineId, workerId, ts: new Date().toISOString() });

  // ── Load existing stage statuses (resume support) ─────────────────────────────
  const { rows: existingStages } = await db.query<{
    stage_name: string; status: StageStatus; artifacts: Record<string, string>;
  }>(
    `SELECT stage_name, status, artifacts FROM pipeline_stages WHERE pipeline_id = $1`,
    [pipelineId]
  );
  const stageDone = new Map(existingStages.map((s) => [s.stage_name, s.status === "done" || s.status === "skipped"]));

  // Merge persisted artifacts back into context so resumed stages have their inputs
  for (const s of existingStages) {
    Object.assign(ctx.artifacts, s.artifacts ?? {});
  }

  // ── Stage execution loop ──────────────────────────────────────────────────────
  const stages    = getStagesForTier(ctx.tier);
  let completed   = 0;
  let failed      = false;
  let failedError = "Unknown pipeline error";

  for (const stageName of stages) {
    if (hardAbort.signal.aborted) {
      failed      = true;
      failedError = "Pipeline hard timeout (20m) exceeded";
      break;
    }

    const def = STAGE_REGISTRY[stageName];
    if (!def) {
      ctx.log(`[${stageName}] not in registry — skipping`);
      continue;
    }

    // Resume: already done in a previous run
    if (stageDone.get(stageName)) {
      completed++;
      ctx.log(`[${stageName}] already done — resuming past it`);
      continue;
    }

    // Config-based skip (e.g. skipLipsync=true)
    if (shouldSkipStage(stageName, config)) {
      await upsertStageStatus(pipelineId, stageName, "skipped");
      await emitEvent({ type: "stage_skipped", pipelineId, stageName, ts: new Date().toISOString() });
      completed++;
      continue;
    }

    // Mark current stage in pipelines table (UI can show "rendering..." etc.)
    await db.query(`UPDATE pipelines SET current_stage = $1 WHERE id = $2`, [stageName, pipelineId]);
    await upsertStageStatus(pipelineId, stageName, "running");
    await emitEvent({ type: "stage_started", pipelineId, stageName, workerId, ts: new Date().toISOString() });

    const result = await executeWithRetry({
      stageName,
      def,
      ctx,
      pipelineId,
      onRetry: async (attempt, err) => {
        await emitEvent({ type: "stage_retry", pipelineId, stageName, metadata: { attempt }, error: err.message, ts: new Date().toISOString() });
      },
    });

    if (result.success) {
      // Merge stage artifacts into context
      if (result.artifacts) Object.assign(ctx.artifacts, result.artifacts);

      await persistStageSuccess(pipelineId, stageName, result.artifacts ?? {}, result.durationMs, result.attempts);
      await persistArtifacts(pipelineId, ctx.artifacts);
      recordStageMetric(pipelineId, stageName, result.durationMs, true, ctx.tier);

      completed++;
      const progress = Math.round((completed / stages.length) * 100);
      await db.query(`UPDATE pipelines SET progress_pct = $1 WHERE id = $2`, [progress, pipelineId]);
      await emitEvent({ type: "stage_done", pipelineId, stageName, progress, artifacts: result.artifacts, ts: new Date().toISOString() });
      await emitEvent({ type: "progress",   pipelineId, progress, ts: new Date().toISOString() });
    } else {
      await persistStageFailure(pipelineId, stageName, result.error!, result.durationMs, result.attempts);
      recordStageMetric(pipelineId, stageName, result.durationMs, false, ctx.tier);
      await emitEvent({ type: "stage_failed", pipelineId, stageName, error: result.error, ts: new Date().toISOString() });

      if (def.critical) {
        failed      = true;
        failedError = `[${stageName}] ${result.error}`;
        break;
      }
      // Non-critical: log and continue
      ctx.log(`[${stageName}] non-critical failure — continuing: ${result.error}`);
      completed++;
    }
  }

  cleanupHard();

  // ── Compute duration ─────────────────────────────────────────────────────────
  const durationMs = await getPipelineDurationMs(pipelineId);

  // ── Finalize pipeline ────────────────────────────────────────────────────────
  if (failed || hardAbort.signal.aborted) {
    const err = hardAbort.signal.aborted ? "Pipeline hard timeout (20m) exceeded" : failedError;
    await db.query(
      `UPDATE pipelines
         SET status       = 'failed',
             error        = $1,
             completed_at = now(),
             duration_ms  = $2,
             worker_id    = NULL,
             locked_at    = NULL,
             current_stage = NULL
       WHERE id = $3`,
      [err, durationMs, pipelineId]
    );
    await emitEvent({ type: "pipeline_failed", pipelineId, error: err, workerId, ts: new Date().toISOString() });
  } else {
    await db.query(
      `UPDATE pipelines
         SET status        = 'done',
             progress_pct  = 100,
             output_link   = $1,
             completed_at  = now(),
             duration_ms   = $2,
             worker_id     = NULL,
             locked_at     = NULL,
             current_stage = NULL
       WHERE id = $3`,
      [ctx.artifacts["output_link"] ?? null, durationMs, pipelineId]
    );
    await emitEvent({ type: "pipeline_done", pipelineId, artifacts: ctx.artifacts, workerId, ts: new Date().toISOString() });
  }

  // ── Cleanup workdir ───────────────────────────────────────────────────────────
  try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* non-fatal */ }
}

// ── DB helpers ────────────────────────────────────────────────────────────────

function shouldSkipStage(stageName: string, config: PipelineConfig): boolean {
  if (stageName === "lipsync"       && config.skipLipsync)   return true;
  if (stageName === "upscale"       && config.skipUpscale)   return true;
  if (stageName === "analytics"     && config.skipAnalytics) return true;
  if (stageName === "publish-queue" && config.skipPublish)   return true;
  return false;
}

async function upsertStageStatus(
  pipelineId: string,
  stageName:  string,
  status:     StageStatus
): Promise<void> {
  await getDb().query(
    `INSERT INTO pipeline_stages (pipeline_id, stage_name, status, started_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (pipeline_id, stage_name) DO UPDATE
       SET status     = EXCLUDED.status,
           started_at = CASE WHEN EXCLUDED.status = 'running' THEN now() ELSE pipeline_stages.started_at END,
           attempt    = CASE WHEN EXCLUDED.status = 'running' THEN pipeline_stages.attempt + 1 ELSE pipeline_stages.attempt END`,
    [pipelineId, stageName, status]
  );
}

async function persistStageSuccess(
  pipelineId: string,
  stageName:  string,
  artifacts:  Record<string, string>,
  durationMs: number,
  attempts:   number
): Promise<void> {
  await getDb().query(
    `UPDATE pipeline_stages
       SET status       = 'done',
           artifacts    = $1,
           completed_at = now(),
           duration_ms  = $2,
           attempt      = $3
     WHERE pipeline_id = $4 AND stage_name = $5`,
    [JSON.stringify(artifacts), durationMs, attempts, pipelineId, stageName]
  );
  await getDb().query(
    `UPDATE pipelines
       SET stages_done = array_append(stages_done, $1)
     WHERE id = $2 AND NOT ($1 = ANY(stages_done))`,
    [stageName, pipelineId]
  );
}

async function persistStageFailure(
  pipelineId: string,
  stageName:  string,
  error:      string,
  durationMs: number,
  attempts:   number
): Promise<void> {
  await getDb().query(
    `UPDATE pipeline_stages
       SET status       = 'failed',
           error        = $1,
           completed_at = now(),
           duration_ms  = $2,
           attempt      = $3
     WHERE pipeline_id = $4 AND stage_name = $5`,
    [error, durationMs, attempts, pipelineId, stageName]
  );
}

async function persistArtifacts(
  pipelineId: string,
  artifacts:  Record<string, string>
): Promise<void> {
  await getDb().query(
    `UPDATE pipelines SET artifacts = $1 WHERE id = $2`,
    [JSON.stringify(artifacts), pipelineId]
  );
}

async function getPipelineDurationMs(pipelineId: string): Promise<number> {
  try {
    const { rows: [r] } = await getDb().query<{ started_at: Date | null }>(
      `SELECT started_at FROM pipelines WHERE id = $1`,
      [pipelineId]
    );
    if (!r?.started_at) return 0;
    return Date.now() - r.started_at.getTime();
  } catch {
    return 0;
  }
}
