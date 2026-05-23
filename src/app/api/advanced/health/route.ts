// GET /api/advanced/health — deployment and runtime health check
//
// Returns:
//   status:    "healthy" | "degraded"
//   checks:    env, db, redis — each with ok + optional error message
//   latencyMs: time to complete all checks in parallel
//   ts:        ISO timestamp
//
// Returns HTTP 200 on healthy, 503 on degraded.
// Used by the AdvancedApp health strip and Railway health probes.

import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getAdvancedRedis } from "../../../../lib/queue/advanced";
import { validateEnv } from "../../../../lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();
  const env   = validateEnv();

  const [dbCheck, redisCheck] = await Promise.allSettled([
    getDb().query("SELECT 1 AS ping"),
    getAdvancedRedis().ping(),
  ]);

  const dbOk    = dbCheck.status    === "fulfilled";
  const redisOk = redisCheck.status === "fulfilled";
  const allOk   = env.ok && dbOk && redisOk;

  return NextResponse.json(
    {
      status:    allOk ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      checks: {
        env: {
          ok:      env.ok,
          missing: env.missing,
          absent:  env.absent,
          present: env.present.length,
        },
        db: {
          ok:    dbOk,
          error: !dbOk
            ? (dbCheck as PromiseRejectedResult).reason?.message ?? "unknown"
            : undefined,
        },
        redis: {
          ok:    redisOk,
          error: !redisOk
            ? (redisCheck as PromiseRejectedResult).reason?.message ?? "unknown"
            : undefined,
        },
      },
      ts: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
