import { BASE_URL } from "./api";

export interface SseEvent {
  type:        string;
  pipelineId?: string;
  stage?:      string;
  progress?:   number;
  message?:    string;
  ts?:         string;
  [key: string]: unknown;
}

export interface SseCollectResult {
  events:       SseEvent[];
  timedOut:     boolean;
  terminalType?: string;
  durationMs:   number;
}

const TERMINAL_TYPES = new Set(["pipeline_done", "pipeline_failed", "pipeline_cancelled"]);

/**
 * Connect to the SSE events endpoint and collect events until:
 *  - A terminal event (pipeline_done / pipeline_failed / pipeline_cancelled) is received
 *    for ALL requested pipeline IDs, OR
 *  - The timeout elapses.
 *
 * Returns the full ordered event log with metadata.
 */
export async function collectSseEvents(
  pipelineIds: string[],
  opts: {
    timeoutMs?:   number;
    watchWorkers?: boolean;
    watchQueue?:  boolean;
  } = {}
): Promise<SseCollectResult> {
  const { timeoutMs = 25 * 60 * 1_000, watchWorkers = false, watchQueue = true } = opts;

  const params = new URLSearchParams();
  for (const id of pipelineIds) params.append("p", id);
  if (watchWorkers) params.set("workers", "1");
  if (watchQueue)   params.set("queue",   "1");

  const url    = `${BASE_URL}/api/advanced/events?${params}`;
  const start  = Date.now();
  const events: SseEvent[] = [];
  const doneIds = new Set<string>();
  let   timedOut    = false;
  let   terminalType: string | undefined;

  const ac = new AbortController();
  const timer = setTimeout(() => { timedOut = true; ac.abort(); }, timeoutMs);

  try {
    const res = await fetch(url, {
      headers: { Accept: "text/event-stream" },
      signal:  ac.signal,
    });

    if (!res.ok || !res.body) {
      clearTimeout(timer);
      return { events, timedOut: false, durationMs: Date.now() - start };
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    outer: while (true) {
      let chunk: { done: boolean; value?: Uint8Array };
      try {
        chunk = await reader.read();
      } catch {
        break;
      }

      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });

      const lines = buffer.split("\n");
      buffer      = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6)) as SseEvent;
          event._receivedAt = new Date().toISOString();
          events.push(event);

          if (event.pipelineId && TERMINAL_TYPES.has(event.type)) {
            terminalType = event.type;
            doneIds.add(event.pipelineId);
            if (doneIds.size >= pipelineIds.length) {
              break outer;
            }
          }
        } catch { /* malformed event — skip */ }
      }
    }

    reader.cancel().catch(() => {});
  } catch (err: unknown) {
    if (!timedOut) throw err;
  } finally {
    clearTimeout(timer);
  }

  return { events, timedOut, terminalType, durationMs: Date.now() - start };
}

// ── Event analysis helpers ────────────────────────────────────────────────────

export function eventsByType(events: SseEvent[], type: string): SseEvent[] {
  return events.filter((e) => e.type === type);
}

export function eventsForPipeline(events: SseEvent[], pipelineId: string): SseEvent[] {
  return events.filter((e) => !e.pipelineId || e.pipelineId === pipelineId);
}

export function progressValues(events: SseEvent[]): number[] {
  return events
    .filter((e) => e.type === "progress" && typeof e.progress === "number")
    .map((e) => e.progress as number);
}

export function isMonotonic(values: number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (values[i] < values[i - 1]) return false;
  }
  return true;
}

export function checkChannelIsolation(
  events: SseEvent[],
  ownIds: Set<string>
): { clean: boolean; leakedIds: string[] } {
  const leaked = events
    .filter((e) => e.pipelineId && !ownIds.has(e.pipelineId))
    .map((e) => e.pipelineId as string);
  return { clean: leaked.length === 0, leakedIds: [...new Set(leaked)] };
}
