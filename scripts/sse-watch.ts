/**
 * SSE validation monitor — streams /api/advanced/events for a pipeline
 * and prints each event with a timestamp.  Exits 0 on pipeline_done,
 * exits 1 on pipeline_failed or connection error.
 *
 * Usage:
 *   npx tsx scripts/sse-watch.ts <pipeline-id>           # watch one pipeline
 *   npx tsx scripts/sse-watch.ts <id1> <id2>             # watch two concurrently
 *   npx tsx scripts/sse-watch.ts --workers               # watch worker heartbeats only
 */
import "dotenv/config";

const BASE_URL    = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const args        = process.argv.slice(2);
const watchWorkers = args.includes("--workers");
const pipelineIds  = args.filter((a) => !a.startsWith("--"));

if (!watchWorkers && pipelineIds.length === 0) {
  console.error("Usage: npx tsx scripts/sse-watch.ts <pipeline-id> [<pipeline-id2> ...] [--workers]");
  process.exit(1);
}

const params = new URLSearchParams();
for (const id of pipelineIds) params.append("p", id);
if (watchWorkers) params.set("workers", "1");
params.set("queue", "1");

const url = `${BASE_URL}/api/advanced/events?${params}`;
console.log(`[sse-watch] ${new Date().toISOString()} connecting → ${url}`);
console.log(`[sse-watch] Watching: pipelines=[${pipelineIds.join(", ")}] workers=${watchWorkers}`);
console.log("─".repeat(80));

let terminalCount = 0;
const expected    = pipelineIds.length || 1;   // exit after all pipelines finish

async function run(): Promise<void> {
  const res = await fetch(url, { headers: { Accept: "text/event-stream" } });

  if (!res.ok || !res.body) {
    console.error(`[sse-watch] HTTP ${res.status} — could not connect`);
    process.exit(1);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buffer  = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) { console.log("[sse-watch] Stream ended"); break; }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer      = lines.pop() ?? "";

    for (const line of lines) {
      if (line === ": ping" || line === "") continue;

      if (line.startsWith("data: ")) {
        const ts = new Date().toISOString();
        try {
          const event = JSON.parse(line.slice(6));
          const { type, pipelineId, stage, progress, message } = event as Record<string, string>;

          // Compact single-line format: timestamp  TYPE  pipeline  detail
          const pid    = pipelineId ? pipelineId.slice(0, 8) : "       ";
          const detail = stage      ? `stage=${stage}`
                       : progress   ? `progress=${progress}%`
                       : message    ? message.slice(0, 60)
                       : "";

          console.log(`${ts}  ${String(type).padEnd(18)}  ${pid}  ${detail}`);

          if (type === "pipeline_done" || type === "pipeline_failed" || type === "pipeline_cancelled") {
            console.log(`\n[sse-watch] ── Terminal event: ${type} ──`);
            terminalCount++;
            if (terminalCount >= expected) {
              await reader.cancel();
              process.exit(type === "pipeline_done" ? 0 : 1);
            }
          }
        } catch {
          console.log(`RAW  ${line.slice(6, 120)}`);
        }
      }
    }
  }
}

run().catch((err) => {
  console.error("[sse-watch] Fatal:", err.message);
  process.exit(1);
});
