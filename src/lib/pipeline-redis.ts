/**
 * Redis-backed pipeline status — works across the worker↔Vercel boundary.
 * Worker writes here; Vercel SSE polls here.
 */

import { getRenderRedis } from "./queue";

const STATUS_KEY = "pipeline:status";
const LOGS_KEY   = "pipeline:logs";

export interface RedisStatus {
  status:   string;
  topic:    string;
  progress: number;
}

export async function rSetStatus(status: string, topic = "", progress = 0): Promise<void> {
  await getRenderRedis().hset(STATUS_KEY, {
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
  await getRenderRedis().lpush(LOGS_KEY, entry);
  await getRenderRedis().ltrim(LOGS_KEY, 0, 149); // keep last 150 entries
}

export async function rGetStatus(): Promise<RedisStatus> {
  const d = await getRenderRedis().hgetall(STATUS_KEY);
  if (!d || !d.status) return { status: "idle", topic: "", progress: 0 };
  return { status: d.status, topic: d.topic ?? "", progress: Number(d.progress ?? 0) };
}

export async function rGetLogs(n = 80): Promise<object[]> {
  const raw = await getRenderRedis().lrange(LOGS_KEY, 0, n - 1);
  return raw
    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean)
    .reverse() as object[];
}

export async function rClearLogs(): Promise<void> {
  await getRenderRedis().del(LOGS_KEY);
  await rSetStatus("idle", "", 0);
}
