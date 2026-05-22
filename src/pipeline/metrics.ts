import { getDb } from "../lib/db";

/** Write a stage execution metric record (non-blocking, never throws). */
export function recordStageMetric(
  pipelineId: string,
  stageName:  string,
  durationMs: number,
  succeeded:  boolean,
  tier        = "advanced"
): void {
  getDb()
    .query(
      `INSERT INTO stage_metrics (pipeline_id, stage_name, duration_ms, succeeded, tier)
       VALUES ($1, $2, $3, $4, $5)`,
      [pipelineId, stageName, durationMs, succeeded, tier]
    )
    .catch((err) => console.warn("[pipeline:metrics] write failed:", err?.message));
}

/** P50/P95 latency + success rate per stage (used in admin dashboard). */
export async function getStageStats(windowHours = 24): Promise<{
  stageName:    string;
  runs:         number;
  successRate:  number;
  p50Ms:        number;
  p95Ms:        number;
  avgMs:        number;
}[]> {
  try {
    const { rows } = await getDb().query(
      `SELECT
         stage_name,
         COUNT(*)::int                                             AS runs,
         ROUND(AVG(succeeded::int) * 100, 1)                     AS success_rate,
         PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms)::int AS p50_ms,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::int AS p95_ms,
         ROUND(AVG(duration_ms))::int                             AS avg_ms
       FROM stage_metrics
       WHERE recorded_at > now() - ($1 * interval '1 hour')
       GROUP BY stage_name
       ORDER BY avg_ms DESC`,
      [windowHours]
    );
    return rows.map((r) => ({
      stageName:   r.stage_name,
      runs:        Number(r.runs),
      successRate: Number(r.success_rate),
      p50Ms:       Number(r.p50_ms),
      p95Ms:       Number(r.p95_ms),
      avgMs:       Number(r.avg_ms),
    }));
  } catch {
    return [];
  }
}
