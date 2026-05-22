// Advanced Pipeline SSE — zero-polling event stream
//
// Architecture:
//   1. Client connects with ?p=id1&p=id2&workers=1&queue=1
//   2. Server sends an initial snapshot from DB (one query, no polling)
//   3. Server subscribes to Redis pub/sub channels
//   4. Every Redis message is forwarded to the SSE stream
//   5. Keepalive ping every 25s (prevents Vercel/proxy timeout)
//   6. On disconnect: subscriber connection is closed (no zombie threads)
//
// Redis commands: ~2 on connect, ~0 while idle, ~N during active renders
// Previous polling approach: ~7,500 commands/hour per client at 2s interval

import { NextRequest } from "next/server";
import { getDb } from "../../../../lib/db";
import { subscribe } from "../../../../lib/redis/pubsub";
import { getRecentEvents } from "../../../../pipeline/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pipelineIds = searchParams.getAll("p").filter(Boolean);
  const wantWorkers = searchParams.get("workers") === "1";
  const wantQueue   = searchParams.get("queue")   === "1";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Controller closed — subscriber cleanup will handle it
        }
      };

      // ── Initial snapshot ───────────────────────────────────────────────────
      try {
        // Pipeline states
        if (pipelineIds.length > 0) {
          const { rows } = await getDb().query(
            `SELECT id, status, current_stage, progress_pct, artifacts, error, worker_id
               FROM pipelines WHERE id = ANY($1::text[])`,
            [pipelineIds]
          );
          send({ type: "snapshot", pipelines: rows });

          // Last 50 events per pipeline
          for (const pid of pipelineIds) {
            const events = await getRecentEvents(pid, 50);
            if (events.length > 0) {
              send({ type: "event_replay", pipelineId: pid, events });
            }
          }
        }

        // Worker states
        if (wantWorkers) {
          const { rows } = await getDb().query(
            `SELECT id, status, tier, concurrency, version, last_seen
               FROM workers WHERE status IN ('online','draining')
               ORDER BY started_at DESC LIMIT 20`
          );
          send({ type: "workers_snapshot", workers: rows });
        }
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      }

      // ── Redis pub/sub subscription ──────────────────────────────────────────
      let unsubscribe: (() => Promise<void>) | null = null;

      try {
        unsubscribe = await subscribe(
          { pipelineIds, workers: wantWorkers, queue: wantQueue },
          (_channel, message) => {
            try {
              send(JSON.parse(message));
            } catch { /* malformed message — ignore */ }
          },
          (err) => console.warn("[advanced/events] Redis error:", err.message)
        );
      } catch (err) {
        send({ type: "error", message: `Failed to subscribe: ${(err as Error).message}` });
      }

      // ── Keepalive ───────────────────────────────────────────────────────────
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(ping);
        }
      }, 25_000);

      // ── Cleanup on disconnect ───────────────────────────────────────────────
      req.signal.addEventListener("abort", async () => {
        clearInterval(ping);
        await unsubscribe?.().catch(() => {});
        try { controller.close(); } catch { /* already closed */ }
      }, { once: true });
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
