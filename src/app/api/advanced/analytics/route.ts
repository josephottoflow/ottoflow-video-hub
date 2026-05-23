// GET /api/advanced/analytics — stage performance + queue depth history
//
// Returns:
//   stageStats:    P50/P95/P99 duration, success rate, attempt count per stage
//   queueHistory:  Last 48 snapshots (≈24h at 30s heartbeat cadence)
//   summary:       24h render counts, avg duration, error rate

import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();

  const [stageResult, historyResult, summaryResult] = await Promise.allSettled([
    // Per-stage P50 / P95 / P99 from pipeline_stages (last 7 days)
    db.query<{
      stage_name:   string;
      p50_ms:       number | null;
      p95_ms:       number | null;
      p99_ms:       number | null;
      avg_ms:       number | null;
      total:        number;
      succeeded:    number;
      failed:       number;
      avg_attempts: number;
    }>(`
      SELECT
        stage_name,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_ms,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::int AS p99_ms,
        ROUND(AVG(duration_ms))::int                                    AS avg_ms,
        COUNT(*)                                                         AS total,
        COUNT(*) FILTER (WHERE status = 'done')                         AS succeeded,
        COUNT(*) FILTER (WHERE status = 'failed')                       AS failed,
        ROUND(AVG(attempt), 1)                                          AS avg_attempts
      FROM pipeline_stages
      WHERE completed_at > NOW() - INTERVAL '7 days'
        AND duration_ms IS NOT NULL
      GROUP BY stage_name
      ORDER BY stage_name
    `),

    // Queue depth history — last 96 snapshots (~48h at 30min intervals, or ~48min at 30s)
    db.query<{
      captured_at: string;
      waiting:     number;
      active:      number;
      delayed:     number;
      done_24h:    number;
      failed_24h:  number;
    }>(`
      SELECT captured_at, waiting, active, delayed, done_24h, failed_24h
      FROM queue_snapshots
      ORDER BY captured_at DESC
      LIMIT 96
    `),

    // 24h summary
    db.query<{
      done_24h:       string;
      failed_24h:     string;
      cancelled_24h:  string;
      avg_duration_s: number | null;
      p95_duration_s: number | null;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'done'      AND completed_at > NOW() - INTERVAL '24 hours') AS done_24h,
        COUNT(*) FILTER (WHERE status = 'failed'    AND completed_at > NOW() - INTERVAL '24 hours') AS failed_24h,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND completed_at > NOW() - INTERVAL '24 hours') AS cancelled_24h,
        ROUND(AVG(duration_ms) FILTER (WHERE status = 'done' AND completed_at > NOW() - INTERVAL '24 hours') / 1000)::int AS avg_duration_s,
        PERCENTILE_CONT(0.95) WITHIN GROUP (
          ORDER BY duration_ms
        ) FILTER (WHERE status = 'done' AND completed_at > NOW() - INTERVAL '24 hours') / 1000 AS p95_duration_s
      FROM pipelines
    `),
  ]);

  return NextResponse.json({
    stageStats:   stageResult.status   === "fulfilled" ? stageResult.value.rows   : [],
    queueHistory: historyResult.status === "fulfilled"
      ? historyResult.value.rows.reverse()   // oldest→newest for charting
      : [],
    summary:      summaryResult.status === "fulfilled" ? summaryResult.value.rows[0] : null,
  });
}
