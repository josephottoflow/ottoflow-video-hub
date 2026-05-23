// Advanced pipeline queue — lazy-initialized singletons
//
// SAFETY: No module-level IORedis or Queue instantiation.
// Both are created on first call, not at import time.
// This prevents Next.js from opening Redis connections during the build phase,
// which would cause "ECONNREFUSED" errors on Vercel if Redis is not reachable
// at build time, and was the root cause of the "Queue name cannot contain :"
// class of deployment failures.

import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { PipelineConfig } from "../../pipeline/types";

const REDIS_OPTS = {
  maxRetriesPerRequest: null,
  lazyConnect:          true,
  enableReadyCheck:     false,
  keepAlive:            10_000,
  connectTimeout:       10_000,
  retryStrategy:        (t: number) => Math.min(t * 500, 5_000),
} as const;

export const ADVANCED_QUEUE = "advanced-pipeline";

export interface AdvancedPipelineJob {
  pipelineId: string;
  config:     PipelineConfig;
}

// ── Lazy singletons — created on first use, never at import time ──────────────

let _redis: IORedis | null = null;
let _queue: Queue<AdvancedPipelineJob> | null = null;

export function getAdvancedRedis(): IORedis {
  if (!_redis) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _redis = new IORedis(url, REDIS_OPTS);
    _redis.on("error", (err) =>
      console.warn("[advanced-redis] connection error:", err.message)
    );
  }
  return _redis;
}

export function getAdvancedQueue(): Queue<AdvancedPipelineJob> {
  if (!_queue) {
    _queue = new Queue<AdvancedPipelineJob>(ADVANCED_QUEUE, {
      connection: getAdvancedRedis(),
      defaultJobOptions: {
        attempts:         1,          // retries handled inside the engine
        removeOnComplete: { count: 200 },
        removeOnFail:     { count: 500 },
      },
    });
    _queue.on("error", (err) =>
      console.warn("[advanced-queue] error:", err.message)
    );
  }
  return _queue;
}

/** Enqueue a pipeline. Idempotent — duplicate pipelineIds are silently deduplicated. */
export async function enqueueAdvancedPipeline(
  pipelineId: string,
  config:     PipelineConfig,
  priority    = 5
): Promise<string> {
  const job = await getAdvancedQueue().add(
    "run-pipeline",
    { pipelineId, config },
    {
      jobId:    pipelineId,
      priority: Math.max(1, Math.min(10, priority)),
    }
  );
  return job.id!;
}

/** Returns current queue depth (waiting + active + delayed). */
export async function getQueueStats(): Promise<{
  waiting: number;
  active:  number;
  delayed: number;
}> {
  const q = getAdvancedQueue();
  const [waiting, active, delayed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getDelayedCount(),
  ]);
  return { waiting, active, delayed };
}
