import { TestRunner }                                       from "../lib/runner";
import { api }                                              from "../lib/api";
import { getPipeline, getStages, pollUntil }               from "../lib/db";
import { collectSseEvents, eventsByType, progressValues, isMonotonic } from "../lib/sse";

const TOPIC   = "Six Sigma process validation — baseline test";
const TIMEOUT = 25 * 60 * 1_000; // 25 min

export async function run(t: TestRunner): Promise<void> {
  t.begin("02 — Baseline pipeline (single, end-to-end)");

  let pipelineId = "";

  try {
    // 1. Enqueue
    const enqueue = await api.post<{ pipelineId: string }>(
      "/api/advanced/pipeline",
      { topic: TOPIC, style: "Educational", voice: "Female energetic" }
    );
    t.assert("Enqueue returns 200",    enqueue.ok, enqueue.status, 200);
    t.assertNotNull("pipelineId returned", enqueue.body.pipelineId);
    pipelineId = enqueue.body.pipelineId;
    t.record("pipelineId", pipelineId);

    // 2. Verify queued state in DB
    const queued = await pollUntil(
      () => getPipeline(pipelineId),
      (p) => p.status === "queued" || p.status === "running",
      30_000
    );
    t.assert("Pipeline appears in DB", queued !== null, queued?.status);

    // 3. Collect SSE events until done (or timeout)
    console.log("  │   Streaming SSE events...");
    const sse = await collectSseEvents([pipelineId], { timeoutMs: TIMEOUT });
    t.assert("SSE did not time out",   !sse.timedOut, sse.timedOut, false);
    t.assertEqual("Terminal event is pipeline_done", sse.terminalType, "pipeline_done");
    t.record("durationMs",             sse.durationMs);
    t.record("sseEventCount",          sse.events.length);

    // 4. Assert event ordering
    const stageStarts = eventsByType(sse.events, "stage_started").length;
    const stageDones  = eventsByType(sse.events, "stage_done").length;
    t.assert("stage_started count > 0",       stageStarts > 0, stageStarts);
    t.assertEqual("stage_done = stage_started", stageDones, stageStarts);

    const progress = progressValues(sse.events);
    t.assert("Progress values are monotonic", isMonotonic(progress), progress.join(","));
    t.record("progressSteps",                  progress.length);

    // 5. DB ground truth
    const done = await getPipeline(pipelineId);
    t.assertEqual("DB status is done",        done?.status, "done");
    t.assertEqual("progress_pct is 100",      done?.progress_pct, 100);
    t.assertNotNull("completed_at is set",    done?.completed_at);

    const stages = await getStages(pipelineId);
    const failedStages = stages.filter((s) => s.status === "failed");
    const pendingStages = stages.filter((s) => s.status === "pending");
    t.assert("No failed stages",    failedStages.length === 0,  failedStages.map((s) => s.stage_name));
    t.assert("No pending stages",   pendingStages.length === 0, pendingStages.map((s) => s.stage_name));
    t.assert("All stages have duration_ms", stages.every((s) => s.duration_ms != null || s.status === "skipped"));
    t.record("stageCount",          stages.length);
    t.record("totalStageDurationMs", stages.reduce((s, r) => s + (r.duration_ms ?? 0), 0));

    t.pass();
  } catch (err) {
    if (pipelineId) t.record("pipelineId", pipelineId);
    t.fail(err);
  }
}
