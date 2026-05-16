/**
 * SSE endpoint — streams live pipeline logs to the Command Center.
 * Reads from Redis (for cross-machine worker→Vercel updates) and
 * in-memory store (for local dev same-process updates).
 * GET /api/pipeline-events
 */

import { store, type LogEntry } from "@/lib/pipeline-store";
import { rGetStatus, rGetLogs } from "@/lib/pipeline-redis";

export const dynamic = "force-dynamic";

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

      // ── Poll Redis every 2s (picks up worker updates on remote machine) ──
      let lastLogTs = (redisLogs as Array<{ ts?: string }>).at(-1)?.ts ?? "";
      let lastStatus = initStatus.status;

      const poll = setInterval(async () => {
        try {
          const [newStatus, freshLogs] = await Promise.all([
            rGetStatus(),
            rGetLogs(20),
          ]);

          // Push status change
          if (newStatus.status !== lastStatus || newStatus.progress !== initStatus.progress) {
            lastStatus = newStatus.status;
            send({ type: "status", status: newStatus.status, currentTopic: newStatus.topic, progress: newStatus.progress });
          }

          // Push only new log entries
          const newLogs = (freshLogs as Array<{ ts?: string }>).filter((l) => (l.ts ?? "") > lastLogTs);
          if (newLogs.length > 0) {
            lastLogTs = newLogs.at(-1)?.ts ?? lastLogTs;
            newLogs.forEach((entry) => send({ type: "log", entry }));
          }
        } catch { /* redis blip — skip tick */ }
      }, 2000);

      // ── Heartbeat to keep Vercel connection alive ──
      const hb = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch {}
      }, 15_000);

      return () => {
        store.listeners.delete(onLog);
        store.statusListeners.delete(onStatus as never);
        clearInterval(poll);
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
