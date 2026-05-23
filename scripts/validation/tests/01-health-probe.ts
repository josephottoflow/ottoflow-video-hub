import { TestRunner } from "../lib/runner";
import { api }        from "../lib/api";

export async function run(t: TestRunner): Promise<void> {
  t.begin("01 — Health probe caching");

  try {
    // Call 1 — should be a live ping
    const r1 = await api.get<{ status: string; cached: boolean; latencyMs: number; checks: Record<string, { ok: boolean }> }>(
      "/api/advanced/health"
    );
    t.assert("HTTP 200 on first call",  r1.status === 200, r1.status, 200);
    t.assertEqual("Status is healthy",  r1.body.status, "healthy");
    t.assert("DB check passes",         r1.body.checks?.db?.ok === true);
    t.assert("Redis check passes",      r1.body.checks?.redis?.ok === true);
    t.assert("Env check passes",        r1.body.checks?.env?.ok === true);
    t.assert("First call is live ping", r1.body.cached === false, r1.body.cached, false);
    t.record("firstCallLatencyMs",      r1.body.latencyMs);

    // Call 2 — within TTL, should be cached
    await new Promise((r) => setTimeout(r, 500));
    const r2 = await api.get<{ status: string; cached: boolean; latencyMs: number }>(
      "/api/advanced/health"
    );
    t.assert("Second call is cached",        r2.body.cached === true, r2.body.cached, true);
    t.assertLt("Cached latency is fast",     r2.body.latencyMs, 20);
    t.record("secondCallLatencyMs",          r2.body.latencyMs);

    // Call 3 — after TTL expires (65s) — this is slow, only run in full mode
    if (!process.env.QUICK_MODE) {
      console.log("  │   Waiting 65s for cache TTL to expire...");
      await new Promise((r) => setTimeout(r, 65_000));
      const r3 = await api.get<{ cached: boolean; latencyMs: number }>("/api/advanced/health");
      t.assert("Post-TTL call is live",       r3.body.cached === false, r3.body.cached, false);
      t.assertGt("Post-TTL latency is real",  r3.body.latencyMs, 5);
      t.record("postTtlLatencyMs",            r3.body.latencyMs);
    }

    t.pass();
  } catch (err) {
    t.fail(err);
  }
}
