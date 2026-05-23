// DELETE /api/advanced/pipeline/:id — cancel a pipeline
//
// If the pipeline is queued (not yet picked up): removes the BullMQ job +
//   marks DB status = 'cancelled' immediately.
// If the pipeline is running: marks DB status = 'cancelled'. The engine
//   detects this at the next stage boundary and stops cleanly.
// If the pipeline is already in a terminal state: returns 409.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getAdvancedQueue } from "../../../../../lib/queue/advanced";
import { emitEvent } from "../../../../../pipeline/events";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  if (!id) return NextResponse.json({ error: "Missing pipeline id" }, { status: 400 });

  const db = getDb();

  // Load current status
  const { rows: [pipeline] } = await db.query<{ status: string; worker_id: string | null }>(
    `SELECT status, worker_id FROM pipelines WHERE id = $1`,
    [id]
  );

  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }

  const TERMINAL = ["done", "failed", "cancelled", "timed_out", "dead"];
  if (TERMINAL.includes(pipeline.status)) {
    return NextResponse.json(
      { error: `Pipeline already in terminal state: ${pipeline.status}` },
      { status: 409 }
    );
  }

  // Try to remove the BullMQ job (succeeds if still waiting, no-op if running)
  try {
    const job = await getAdvancedQueue().getJob(id);
    if (job) {
      const state = await job.getState();
      if (state === "waiting" || state === "delayed" || state === "prioritized") {
        await job.remove();
      }
    }
  } catch { /* non-fatal — job may already be processing */ }

  // Mark cancelled in DB (engine will stop at next stage boundary if running)
  await db.query(
    `UPDATE pipelines
       SET status        = 'cancelled',
           error         = 'Cancelled by operator',
           completed_at  = CASE WHEN status != 'running' THEN now() ELSE NULL END,
           worker_id     = CASE WHEN status != 'running' THEN NULL ELSE worker_id END,
           locked_at     = CASE WHEN status != 'running' THEN NULL ELSE locked_at END,
           current_stage = CASE WHEN status != 'running' THEN NULL ELSE current_stage END
     WHERE id = $1`,
    [id]
  );

  await emitEvent({ type: "pipeline_cancelled", pipelineId: id, ts: new Date().toISOString() });

  return NextResponse.json({
    ok:      true,
    message: pipeline.status === "running"
      ? "Cancel signal sent — pipeline will stop at next stage boundary"
      : "Pipeline cancelled",
  });
}
