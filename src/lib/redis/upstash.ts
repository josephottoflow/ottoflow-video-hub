/**
 * Upstash Redis singleton — used exclusively for Vercel-accessible data:
 *   - pipeline status / logs  (pipeline-redis.ts)
 *   - pub/sub publisher + per-SSE-client subscribers  (pubsub.ts)
 *   - health ping from Vercel API routes
 *
 * BullMQ queues and lock operations use REDIS_URL (Railway Redis private network).
 * Status/log reads/writes use this connection (UPSTASH_URL) so Vercel can reach them.
 *
 * Fallback: if UPSTASH_URL is not set, falls back to REDIS_URL so the system works
 * during the transition period before env vars are updated.
 */

import IORedis, { type RedisOptions } from "ioredis";

const UPSTASH_OPTS: RedisOptions = {
  maxRetriesPerRequest: null,
  lazyConnect:          true,
  enableReadyCheck:     false,
  keepAlive:            10_000,
  connectTimeout:       10_000,
  commandTimeout:       15_000,
  retryStrategy:        (t) => Math.min(t * 500, 5_000),
};

let _redis: IORedis | null = null;

export function getUpstashRedis(): IORedis {
  if (!_redis) {
    const url = process.env.UPSTASH_URL ?? process.env.REDIS_URL ?? "redis://localhost:6379";
    _redis = new IORedis(url, UPSTASH_OPTS);
    _redis.on("error", (err) =>
      console.warn("[upstash-redis] connection error:", err.message)
    );
  }
  return _redis;
}

export const UPSTASH_URL =
  process.env.UPSTASH_URL ?? process.env.REDIS_URL ?? "redis://localhost:6379";
