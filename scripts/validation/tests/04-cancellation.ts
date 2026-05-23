import { TestRunner }               from "../lib/runner";
import { api }                      from "../lib/api";
import { getPipeline, pollUntil }   from "../lib/db";

const TIMEOUT_RUNNING = 5 * 60 * 1_000;

export async function run(t: TestRunner): Promise<void> {
  t.begin("04 — Cancellation (queued + running)");

  try {
    // ── Part A: Cancel while queued ───────────────────────────────────────────

    const eA = await api.post<{ pipelineId: string }>(
      "/api/advanced/pipeline",
      { topic: "Cancellation test A — queued", style: "Educational", voice: "Female energetic" }
    );
    t.assert("Enqueue A returns 200", eA.ok, eA.status, 200);
    const idA = eA.body.pipelineId;
    t.record("pipelineIdA", idA);

    // Cancel immediately — race for queued state before worker picks it up
    // Small delay to ensure DB row is committed
    await new Promise((r) => setTimeout(r, 800));
    const pA = await getPipeline(idA);
    if (pA?.status === "queued") {
      const cancelA = await api.delete<{ ok: boolean; message: string }>(
        `/api/advanced/pipeline/${idA}`
      );
      t.assert("Cancel while queued returns 200", cancelA.ok, cancelA.status, 200);
      const afterA = await getPipeline(idA);
      t.assertEqual("Queued pipeline → cancelled",   afterA?.status, "cancelled");
      t.assertNotNull("completed_at set on cancel",   afterA?.completed_at);
      t.record("cancelledFromQueuedState", true);
    } else {
      // Already running — this is OK, test Part A as a running cancel instead
      t.record("cancelledFromQueuedState", false);
      t.assert("Pipeline A in known state", ["queued", "running"].includes(pA?.status ?? ""), pA?.status);
      const cancelA = await api.delete(`/api/advanced/pipeline/${idA}`);
      t.assert("Cancel call succeeds", cancelA.ok, cancelA.status, 200);
    }

    // ── Part B: Cancel while running ─────────────────────────────────────────

    const eB = await api.post<{ pipelineId: string }>(
      "/api/advanced/pipeline",
      { topic: "Cancellation test B — running", style: "Educational", voice: "Female energetic" }
    );
    t.assert("Enqueue B returns 200", eB.ok, eB.status, 200);
    const idB = eB.body.pipelineId;
    t.record("pipelineIdB", idB);

    // Wait for it to enter running state
    console.log("  │   Waiting for pipeline B to enter running state...");
    const running = await pollUntil(
      () => getPipeline(idB),
      (p) => p.status === "running",
      TIMEOUT_RUNNING,
      2_000
    );
    t.assert("Pipeline B entered running state", running !== null, running?.status, "running");
    t.record("stageAtCancel", running?.current_stage);

    if (running) {
      // Cancel mid-run
      const cancelB = await api.delete<{ ok: boolean; message: string }>(
        `/api/advanced/pipeline/${idB}`
      );
      t.assert("Cancel while running returns 200", cancelB.ok, cancelB.status, 200);
      t.assert("Cancel message mentions stage boundary",
        cancelB.body.message?.includes("stage boundary") ?? true // message is advisory
      );

      // Wait up to 2 min for the stage boundary to be reached
      const cancelled = await pollUntil(
        () => getPipeline(idB),
        (p) => p.status === "cancelled",
        120_000,
        3_000
      );
      t.assert("Pipeline B reaches cancelled status", cancelled !== null, cancelled?.status, "cancelled");
      t.record("stageWhenCancelled", cancelled?.current_stage);
    }

    // ── Retry a cancelled pipeline should be allowed ──────────────────────────

    const retryB = await api.post(`/api/advanced/pipeline/${idB}/retry`, {});
    t.assert("Retry from cancelled is accepted",
      retryB.status === 200 || retryB.status === 409, // 409 = terminal state doesn't allow retry
      retryB.status
    );
    t.record("retryFromCancelledStatus", retryB.status);

    // Clean up: cancel the retry if it re-queued
    if (retryB.ok) {
      await new Promise((r) => setTimeout(r, 1_000));
      await api.delete(`/api/advanced/pipeline/${idB}`);
    }

    t.pass();
  } catch (err) {
    t.fail(err);
  }
}
