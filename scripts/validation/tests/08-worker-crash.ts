// Worker crash recovery test — semi-manual.
//
// This test requires the ability to kill and restart the worker process.
// It supports two modes:
//
//   Automatic (Railway CLI):
//     Set RAILWAY_TOKEN and RAILWAY_SERVICE_ID env vars.
//     The test will call `railway service restart` automatically.
//
//   Manual (default):
//     The test will print a countdown and wait for you to restart the worker
//     manually via Railway dashboard. You have 90 seconds.
//
// Skip by setting: SKIP_CRASH_TEST=true

import { TestRunner }                           from "../lib/runner";
import { api }                                  from "../lib/api";
import { getPipeline, dbQuery, pollUntil }      from "../lib/db";
import { collectSseEvents }                     from "../lib/sse";
import { execSync }                             from "child_process";

const DEAD_THRESHOLD_S   = 120; // must match advanced-worker DEAD_THRESHOLD_S
const HEARTBEAT_INTERVAL = 180; // seconds — OPT-1 value
const RECOVERY_TIMEOUT   = (DEAD_THRESHOLD_S + HEARTBEAT_INTERVAL + 60) * 1_000; // ~6 min
const RENDER_TIMEOUT     = 25 * 60 * 1_000;

export async function run(t: TestRunner): Promise<void> {
  t.begin("08 — Worker crash recovery");

  if (process.env.SKIP_CRASH_TEST === "true") {
    t.skip("SKIP_CRASH_TEST=true — set to 'false' or remove to enable");
    return;
  }

  let id = "";

  try {
    // 1. Enqueue a pipeline
    const enqueue = await api.post<{ pipelineId: string }>(
      "/api/advanced/pipeline",
      { topic: "Worker crash recovery validation", style: "Educational", voice: "Female energetic" }
    );
    t.assert("Enqueue returns 200", enqueue.ok, enqueue.status, 200);
    id = enqueue.body.pipelineId;
    t.record("pipelineId", id);

    // 2. Wait for it to enter running state
    console.log("  │   Waiting for pipeline to enter running state...");
    const running = await pollUntil(
      () => getPipeline(id),
      (p) => p.status === "running",
      5 * 60 * 1_000,
      2_000
    );
    t.assert("Pipeline entered running state", running !== null, running?.status, "running");
    t.record("stageAtCrash", running?.current_stage);

    const workerIdAtCrash = running?.worker_id;
    t.record("workerIdAtCrash", workerIdAtCrash);

    // 3. Kill the worker
    const hasRailwayCli = tryRailwayRestart();
    if (hasRailwayCli) {
      console.log("  │   Railway CLI restart triggered");
      t.record("restartMethod", "railway-cli");
    } else {
      t.record("restartMethod", "manual");
      console.log("  │");
      console.log("  │   ┌──────────────────────────────────────────────┐");
      console.log("  │   │  ACTION REQUIRED: Restart the worker now.    │");
      console.log("  │   │  Railway dashboard → worker service → Restart│");
      console.log("  │   │  You have 90 seconds.                        │");
      console.log("  │   └──────────────────────────────────────────────┘");

      for (let s = 90; s > 0; s -= 10) {
        await new Promise((r) => setTimeout(r, 10_000));
        console.log(`  │   ${s}s remaining...`);
      }
    }

    // 4. Verify worker is dead/stale (pipeline still "running" in DB)
    await new Promise((r) => setTimeout(r, 5_000));
    const stuck = await getPipeline(id);
    t.assert("Pipeline is stuck (still running) after crash",
      stuck?.status === "running",
      stuck?.status, "running"
    );
    t.record("statusAfterCrash", stuck?.status);

    // 5. Wait for dead-worker detection (DEAD_THRESHOLD_S = 120s) + recovery
    // The new worker detects the dead one on startup via recoverStuckPipelines()
    console.log(`  │   Waiting up to ${Math.round(RECOVERY_TIMEOUT / 60000)} min for recovery...`);
    const recovered = await pollUntil(
      () => getPipeline(id),
      (p) => p.status === "queued" || p.status === "running" || p.status === "done",
      RECOVERY_TIMEOUT,
      5_000
    );

    t.assert("Pipeline was re-queued by new worker",
      recovered !== null && recovered.status !== "running" || recovered?.worker_id !== workerIdAtCrash,
      recovered?.status
    );
    t.record("statusAfterRecovery", recovered?.status);

    // 6. Check that old worker row is marked crashed
    const deadWorkers = await dbQuery<{ id: string; status: string }>(
      `SELECT id, status FROM workers WHERE id = $1`,
      [workerIdAtCrash]
    );
    if (deadWorkers.length > 0) {
      t.assertEqual("Old worker is marked crashed", deadWorkers[0].status, "crashed");
    }

    // 7. Wait for pipeline to fully complete under new worker
    if (recovered && recovered.status !== "done") {
      console.log("  │   Waiting for pipeline to complete under new worker...");
      const sse = await collectSseEvents([id], { timeoutMs: RENDER_TIMEOUT });
      t.assert("Pipeline completes after recovery",
        !sse.timedOut && sse.terminalType === "pipeline_done",
        sse.terminalType
      );
    }

    const final = await getPipeline(id);
    t.assertEqual("Final status = done", final?.status, "done");
    t.assertGt("retry_count ≥ 0", final?.retry_count ?? 0, -1);
    t.record("finalRetryCount", final?.retry_count);

    t.pass();
  } catch (err) {
    if (id) t.record("pipelineId", id);
    t.fail(err);
  }
}

function tryRailwayRestart(): boolean {
  const token     = process.env.RAILWAY_TOKEN;
  const serviceId = process.env.RAILWAY_SERVICE_ID;
  if (!token || !serviceId) return false;

  try {
    execSync(`railway service restart --service ${serviceId}`, {
      env:   { ...process.env, RAILWAY_TOKEN: token },
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}
