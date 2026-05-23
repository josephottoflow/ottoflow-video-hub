import { TestRunner }           from "../lib/runner";
import { api }                  from "../lib/api";
import { getPipeline, getStages } from "../lib/db";
import {
  collectSseEvents,
  eventsByType,
  progressValues,
  isMonotonic,
  checkChannelIsolation,
} from "../lib/sse";

const TIMEOUT = 25 * 60 * 1_000;

export async function run(t: TestRunner): Promise<void> {
  t.begin("06 — SSE event correctness");

  let id = "";

  try {
    // Enqueue a pipeline specifically for SSE inspection
    const enqueue = await api.post<{ pipelineId: string }>(
      "/api/advanced/pipeline",
      { topic: "SSE synchronization validation", style: "Educational", voice: "Female energetic" }
    );
    t.assert("Enqueue returns 200", enqueue.ok, enqueue.status, 200);
    id = enqueue.body.pipelineId;
    t.record("pipelineId", id);

    // Collect all events until terminal
    console.log("  │   Collecting full SSE transcript...");
    const sse = await collectSseEvents([id], { timeoutMs: TIMEOUT });
    t.assert("SSE connection did not time out", !sse.timedOut, sse.timedOut, false);
    t.record("totalEvents",  sse.events.length);
    t.record("durationMs",   sse.durationMs);

    // ── Event completeness ────────────────────────────────────────────────────

    const pipelineStarted = eventsByType(sse.events, "pipeline_started");
    const pipelineDone    = eventsByType(sse.events, "pipeline_done");
    const stageStarts     = eventsByType(sse.events, "stage_started");
    const stageDones      = eventsByType(sse.events, "stage_done");
    const progressEvents  = eventsByType(sse.events, "progress");

    t.assert("pipeline_started appears once",      pipelineStarted.length === 1, pipelineStarted.length, 1);
    t.assert("pipeline_done appears exactly once", pipelineDone.length === 1,    pipelineDone.length,    1);
    t.assertEqual("stage_done count = stage_started count", stageDones.length, stageStarts.length);
    t.assertGt("At least one progress event",      progressEvents.length, 0);
    t.record("stageStartCount",  stageStarts.length);
    t.record("stageDoneCount",   stageDones.length);
    t.record("progressEventCount", progressEvents.length);

    // ── Event ordering ────────────────────────────────────────────────────────

    // pipeline_done must be the last significant event
    const lastTerminalIdx = sse.events.findIndex((e) => e.type === "pipeline_done");
    const eventsAfterDone = sse.events.slice(lastTerminalIdx + 1)
      .filter((e) => e.type !== "queue_stats" && e.type !== "worker_heartbeat");
    t.assert("No meaningful events after pipeline_done",
      eventsAfterDone.length === 0, eventsAfterDone.map((e) => e.type));

    // pipeline_started must appear before any stage_started
    const firstStageStartIdx = sse.events.findIndex((e) => e.type === "stage_started");
    const pipelineStartedIdx = sse.events.findIndex((e) => e.type === "pipeline_started");
    if (firstStageStartIdx !== -1 && pipelineStartedIdx !== -1) {
      t.assert("pipeline_started before first stage_started",
        pipelineStartedIdx < firstStageStartIdx,
        `pipeline_started@${pipelineStartedIdx} stage_started@${firstStageStartIdx}`);
    }

    // ── Progress monotonicity ─────────────────────────────────────────────────

    const progress = progressValues(sse.events);
    t.assert("Progress values are monotonically non-decreasing",
      isMonotonic(progress), progress.join(","));
    t.assert("Final progress reaches 100",
      progress[progress.length - 1] === 100,
      progress[progress.length - 1], 100);

    // ── Channel isolation ─────────────────────────────────────────────────────

    const isolation = checkChannelIsolation(sse.events, new Set([id]));
    t.assert("No events from foreign pipeline IDs", isolation.clean, isolation.leakedIds);

    // ── Stage symmetry — each stage_started has a matching stage_done ─────────

    const startedStages = stageStarts.map((e) => e.stage as string);
    const doneStages    = stageDones.map((e) => e.stage as string);
    const orphaned      = startedStages.filter((s) => !doneStages.includes(s));
    t.assert("Every stage_started has a stage_done", orphaned.length === 0, orphaned);

    // ── Cross-reference with DB ───────────────────────────────────────────────

    const dbStages = await getStages(id);
    const dbDoneCount = dbStages.filter((s) => s.status === "done" || s.status === "skipped").length;
    t.assertEqual("DB done-stage count matches SSE stage_done count", dbDoneCount, stageDones.length);

    const pipeline = await getPipeline(id);
    t.assertEqual("DB status is done", pipeline?.status, "done");

    // ── Duplicate detection ───────────────────────────────────────────────────

    const pipelineDoneCount = pipelineDone.length;
    t.assertEqual("pipeline_done fires exactly once (no duplicates)", pipelineDoneCount, 1);

    t.pass();
  } catch (err) {
    if (id) t.record("pipelineId", id);
    t.fail(err);
  }
}
