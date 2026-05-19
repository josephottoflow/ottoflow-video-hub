import { Queue } from "bullmq";
import { redisConnection, RENDER_QUEUE } from "@/lib/queue";
import { getWorkerHeartbeat, hasProcessingJob } from "@/lib/db";

let _queue: Queue | null = null;
function getQueue() {
  if (!_queue) _queue = new Queue(RENDER_QUEUE, { connection: redisConnection });
  return _queue;
}

export async function GET() {
  // Run all three checks in parallel — any one of them being true means the worker is online.
  const [bullResult, processingResult, heartbeatResult] = await Promise.allSettled([
    getQueue().getWorkers(),
    hasProcessingJob(),
    getWorkerHeartbeat(),
  ]);

  const workerCount   = bullResult.status      === "fulfilled" ? bullResult.value.length : 0;
  const isProcessing  = processingResult.status === "fulfilled" ? processingResult.value : false;
  const heartbeatDate = heartbeatResult.status  === "fulfilled" ? heartbeatResult.value  : null;

  const heartbeatAgeMs = heartbeatDate ? Date.now() - new Date(heartbeatDate).getTime() : Infinity;
  const heartbeatFresh = heartbeatAgeMs < 2 * 60 * 1000; // fresh if < 2 minutes old

  // Worker is online if ANY of the three signals says so:
  // 1. BullMQ heartbeat (unreliable for long renders, but fast)
  // 2. Postgres has a job actively processing (reliable — DB is updated by real worker code)
  // 3. Worker heartbeat timestamp is fresh (most accurate — written by worker every 30s)
  const online = workerCount > 0 || isProcessing || heartbeatFresh;

  return Response.json({
    online,
    count:              workerCount,
    hasProcessingJob:   isProcessing,
    heartbeatFresh,
    heartbeatAgeSeconds: heartbeatAgeMs === Infinity ? null : Math.round(heartbeatAgeMs / 1000),
  });
}
