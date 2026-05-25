/**
 * Redis-backed pipeline status — works across the worker↔Vercel boundary.
 * Worker writes here; Vercel SSE polls here.
 */

import { getUpstashRedis } from "./redis/upstash";

const STATUS_KEY = "pipeline:status";
const LOGS_KEY   = "pipeline:logs";

export interface RedisStatus {
  status:   string;
  topic:    string;
  progress: number;
}

export async function rSetStatus(status: string, topic = "", progress = 0): Promise<void> {
  await getUpstashRedis().hset(STATUS_KEY, {
    status,
    topic,
    progress: String(progress),
    ts:       new Date().toISOString(),
  });
}

// Throttle: emit info/agent/warning lines to Redis at most once per 2s.
// Errors and successes always go through immediately.
// This prevents the console.log override from flooding Upstash with 100-300
// extra commands per render (each log line was 2 separate round-trips).
let _lastLogMs = 0;
const LOG_THROTTLE_MS = 2_000;

export async function rPushLog(agent: string, message: string, level: string): Promise<void> {
  const now = Date.now();
  if (level !== "error" && level !== "success" && now - _lastLogMs < LOG_THROTTLE_MS) return;
  _lastLogMs = now;

  const entry = JSON.stringify({ id: now, ts: new Date().toISOString(), agent, message, level });
  // Single pipeline call — halves round-trips vs two separate awaits
  await getUpstashRedis().pipeline()
    .lpush(LOGS_KEY, entry)
    .ltrim(LOGS_KEY, 0, 149)
    .exec();
}

export async function rGetStatus(): Promise<RedisStatus> {
  const d = await getUpstashRedis().hgetall(STATUS_KEY);
  if (!d || !d.status) return { status: "idle", topic: "", progress: 0 };
  return { status: d.status, topic: d.topic ?? "", progress: Number(d.progress ?? 0) };
}

export async function rGetLogs(n = 80): Promise<object[]> {
  const raw = await getUpstashRedis().lrange(LOGS_KEY, 0, n - 1);
  return raw
    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean)
    .reverse() as object[];
}

export async function rClearLogs(): Promise<void> {
  await getUpstashRedis().del(LOGS_KEY);
  await rSetStatus("idle", "", 0);
}
