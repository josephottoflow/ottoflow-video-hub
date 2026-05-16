/**
 * Global pipeline event store.
 * In-memory for local dev (same process). Also writes to Redis so the
 * Vercel SSE endpoint and local worker share state across machines.
 */
import { rSetStatus, rPushLog, rClearLogs } from "./pipeline-redis";

export type LogLevel = "info" | "success" | "error" | "warning" | "agent";

export interface LogEntry {
  id:      number;
  ts:      string;
  agent:   string;
  message: string;
  level:   LogLevel;
}

export type PipelineStatus = "idle" | "running" | "done" | "error";

interface PipelineStore {
  status:       PipelineStatus;
  currentTopic: string;
  activeAgent:  string;
  progress:     number; // 0–100
  logs:         LogEntry[];
  listeners:    Set<(entry: LogEntry) => void>;
  statusListeners: Set<(s: Partial<PipelineStore>) => void>;
}

let _id = 0;

export const store: PipelineStore = {
  status:          "idle",
  currentTopic:    "",
  activeAgent:     "",
  progress:        0,
  logs:            [],
  listeners:       new Set(),
  statusListeners: new Set(),
};

export function emitLog(agent: string, message: string, level: LogLevel = "info") {
  const entry: LogEntry = { id: ++_id, ts: new Date().toISOString(), agent, message, level };
  store.logs.push(entry);
  if (store.logs.length > 300) store.logs.shift();
  store.activeAgent = agent;
  store.listeners.forEach((fn) => fn(entry));
  rPushLog(agent, message, level).catch(() => {});
}

export function setStatus(status: PipelineStatus, topic?: string, progress?: number) {
  store.status = status;
  if (topic    !== undefined) store.currentTopic = topic;
  if (progress !== undefined) store.progress = progress;
  store.statusListeners.forEach((fn) =>
    fn({ status: store.status, currentTopic: store.currentTopic, progress: store.progress })
  );
  rSetStatus(status, store.currentTopic, store.progress).catch(() => {});
}

export function clearLogs() {
  store.logs = [];
  store.activeAgent = "";
  store.progress = 0;
  rClearLogs().catch(() => {});
}

/** Map a console.log line (from orchestrator) to an agent name. */
export function inferAgent(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("script writer") || m.includes("missing script"))        return "Script Writer";
  if (m.includes("storyboard"))                                           return "Storyboard";
  if (m.includes("design spec") || m.includes("design agent"))            return "Design Agent";
  if (m.includes("music") || m.includes("pixabay") || m.includes("track")) return "Music Director";
  if (m.includes("seo") || m.includes("hashtag") || m.includes("metadata"))   return "SEO Agent";
  if (m.includes("pexels") || m.includes("background"))                        return "Pexels Client";
  if (m.includes("rendering") || m.includes("render agent") || m.includes("[render]")) return "Render Agent";
  if (m.includes("ffmpeg"))                                               return "FFmpeg Agent";
  if (m.includes("telegram") || m.includes("delivering"))                return "Telegram Bot";
  if (m.includes("claude") || m.includes("video structure"))             return "Prompt Engine";
  if (m.includes("branding") || m.includes("brand"))                     return "Branding Agent";
  if (m.includes("sheet") || m.includes("pending") || m.includes("processing")) return "Sheets Client";
  if (m.includes("exporting") || m.includes("export"))                   return "Exporter";
  return "Orchestrator";
}

export function inferLevel(msg: string): LogLevel {
  const m = msg.toLowerCase();
  if (m.includes("error") || m.includes("failed") || m.includes("✗")) return "error";
  if (m.includes("warn"))                                               return "warning";
  if (m.includes("done") || m.includes("complete") || m.includes("✓") || m.includes("delivered")) return "success";
  if (m.includes("starting") || m.includes("generating") || m.includes("rendering") || m.includes("selecting") || m.includes("delivering")) return "agent";
  return "info";
}
