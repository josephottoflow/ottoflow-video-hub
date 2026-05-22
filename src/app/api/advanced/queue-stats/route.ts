import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getQueueStats } from "../../../../lib/queue/advanced";

export const dynamic = "force-dynamic";

export async function GET() {
  const [dbResult, bullmqResult] = await Promise.allSettled([
    getDb().query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('queued','pending'))  AS pending,
        COUNT(*) FILTER (WHERE status = 'running')              AS running,
        COUNT(*) FILTER (WHERE status = 'done')                 AS done_today,
        COUNT(*) FILTER (WHERE status = 'failed')               AS failed_today,
        COUNT(*)                                                 AS total,
        ROUND(
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))
          FILTER (WHERE status = 'done' AND completed_at IS NOT NULL)
        )::int AS avg_duration_s
      FROM pipelines
      WHERE queued_at > NOW() - INTERVAL '24 hours'
    `),
    getQueueStats(),
  ]);

  return NextResponse.json({
    db:     dbResult.status     === "fulfilled" ? dbResult.value.rows[0]  : null,
    bullmq: bullmqResult.status === "fulfilled" ? bullmqResult.value      : null,
  });
}
