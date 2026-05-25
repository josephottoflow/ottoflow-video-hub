// Basic render queue — lazy-initialized singletons
//
// SAFETY: No module-level IORedis or Queue instantiation.
// Created on first call, not at import time, so Next.js builds
// safely even when Redis is unreachable at build time.

import { Queue } from "bullmq";
import IORedis from "ioredis";

export const RENDER_QUEUE = "render";

export type RenderVariant = "problem-first" | "stat-first" | "story-arc" | "myth-bust";

export interface RenderJobData {
  rowIndex:       number;
  template:       string;
  topic:          string;
  dbJobId:        string;
  version?:       "v1" | "v2";
  sheetName?:     string;
  renderVariant?: RenderVariant;
  hookStyle?:     string;
  musicVibe?:     string;
  scheduledAt?:   number; // ms epoch — if set, job is delayed until this time
}

// ── Lazy singletons ────────────────────────────────────────────────────────────

let _redis: IORedis | null = null;
let _queue: Queue<RenderJobData> | null = null;

export function getRenderRedis(): IORedis {
  if (!_redis) {
    _redis = new IORedis(
      process.env.REDIS_URL || "redis://localhost:6379",
      {
        maxRetriesPerRequest: null,
        lazyConnect:          true,
        enableReadyCheck:     false,
        keepAlive:            10_000,
        connectTimeout:       10_000,
        commandTimeout:       15_000,  // abort hung commands — prevents lock-renewal hangs on silent drops
        retryStrategy:        (times) => Math.min(times * 500, 5_000),
      }
    );
    _redis.on("error", (err) =>
      console.warn("[render-redis] connection error:", err.message)
    );
  }
  return _redis;
}

export function getRenderQueue(): Queue<RenderJobData> {
  if (!_queue) {
    _queue = new Queue<RenderJobData>(RENDER_QUEUE, {
      connection: getRenderRedis(),
      defaultJobOptions: {
        attempts:         2,
        backoff:          { type: "fixed", delay: 15_000 },
        removeOnComplete: 100,
        removeOnFail:     200,
      },
    });
    _queue.on("error", (err) =>
      console.warn("[render-queue] error:", err.message)
    );
  }
  return _queue;
}

export async function enqueueRender(data: RenderJobData): Promise<string> {
  const delay = data.scheduledAt && data.scheduledAt > Date.now()
    ? data.scheduledAt - Date.now()
    : undefined;
  const job = await getRenderQueue().add(
    "render-video",
    data,
    { jobId: data.dbJobId, ...(delay ? { delay } : {}) }
  );
  return job.id!;
}
