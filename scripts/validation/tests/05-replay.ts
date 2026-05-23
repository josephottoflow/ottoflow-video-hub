import { TestRunner }                   from "../lib/runner";
import { api }                          from "../lib/api";
import { getPipeline, getStages, pollUntil } from "../lib/db";
import { collectSseEvents }             from "../lib/sse";

const TIMEOUT = 30 * 60 * 1_000;

export async function run(t: TestRunner): Promise<void> {
  t.begin("05 — Pipeline replay (full retry + fromStage)");

  let id = "";

  try {
    // ── Step 1: Run a pipeline to completion ─────────────────────────────────

    const enqueue = await api.post<{ pipelineId: string }>(
      "/api/advanced/pipeline",
      { topic: "Replay validation test", style: "Educational", voice: "Female energetic" }
    );
    t.assert("Initial enqueue returns 200", enqueue.ok, enqueue.status, 200);
    id = enqueue.body.pipelineId;
    t.record("pipelineId", id);

    console.log("  │   Running initial pipeline to completion...");
    const sse1 = await collectSseEvents([id], { timeoutMs: TIMEOUT });
    t.assert("Initial run completes",       !sse1.timedOut && sse1.terminalType === "pipeline_done");

    const done = await getPipeline(id);
    t.assertEqual("Initial status = done",  done?.status, "done");
    t.assertEqual("retry_count starts at 0", done?.retry_count, 0);

    const stagesBefore = await getStages(id);
    const completedBefore = stagesBefore.filter((s) => s.status === "done" || s.status === "skipped");
    t.record("stagesCompletedInitially", completedBefore.length);

    // ── Step 2: Full retry (fromStage = beginning) ────────────────────────────

    const retry = await api.post<{ ok: boolean; retryCount: number; stagesReset: number }>(
      `/api/advanced/pipeline/${id}/retry`,
      {}
    );
    t.assert("Retry returns 200",           retry.ok, retry.status, 200);
    t.assertEqual("retry_count increments", retry.body.retryCount, 1);
    t.assert("stagesReset > 0",             retry.body.stagesReset > 0, retry.body.stagesReset);
    t.record("stagesReset",                 retry.body.stagesReset);

    // All stages should be reset to pending
    const stagesAfterReset = await getStages(id);
    const pendingCount = stagesAfterReset.filter((s) => s.status === "pending").length;
    t.assertGt("All stages reset to pending", pendingCount, 0);

    // Retry should run to completion
    console.log("  │   Waiting for full retry to complete...");
    const sse2 = await collectSseEvents([id], { timeoutMs: TIMEOUT });
    t.assert("Retry completes",             !sse2.timedOut && sse2.terminalType === "pipeline_done");

    const afterRetry = await getPipeline(id);
    t.assertEqual("Status = done after retry", afterRetry?.status, "done");
    t.assertEqual("retry_count = 1",           afterRetry?.retry_count, 1);

    // ── Step 3: fromStage partial replay ─────────────────────────────────────

    // Pick the 3rd stage (index 2) from the completed stages list
    const stagesForPartial = await getStages(id);
    const doneStages = stagesForPartial.filter((s) => s.status === "done");

    if (doneStages.length >= 3) {
      const fromStage = doneStages[2].stage_name;
      t.record("partialFromStage", fromStage);

      const partial = await api.post<{ ok: boolean; stagesReset: number; fromStage: string }>(
        `/api/advanced/pipeline/${id}/retry`,
        { fromStage }
      );
      t.assert("Partial retry returns 200",    partial.ok, partial.status, 200);
      t.record("partialStagesReset",            partial.body.stagesReset);

      // Stages BEFORE fromStage should still be done
      const stagesCheck = await getStages(id);
      const beforeStages = stagesCheck.slice(0, 2);
      const beforeAllDone = beforeStages.every((s) => s.status === "done" || s.status === "skipped");
      t.assert("Pre-fromStage stages remain done", beforeAllDone,
        beforeStages.map((s) => `${s.stage_name}:${s.status}`));

      // stages AT and after fromStage should be pending or running
      const atIdx = stagesCheck.findIndex((s) => s.stage_name === fromStage);
      const fromStagesOnward = stagesCheck.slice(atIdx);
      const anyPending = fromStagesOnward.some((s) => s.status === "pending" || s.status === "running" || s.status === "done");
      t.assert("fromStage stages were reset", anyPending);

      // Complete the partial retry
      console.log("  │   Waiting for partial replay to complete...");
      const sse3 = await collectSseEvents([id], { timeoutMs: TIMEOUT });
      t.assert("Partial replay completes",  !sse3.timedOut && sse3.terminalType === "pipeline_done");

      const afterPartial = await getPipeline(id);
      t.assertEqual("Status = done after partial retry", afterPartial?.status, "done");
      t.assertEqual("retry_count = 2", afterPartial?.retry_count, 2);
    } else {
      t.skip("Not enough done stages for partial replay test");
    }

    t.pass();
  } catch (err) {
    if (id) t.record("pipelineId", id);
    t.fail(err);
  }
}
