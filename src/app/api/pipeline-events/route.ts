/**
 * SSE endpoint — streams live pipeline logs to the Command Center.
 * GET /api/pipeline-events
 */

import { store, type LogEntry } from "@/lib/pipeline-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {}
      };

      // Send current state snapshot immediately
      send({
        type:   "init",
        status: store.status,
        topic:  store.currentTopic,
        agent:  store.activeAgent,
        progress: store.progress,
        logs:   store.logs.slice(-80), // last 80 entries on connect
      });

      // Subscribe to new log entries
      const onLog = (entry: LogEntry) => send({ type: "log", entry });
      store.listeners.add(onLog);

      // Subscribe to status changes
      const onStatus = (s: object) => send({ type: "status", ...s });
      store.statusListeners.add(onStatus as any);

      // Heartbeat every 15s to keep connection alive
      const hb = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch {}
      }, 15000);

      // Cleanup on disconnect
      return () => {
        store.listeners.delete(onLog);
        store.statusListeners.delete(onStatus as any);
        clearInterval(hb);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
