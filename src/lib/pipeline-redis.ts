/**
 * Redis-backed pipeline status — works across the worker↔Vercel boundary.
 * Worker writes here; Vercel SSE polls here.
 */

import { redisConnection } from "./queue";

const STATUS_KEY = "pipeline:status";
const LOGS_KEY   = "pipeline:logs";

export interface RedisStatus {
  status:   string;
  topic:    string;
  progress: number;
}

export async function rSetStatus(status: string, topic = "", progress = 0): Promise<void> {
  await redisConnection.hset(STATUS_KEY, {
    status,
    topic,
    progress: String(progress),
    ts:       new Date().toISOString(),
  });
}

export async function rPushLog(agent: string, message: string, level: string): Promise<void> {
  const entry = JSON.stringify({
    id:      Date.now(),
    ts:      new Date().toISOString(),
    agent,
    message,
    level,
  });
  await redisConnection.lpush(LOGS_KEY, entry);
  await redisConnection.ltrim(LOGS_KEY, 0, 149); // keep last 150 entries
}

export async function rGetStatus(): Promise<RedisStatus> {
  const d = await redisConnection.hgetall(STATUS_KEY);
  if (!d || !d.status) return { status: "idle", topic: "", progress: 0 };
  return { status: d.status, topic: d.topic ?? "", progress: Number(d.progress ?? 0) };
}

export async function rGetLogs(n = 80): Promise<object[]> {
  const raw = await redisConnection.lrange(LOGS_KEY, 0, n - 1);
  return raw
    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean)
    .reverse() as object[];
}

export async function rClearLogs(): Promise<void> {
  await redisConnection.del(LOGS_KEY);
  await rSetStatus("idle", "", 0);
}
