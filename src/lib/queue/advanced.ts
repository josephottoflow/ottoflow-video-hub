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
  commandTimeout:       15_000,  // abort hung commands — prevents lock-renewal hangs on silent drops
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

/** Enqueue a pipeline.
 *  On Vercel (WORKER_QUEUE_URL set): POSTs to Railway worker HTTP proxy so the job
 *  lands on Railway's private Redis BullMQ — not Upstash.
 *  On worker / local dev: enqueues directly to BullMQ.
 */
export async function enqueueAdvancedPipeline(
  pipelineId: string,
  config:     PipelineConfig,
  priority    = 5
): Promise<string> {
  const workerUrl = process.env.WORKER_QUEUE_URL;
  if (workerUrl) {
    const res = await fetch(`${workerUrl}/api/queue`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${process.env.NEXTAUTH_SECRET ?? ""}`,
      },
      body: JSON.stringify({ pipelineId, config, priority }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Worker queue HTTP ${res.status}: ${text}`);
    }
    const json = await res.json() as { jobId: string };
    return json.jobId;
  }

  // Direct BullMQ path — worker process itself and local dev
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
