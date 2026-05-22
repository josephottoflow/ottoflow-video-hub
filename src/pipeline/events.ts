// Pipeline event emission
//
// Every event goes to two places simultaneously:
//   1. Redis pub/sub  — real-time delivery to connected SSE clients
//   2. pipeline_events DB table — durable log for replay, debugging, analytics
//
// Both writes are fire-and-forget (errors are logged, never thrown).

import { getDb } from "../lib/db";
import { publishPipelineEvent } from "../lib/redis/pubsub";
import type { PipelineEvent } from "./types";

export async function emitEvent(event: PipelineEvent): Promise<void> {
  // Publish to Redis pub/sub (real-time)
  publishPipelineEvent(event).catch((err) =>
    console.warn("[pipeline:events] Redis publish failed:", err?.message)
  );

  // Write to DB (durable log)
  getDb()
    .query(
      `INSERT INTO pipeline_events (pipeline_id, event_type, stage_name, payload, worker_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.pipelineId,
        event.type,
        event.stageName ?? null,
        JSON.stringify({
          progress:  event.progress,
          message:   event.message,
          error:     event.error,
          artifacts: event.artifacts,
          metadata:  event.metadata,
        }),
        event.workerId ?? null,
      ]
    )
    .catch((err) =>
      console.warn("[pipeline:events] DB write failed:", err?.message)
    );
}

/** Load the last N events for a pipeline (SSE initial snapshot). */
export async function getRecentEvents(pipelineId: string, limit = 50): Promise<PipelineEvent[]> {
  try {
    const { rows } = await getDb().query<{
      event_type: string;
      stage_name: string | null;
      payload:    Record<string, unknown>;
      worker_id:  string | null;
      emitted_at: Date;
    }>(
      `SELECT event_type, stage_name, payload, worker_id, emitted_at
       FROM pipeline_events
       WHERE pipeline_id = $1
       ORDER BY emitted_at DESC LIMIT $2`,
      [pipelineId, limit]
    );
    return rows
      .reverse()
      .map((r) => ({
        type:       r.event_type as PipelineEvent["type"],
        pipelineId,
        stageName:  r.stage_name ?? undefined,
        workerId:   r.worker_id ?? undefined,
        progress:   r.payload.progress as number | undefined,
        message:    r.payload.message as string | undefined,
        error:      r.payload.error as string | undefined,
        artifacts:  r.payload.artifacts as Record<string, string> | undefined,
        metadata:   r.payload.metadata as Record<string, unknown> | undefined,
        ts:         r.emitted_at.toISOString(),
      }));
  } catch {
    return [];
  }
}
