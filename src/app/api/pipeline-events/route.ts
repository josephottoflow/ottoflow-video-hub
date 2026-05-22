/**
 * SSE endpoint — streams live pipeline logs to the Command Center.
 * Reads from Redis (for cross-machine worker→Vercel updates) and
 * in-memory store (for local dev same-process updates).
 * GET /api/pipeline-events
 */

import { store, type LogEntry } from "@/lib/pipeline-store";
import { rGetStatus, rGetLogs, rClearLogs } from "@/lib/pipeline-redis";

export const dynamic    = "force-dynamic";
export const maxDuration = 300; // Vercel Pro max — extends SSE lifetime from 60s → 5min

export async function DELETE() {
  try {
    await rClearLogs();
    store.logs = [];
    store.activeAgent = "";
    store.progress = 0;
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {}
      };

      // ── Initial snapshot: prefer Redis (has cross-machine data), fallback to memory ──
      const [redisStatus, redisLogs] = await Promise.all([
        rGetStatus().catch(() => null),
        rGetLogs(80).catch(() => [] as object[]),
      ]);

      const initStatus = (redisStatus && redisStatus.status !== "idle")
        ? { status: redisStatus.status, topic: redisStatus.topic, progress: redisStatus.progress }
        : { status: store.status, topic: store.currentTopic, progress: store.progress };

      const initLogs = redisLogs.length > 0 ? redisLogs : store.logs.slice(-80);

      send({ type: "init", ...initStatus, logs: initLogs });

      // ── Subscribe to in-memory updates (local dev, same process) ──
      const onLog    = (entry: LogEntry) => send({ type: "log", entry });
      const onStatus = (s: object)       => send({ type: "status", ...s });
      store.listeners.add(onLog);
      store.statusListeners.add(onStatus as never);

      // ── Poll Redis (picks up worker updates on remote machine) ──
      // Active: every 8s. Idle: every 30s. Saves ~75% of Upstash requests vs 2s.
      let lastLogTs  = (redisLogs as Array<{ ts?: string }>).at(-1)?.ts ?? "";
      let lastStatus = initStatus.status;
      let idleTicks  = 0;

      const ACTIVE_INTERVAL = 8_000;
      const IDLE_INTERVAL   = 30_000;
      let pollTimer: ReturnType<typeof setTimeout>;

      const doPoll = async () => {
        try {
          const isIdle = lastStatus === "idle";
          // When idle, skip most ticks to save Redis requests
          if (isIdle && idleTicks % Math.round(IDLE_INTERVAL / ACTIVE_INTERVAL) !== 0) {
            idleTicks++;
            pollTimer = setTimeout(doPoll, ACTIVE_INTERVAL);
            return;
          }
          idleTicks++;

          const [newStatus, freshLogs] = await Promise.all([
            rGetStatus(),
            rGetLogs(20),
          ]);

          // Push status change
          if (newStatus.status !== lastStatus || newStatus.progress !== initStatus.progress) {
            lastStatus = newStatus.status;
            idleTicks  = 0; // reset idle counter on state change
            send({ type: "status", status: newStatus.status, currentTopic: newStatus.topic, progress: newStatus.progress });
          }

          // Push only new log entries
          const newLogs = (freshLogs as Array<{ ts?: string }>).filter((l) => (l.ts ?? "") > lastLogTs);
          if (newLogs.length > 0) {
            lastLogTs = newLogs.at(-1)?.ts ?? lastLogTs;
            newLogs.forEach((entry) => send({ type: "log", entry }));
          }
        } catch { /* redis blip — skip tick */ }
        pollTimer = setTimeout(doPoll, ACTIVE_INTERVAL);
      };

      pollTimer = setTimeout(doPoll, ACTIVE_INTERVAL);

      // ── Heartbeat to keep Vercel connection alive ──
      const hb = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch {}
      }, 15_000);

      return () => {
        store.listeners.delete(onLog);
        store.statusListeners.delete(onStatus as never);
        clearTimeout(pollTimer);
        clearInterval(hb);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":      "text/event-stream",
      "Cache-Control":     "no-cache, no-transform",
      "Connection":        "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
