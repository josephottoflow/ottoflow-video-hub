// Redis reconnect resilience test — manual by nature.
//
// Requires temporarily pausing your Upstash Redis instance to simulate
// a Redis outage, then resuming it.  The test measures how long the worker
// survives and whether it recovers without a process restart.
//
// Enable with: RUN_REDIS_TEST=true
// Upstash pause: console.upstash.com → your DB → Pause
//
// Note: Because we cannot automate Upstash console actions, this test
// operates as a guided manual procedure with automated assertions on
// the observable outcomes (DB state, SSE resumption, health probe).

import { TestRunner }               from "../lib/runner";
import { api }                      from "../lib/api";
import { getPipeline, pollUntil }   from "../lib/db";
import { collectSseEvents }         from "../lib/sse";

const TIMEOUT = 15 * 60 * 1_000;

export async function run(t: TestRunner): Promise<void> {
  t.begin("09 — Redis reconnect resilience");

  if (process.env.RUN_REDIS_TEST !== "true") {
    t.skip("Set RUN_REDIS_TEST=true (requires manual Upstash pause/resume)");
    return;
  }

  let id = "";

  try {
    // 1. Health check — confirm Redis is UP before starting
    const health1 = await api.get<{ status: string; checks: { redis: { ok: boolean } } }>(
      "/api/advanced/health"
    );
    t.assert("Redis is healthy at test start", health1.body.checks?.redis?.ok === true);

    // 2. Enqueue a pipeline
    const enqueue = await api.post<{ pipelineId: string }>(
      "/api/advanced/pipeline",
      { topic: "Redis reconnect resilience test", style: "Educational", voice: "Female energetic" }
    );
    t.assert("Enqueue returns 200", enqueue.ok, enqueue.status, 200);
    id = enqueue.body.pipelineId;
    t.record("pipelineId", id);

    // 3. Wait for pipeline to start
    await pollUntil(
      () => getPipeline(id),
      (p) => p.status === "running",
      3 * 60_000,
      2_000
    );

    // 4. Manual step: pause Redis
    console.log("  │");
    console.log("  │   ┌──────────────────────────────────────────────────────┐");
    console.log("  │   │  PAUSE Upstash Redis now (console.upstash.com).      │");
    console.log("  │   │  You have 30 seconds before we start checking.       │");
    console.log("  │   └──────────────────────────────────────────────────────┘");
    await new Promise((r) => setTimeout(r, 30_000));

    // 5. Confirm health shows Redis degraded
    const health2 = await api.get<{ status: string; checks: { redis: { ok: boolean } } }>(
      "/api/advanced/health"
    );
    t.assert("Health shows degraded during outage",
      health2.body.status === "degraded" || health2.body.checks?.redis?.ok === false,
      health2.body.status
    );
    t.record("healthDuringOutage", health2.body.status);

    // 6. Manual step: resume Redis
    console.log("  │");
    console.log("  │   ┌──────────────────────────────────────────────────────┐");
    console.log("  │   │  RESUME Upstash Redis now.                           │");
    console.log("  │   │  Waiting 30 seconds for reconnect...                 │");
    console.log("  │   └──────────────────────────────────────────────────────┘");
    await new Promise((r) => setTimeout(r, 30_000));

    // 7. Confirm health recovers
    const health3 = await api.get<{ status: string; checks: { redis: { ok: boolean } } }>(
      "/api/advanced/health"
    );
    t.assert("Health recovers after Redis resume", health3.body.checks?.redis?.ok === true, health3.body.status);
    t.record("healthAfterResume", health3.body.status);

    // 8. Pipeline should continue and complete (SSE resumes after reconnect)
    console.log("  │   Waiting for pipeline to complete post-recovery...");
    const sse = await collectSseEvents([id], { timeoutMs: TIMEOUT });
    t.assert("Pipeline completes after Redis resume",
      !sse.timedOut && sse.terminalType === "pipeline_done",
      sse.terminalType
    );
    t.record("postReconnectEventCount", sse.events.length);

    const final = await getPipeline(id);
    t.assertEqual("Final pipeline status = done", final?.status, "done");

    t.pass();
  } catch (err) {
    if (id) t.record("pipelineId", id);
    t.fail(err);
  }
}
