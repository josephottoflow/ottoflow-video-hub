// GET /api/advanced/health — deployment and runtime health check
//
// Returns:
//   status:    "healthy" | "degraded"
//   checks:    env, db, redis — each with ok + optional error message
//   latencyMs: time to complete all checks in parallel
//   cached:    true if redis/db results served from in-process cache
//   ts:        ISO timestamp
//
// Returns HTTP 200 on healthy, 503 on degraded.
// Used by the AdvancedApp health strip and Railway health probes.
//
// Redis ping is cached for REDIS_CACHE_TTL_MS to prevent health probes
// (typically every 30s) from generating continuous Redis commands.
// At a 60s TTL, a 30s probe interval consumes 1 PING per 2 probes instead of 1 per probe.

import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { getAdvancedRedis } from "../../../../lib/queue/advanced";
import { validateEnv } from "../../../../lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REDIS_CACHE_TTL_MS = 60_000; // re-ping Redis at most once per minute
const DB_CACHE_TTL_MS    = 60_000; // re-query DB at most once per minute

interface CheckCache {
  ok:       boolean;
  error?:   string;
  cachedAt: number;
}

let _redisCache: CheckCache | null = null;
let _dbCache:    CheckCache | null = null;

function isFresh(cache: CheckCache | null, ttlMs: number): boolean {
  return cache !== null && Date.now() - cache.cachedAt < ttlMs;
}

async function checkRedis(): Promise<CheckCache> {
  if (isFresh(_redisCache, REDIS_CACHE_TTL_MS)) return _redisCache!;
  try {
    await getAdvancedRedis().ping();
    _redisCache = { ok: true, cachedAt: Date.now() };
  } catch (err) {
    _redisCache = { ok: false, error: (err as Error).message ?? "unknown", cachedAt: Date.now() };
  }
  return _redisCache;
}

async function checkDb(): Promise<CheckCache> {
  if (isFresh(_dbCache, DB_CACHE_TTL_MS)) return _dbCache!;
  try {
    await getDb().query("SELECT 1 AS ping");
    _dbCache = { ok: true, cachedAt: Date.now() };
  } catch (err) {
    _dbCache = { ok: false, error: (err as Error).message ?? "unknown", cachedAt: Date.now() };
  }
  return _dbCache;
}

export async function GET() {
  const start = Date.now();
  const env   = validateEnv();

  const [redis, db] = await Promise.all([checkRedis(), checkDb()]);

  const allOk   = env.ok && db.ok && redis.ok;
  const cached  = isFresh(_redisCache, REDIS_CACHE_TTL_MS) && isFresh(_dbCache, DB_CACHE_TTL_MS);

  return NextResponse.json(
    {
      status:    allOk ? "healthy" : "degraded",
      latencyMs: Date.now() - start,
      cached,
      checks: {
        env: {
          ok:      env.ok,
          missing: env.missing,
          absent:  env.absent,
          present: env.present.length,
        },
        db: {
          ok:    db.ok,
          error: db.error,
        },
        redis: {
          ok:    redis.ok,
          error: redis.error,
        },
      },
      ts: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  );
}
