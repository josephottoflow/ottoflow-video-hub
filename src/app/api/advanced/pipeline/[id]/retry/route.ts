// POST /api/advanced/pipeline/:id/retry — replay a pipeline from a given stage
//
// Body: { fromStage?: string }   default: first stage
//
// Steps:
//   1. Validate pipeline is in a terminal state (failed / cancelled / dead / timed_out)
//   2. Load the original config from pipelines.config JSONB
//   3. Determine which stages come at/after fromStage in the ordered registry
//   4. Reset those pipeline_stages rows to 'pending'
//   5. Reset pipeline status → 'queued', increment retry_count
//   6. Re-enqueue the BullMQ job (same pipelineId = idempotent)

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../../lib/db";
import { enqueueAdvancedPipeline } from "../../../../../../lib/queue/advanced";
import { emitEvent } from "../../../../../../pipeline/events";
import { ALL_STAGES } from "../../../../../../pipeline/registry";
import type { PipelineConfig } from "../../../../../../pipeline/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "Missing pipeline id" }, { status: 400 });

  let fromStage: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    fromStage = body.fromStage ? String(body.fromStage) : null;
  } catch { /* empty body is fine */ }

  const db = getDb();

  const { rows: [pipeline] } = await db.query<{
    status: string;
    config: PipelineConfig;
    tier: string;
    retry_count: number;
  }>(
    `SELECT status, config, tier, retry_count FROM pipelines WHERE id = $1`,
    [id]
  );

  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }

  const RETRYABLE = ["failed", "cancelled", "timed_out", "dead"];
  if (!RETRYABLE.includes(pipeline.status)) {
    return NextResponse.json(
      { error: `Cannot retry pipeline with status: ${pipeline.status}` },
      { status: 409 }
    );
  }

  // Determine the stage slice to reset
  const fromIdx = fromStage ? ALL_STAGES.indexOf(fromStage as typeof ALL_STAGES[number]) : 0;
  if (fromStage && fromIdx === -1) {
    return NextResponse.json({ error: `Unknown stage: ${fromStage}` }, { status: 422 });
  }
  const stagesToReset = ALL_STAGES.slice(fromIdx);

  // Reset the relevant stage rows
  await db.query(
    `UPDATE pipeline_stages
       SET status       = 'pending',
           error        = NULL,
           artifacts    = '{}',
           attempt      = 0,
           started_at   = NULL,
           completed_at = NULL,
           duration_ms  = NULL
     WHERE pipeline_id = $1
       AND stage_name  = ANY($2::text[])`,
    [id, stagesToReset]
  );

  // Also remove from stages_done array
  await db.query(
    `UPDATE pipelines
       SET stages_done = (
         SELECT array_agg(s) FROM unnest(stages_done) AS s
         WHERE s != ALL($2::text[])
       ),
           status        = 'queued',
           error         = NULL,
           retry_count   = retry_count + 1,
           current_stage = NULL,
           progress_pct  = CASE WHEN $3 = 0 THEN 0 ELSE progress_pct END,
           completed_at  = NULL,
           worker_id     = NULL,
           locked_at     = NULL,
           queued_at     = now()
     WHERE id = $1`,
    [id, stagesToReset, fromIdx]
  );

  // Re-enqueue — jobId = pipelineId makes this idempotent if already queued
  await enqueueAdvancedPipeline(id, pipeline.config, 3 /* higher priority for retries */);

  await emitEvent({ type: "pipeline_queued", pipelineId: id, ts: new Date().toISOString() });

  return NextResponse.json({
    ok:           true,
    pipelineId:   id,
    fromStage:    fromStage ?? ALL_STAGES[0],
    stagesReset:  stagesToReset.length,
    retryCount:   pipeline.retry_count + 1,
  });
}
