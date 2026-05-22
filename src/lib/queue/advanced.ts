// Advanced pipeline queue — separate from the legacy basic "render" queue
//
// Design:
//   - Queue name: "advanced:pipeline" (never conflicts with legacy queue)
//   - Job ID = pipelineId (idempotent — prevents duplicate queuing)
//   - Priority 1-10 (1=highest)
//   - All pipeline state lives in Postgres — BullMQ is purely a trigger
//   - removeOnComplete: keeps last 200 for debugging; removeOnFail: keeps last 500

import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { PipelineConfig } from "../../pipeline/types";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const advancedRedis = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect:          true,
  enableReadyCheck:     false,
  keepAlive:            10_000,
  connectTimeout:       10_000,
  retryStrategy:        (t) => Math.min(t * 500, 5_000),
});

export const ADVANCED_QUEUE = "advanced:pipeline";

export interface AdvancedPipelineJob {
  pipelineId: string;
  config:     PipelineConfig;
}

export const advancedQueue = new Queue<AdvancedPipelineJob>(ADVANCED_QUEUE, {
  connection: advancedRedis,
  defaultJobOptions: {
    attempts:         1,          // retries are handled inside the engine, not BullMQ
    removeOnComplete: { count: 200 },
    removeOnFail:     { count: 500 },
  },
});

/** Enqueue a pipeline. Idempotent — duplicate pipelineIds are silently deduplicated. */
export async function enqueueAdvancedPipeline(
  pipelineId: string,
  config:     PipelineConfig,
  priority    = 5
): Promise<string> {
  const job = await advancedQueue.add(
    "run-pipeline",
    { pipelineId, config },
    {
      jobId:    pipelineId,   // idempotent key
      priority: Math.max(1, Math.min(10, priority)),
    }
  );
  return job.id!;
}

/** Returns current queue depth (waiting + active). */
export async function getQueueStats(): Promise<{ waiting: number; active: number; delayed: number }> {
  const [waiting, active, delayed] = await Promise.all([
    advancedQueue.getWaitingCount(),
    advancedQueue.getActiveCount(),
    advancedQueue.getDelayedCount(),
  ]);
  return { waiting, active, delayed };
}
