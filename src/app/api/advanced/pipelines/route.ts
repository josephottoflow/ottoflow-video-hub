import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit  = Math.min(parseInt(searchParams.get("limit") ?? "25"), 50);
  const status = searchParams.get("status"); // comma-separated filter

  const statusList = status ? status.split(",").filter(Boolean) : null;

  try {
    const { rows: pipelines } = await getDb().query(
      `SELECT
         p.id, p.status, p.tier, p.topic, p.style,
         p.render_variant, p.hook_style, p.template,
         p.current_stage, p.progress_pct, p.error,
         p.artifacts, p.priority, p.row_index, p.retry_count,
         p.queued_at, p.started_at, p.completed_at, p.worker_id,
         EXTRACT(EPOCH FROM (COALESCE(p.completed_at, NOW()) - p.started_at))::int AS duration_s
       FROM pipelines p
       ${statusList ? "WHERE p.status = ANY($2::text[])" : ""}
       ORDER BY p.queued_at DESC
       LIMIT $1`,
      statusList ? [limit, statusList] : [limit]
    );

    if (pipelines.length === 0) return NextResponse.json({ pipelines: [] });

    // Load stages for all pipelines in one query
    const ids = pipelines.map((p) => p.id);
    const { rows: stages } = await getDb().query(
      `SELECT
         pipeline_id, stage_name, status, attempt,
         started_at, completed_at,
         EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - started_at))::int AS duration_s,
         error
       FROM pipeline_stages
       WHERE pipeline_id = ANY($1::text[])
       ORDER BY started_at ASC NULLS LAST`,
      [ids]
    );

    const stagesByPipeline: Record<string, typeof stages> = {};
    for (const s of stages) {
      if (!stagesByPipeline[s.pipeline_id]) stagesByPipeline[s.pipeline_id] = [];
      stagesByPipeline[s.pipeline_id].push(s);
    }

    return NextResponse.json({
      pipelines: pipelines.map((p) => ({
        ...p,
        stages: stagesByPipeline[p.id] ?? [],
      })),
    });
  } catch (err) {
    return NextResponse.json({ pipelines: [], error: (err as Error).message }, { status: 500 });
  }
}
