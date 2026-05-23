import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await getDb().query(`
      SELECT
        w.id, w.status, w.tier, w.concurrency, w.version, w.hostname,
        w.started_at, w.last_seen,
        w.memory_rss_mb, w.memory_heap_mb, w.renders_this_session,
        EXTRACT(EPOCH FROM (NOW() - w.last_seen))::int    AS heartbeat_age_s,
        EXTRACT(EPOCH FROM (NOW() - w.started_at))::int   AS uptime_s,
        p.id           AS pipeline_id,
        p.topic        AS pipeline_topic,
        p.current_stage,
        p.progress_pct AS pipeline_progress
      FROM workers w
      LEFT JOIN pipelines p ON p.worker_id = w.id AND p.status = 'running'
      WHERE w.started_at > NOW() - INTERVAL '2 days'
      ORDER BY
        CASE w.status WHEN 'online' THEN 0 WHEN 'draining' THEN 1 ELSE 2 END,
        w.started_at DESC
      LIMIT 20
    `);
    return NextResponse.json({ workers: rows });
  } catch (err) {
    return NextResponse.json({ workers: [], error: (err as Error).message }, { status: 500 });
  }
}
