import { Queue } from "bullmq";
import { redisConnection, RENDER_QUEUE } from "@/lib/queue";

let _queue: Queue | null = null;
function getQueue() {
  if (!_queue) _queue = new Queue(RENDER_QUEUE, { connection: redisConnection });
  return _queue;
}

export async function GET() {
  try {
    const workers = await getQueue().getWorkers();
    return Response.json({ online: workers.length > 0, count: workers.length });
  } catch {
    return Response.json({ online: false, count: 0 });
  }
}
