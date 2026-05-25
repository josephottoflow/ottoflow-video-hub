// Redis pub/sub layer
//
// Architecture:
//   - One shared publisher connection (Upstash — reachable by both worker and Vercel SSE)
//   - One dedicated subscriber connection per SSE client (Upstash, created on subscribe, destroyed on disconnect)
//   - Channels:
//       pipeline:{id}   → per-pipeline stage events, progress, logs
//       workers         → heartbeat, worker status
//       queue:advanced  → queue depth stats
//
// Publisher and subscriber MUST use the same Redis instance (Upstash) so pub/sub
// messages cross the Railway↔Vercel boundary. BullMQ uses Railway Redis separately.
//
// Idle system: ~0 Redis commands/s (no polling).
// Active render: ~5-20 commands/s (one publish per event).

import IORedis, { type RedisOptions } from "ioredis";
import type { PipelineEvent } from "../../pipeline/types";
import { getUpstashRedis, UPSTASH_URL } from "./upstash";

// Subscriber connections need their own options (lazyConnect: false, dedicated connection per SSE client)
const SUBSCRIBER_OPTS: RedisOptions = {
  maxRetriesPerRequest: null,
  lazyConnect:          false,
  enableReadyCheck:     false,
  keepAlive:            10_000,
  connectTimeout:       10_000,
  commandTimeout:       15_000,
  retryStrategy:        (t) => Math.min(t * 500, 5_000),
};

// ── Publisher — reuses getUpstashRedis() singleton ───────────────────────────
// Must be on Upstash (not Railway Redis) so Vercel SSE subscribers receive messages.
// PUBLISH is a normal command; it shares the existing Upstash connection without
// opening a dedicated extra connection.

export async function publishPipelineEvent(event: PipelineEvent): Promise<void> {
  await getUpstashRedis().publish(`pipeline:${event.pipelineId}`, JSON.stringify(event));
}

export async function publishWorkerHeartbeat(workerId: string, payload: object): Promise<void> {
  await getUpstashRedis().publish("workers", JSON.stringify({ type: "worker_heartbeat", workerId, ...payload, ts: new Date().toISOString() }));
}

export async function publishQueueStats(payload: object): Promise<void> {
  await getUpstashRedis().publish("queue:advanced", JSON.stringify({ type: "queue_stats", ...payload, ts: new Date().toISOString() }));
}

// ── Subscribe (dedicated connection per SSE client) ───────────────────────────

export interface SubscribeOptions {
  pipelineIds?: string[];   // subscribe to these pipeline channels
  workers?:     boolean;    // subscribe to worker heartbeats
  queue?:       boolean;    // subscribe to queue stats
}

export type MessageHandler = (channel: string, message: string) => void;

/**
 * Subscribe to Redis channels and call `onMessage` for each message.
 * Returns an `unsubscribe` function — call it when the SSE client disconnects.
 */
export async function subscribe(
  opts:       SubscribeOptions,
  onMessage:  MessageHandler,
  onError?:   (err: Error) => void
): Promise<() => Promise<void>> {
  // Each subscriber gets its own connection — uses Upstash URL so Vercel can reach it
  const sub = new IORedis(UPSTASH_URL, SUBSCRIBER_OPTS);

  const channels: string[] = [];
  if (opts.pipelineIds?.length) {
    channels.push(...opts.pipelineIds.map((id) => `pipeline:${id}`));
  }
  if (opts.workers)  channels.push("workers");
  if (opts.queue)    channels.push("queue:advanced");

  if (channels.length > 0) {
    await sub.subscribe(...channels);
  }

  sub.on("message",  onMessage);
  sub.on("error",    (err) => onError?.(err));

  return async () => {
    sub.off("message", onMessage);
    await sub.quit().catch(() => sub.disconnect());
  };
}
