import { TestRunner }                      from "../lib/runner";
import { api }                             from "../lib/api";
import { getPipeline, getStages, dbQuery } from "../lib/db";
import { collectSseEvents, checkChannelIsolation } from "../lib/sse";

const TIMEOUT = 40 * 60 * 1_000; // 40 min for both

const PIPELINES = [
  { topic: "OKR framework — concurrent test A", style: "Educational",  voice: "Female energetic" },
  { topic: "AI automation myths — concurrent test B", style: "Motivational", voice: "Male confident" },
];

export async function run(t: TestRunner): Promise<void> {
  t.begin("03 — Concurrent pipelines (dual)");

  const ids: string[] = [];

  try {
    // 1. Enqueue both within 2 seconds
    for (const p of PIPELINES) {
      const r = await api.post<{ pipelineId: string }>("/api/advanced/pipeline", p);
      t.assert(`Enqueue [${p.topic.slice(0, 20)}] returns 200`, r.ok, r.status, 200);
      ids.push(r.body.pipelineId);
      await new Promise((res) => setTimeout(res, 200));
    }
    t.record("pipelineIds", ids);

    // 2. Verify both appear in DB
    for (const id of ids) {
      const p = await getPipeline(id);
      t.assertNotNull(`Pipeline ${id.slice(0, 8)} in DB`, p);
    }

    // 3. Check concurrency mode (CONCURRENCY env on worker)
    const queueStats = await api.get<{ waiting: number; active: number }>(
      "/api/advanced/queue-stats"
    );
    t.record("queueDepthAtStart", queueStats.body);

    // 4. Stream both SSE channels concurrently
    console.log("  │   Streaming SSE for both pipelines...");
    const sse = await collectSseEvents(ids, { timeoutMs: TIMEOUT });
    t.assert("SSE did not time out",    !sse.timedOut, sse.timedOut, false);
    t.record("totalEvents",             sse.events.length);
    t.record("durationMs",             sse.durationMs);

    // 5. Channel isolation — no event for P1 should carry P2's ID and vice versa
    const isolation = checkChannelIsolation(sse.events, new Set(ids));
    t.assert("No cross-pipeline event leakage", isolation.clean, isolation.leakedIds);

    // 6. Both pipelines completed in DB
    for (const id of ids) {
      const done = await getPipeline(id);
      t.assertEqual(`Pipeline ${id.slice(0, 8)} status = done`, done?.status, "done");
      t.assertEqual(`Pipeline ${id.slice(0, 8)} progress_pct = 100`, done?.progress_pct, 100);
    }

    // 7. No stage cross-contamination (stage rows carry correct pipeline_id)
    const allStages = await dbQuery<{ pipeline_id: string }>(
      `SELECT DISTINCT pipeline_id FROM pipeline_stages WHERE pipeline_id = ANY($1::uuid[])`,
      [ids]
    );
    const foundIds = allStages.map((r) => r.pipeline_id);
    for (const id of ids) {
      t.assert(`Stage rows exist for ${id.slice(0, 8)}`, foundIds.includes(id), foundIds.length);
    }

    // 8. Verify each pipeline has its own complete stage set
    for (const id of ids) {
      const stages = await getStages(id);
      const failed = stages.filter((s) => s.status === "failed");
      t.assert(`No failed stages in ${id.slice(0, 8)}`, failed.length === 0, failed.map((s) => s.stage_name));
    }

    t.pass();
  } catch (err) {
    if (ids.length) t.record("pipelineIds", ids);
    t.fail(err);
  }
}
