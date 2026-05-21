import { Queue } from "bullmq";
import IORedis from "ioredis";

export const redisConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
    lazyConnect:          true,
    enableReadyCheck:     false,
    // Keep TCP alive so Upstash doesn't close idle connections (ETIMEDOUT)
    keepAlive:            10_000,
    connectTimeout:       10_000,
    retryStrategy:        (times) => Math.min(times * 500, 5_000),
  }
);

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

export const renderQueue = new Queue<RenderJobData>(RENDER_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts:        2,
    backoff:         { type: "fixed", delay: 15_000 },
    removeOnComplete: 100,
    removeOnFail:    200,
  },
});

export async function enqueueRender(data: RenderJobData): Promise<string> {
  const delay = data.scheduledAt && data.scheduledAt > Date.now()
    ? data.scheduledAt - Date.now()
    : undefined;
  const job = await renderQueue.add("render-video", data, { jobId: data.dbJobId, ...(delay ? { delay } : {}) });
  return job.id!;
}
