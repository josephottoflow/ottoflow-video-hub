/**
 * POST /api/jobs/reset
 * Kills all pending/processing jobs:
 *   1. Marks them as error in Postgres
 *   2. Drains the BullMQ queue in Redis (so the worker doesn't re-pick them up)
 *   3. Resets pipeline status to idle
 */
import { Queue } from "bullmq";
import { getDb } from "@/lib/db";
import { rSetStatus } from "@/lib/pipeline-redis";
import { redisConnection, RENDER_QUEUE } from "@/lib/queue";

export async function POST() {
  try {
    // 1. Mark all pending + processing jobs as error in DB
    const result = await getDb().query(
      `UPDATE jobs
       SET status = 'error',
           error  = 'Manually killed by user',
           completed_at = NOW()
       WHERE status IN ('pending', 'processing')`
    );

    // 2. Drain BullMQ queue — removes all waiting jobs from Redis
    const q = new Queue(RENDER_QUEUE, { connection: redisConnection });
    await q.drain().catch(() => {});
    await q.clean(0, 100, "wait").catch(() => {});
    await q.clean(0, 100, "active").catch(() => {});
    await q.close().catch(() => {});

    // 3. Reset pipeline status in Redis
    await rSetStatus("idle", "", 0).catch(() => {});

    return Response.json({ ok: true, killed: result.rowCount ?? 0 });
  } catch (err) {
    return Response.json({ ok: false, message: String(err) }, { status: 500 });
  }
}
