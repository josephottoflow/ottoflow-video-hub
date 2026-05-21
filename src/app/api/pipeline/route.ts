/**
 * API: /api/pipeline
 * POST → Enqueue a render job (or multiple) into BullMQ/Redis.
 *        Previously ran inline; the render-worker process handles execution.
 *
 * Body: { rowIndex?: number, template?: string }
 *   - rowIndex omitted → enqueue ALL pending rows from Google Sheets
 *   - rowIndex provided → enqueue that single row
 */

import { NextRequest, NextResponse } from "next/server";
import { SheetsClient } from "@/agents/sheets/client";
import { RenderAgent } from "@/agents/render/render-agent";
import { createJob, upsertContentRow, getLastTemplatesForTopic } from "@/lib/db";
import { enqueueRender } from "@/lib/queue";
import type { RenderVariant } from "@/lib/queue";
import { emitLog, setStatus, clearLogs } from "@/lib/pipeline-store";

const ALL_TEMPLATES = ["listicle", "stats-story", "tutorial", "myth-buster", "quote-card", "cinematic"];
const ALL_VARIANTS: RenderVariant[] = ["problem-first", "stat-first", "story-arc", "myth-bust"];
const ALL_HOOK_STYLES = ["question", "bold-statement", "conflict", "promise", "shock", "story"];

function randomVariant(): RenderVariant { return ALL_VARIANTS[Math.floor(Math.random() * ALL_VARIANTS.length)]; }
function randomHookStyle(): string      { return ALL_HOOK_STYLES[Math.floor(Math.random() * ALL_HOOK_STYLES.length)]; }

export async function POST(req: NextRequest) {
  const body             = await req.json().catch(() => ({})) as { rowIndex?: number; template?: string; musicVibe?: string };
  const singleRowIndex   = typeof body.rowIndex  === "number" ? body.rowIndex  : undefined;
  const templateOverride = typeof body.template  === "string" ? body.template  : undefined;
  const musicVibe        = typeof body.musicVibe === "string" ? body.musicVibe : undefined;

  try {
    clearLogs();
    setStatus("running", "", 0);
    emitLog("Orchestrator", singleRowIndex !== undefined ? `Queuing row ${singleRowIndex}` : "Queuing all pending", "info");

    const sheets = new SheetsClient();
    await sheets.initializeSheet();

    if (singleRowIndex !== undefined) {
      // ── Single row ──────────────────────────────────────────────────────────
      const all = await sheets.getAllContent();
      const row = all.find((r) => r.rowIndex === singleRowIndex);
      if (!row) {
        return NextResponse.json({ error: `Row ${singleRowIndex} not found` }, { status: 404 });
      }

      const recentTemplates = await getLastTemplatesForTopic(row.topic);
      const template = templateOverride ?? await RenderAgent.selectTemplate(row.topic, row.style, recentTemplates);
      const renderVariant = randomVariant();
      const hookStyle     = randomHookStyle();

      await upsertContentRow({
        row_index: row.rowIndex, topic: row.topic, style: row.style, voice: row.voice,
        hook_a: row.hookA, hook_b: row.hookB, hook_c: row.hookC, script: row.script,
      });

      const job = await createJob(row.rowIndex, row.topic, template, { version: "v1", renderVariant, hookStyle, musicVibe });
      await enqueueRender({ rowIndex: row.rowIndex, template, topic: row.topic, dbJobId: job.id, renderVariant, hookStyle, musicVibe });
      await sheets.updateStatus(row.rowIndex, "Queued");

      setStatus("running", row.topic, 10);
      emitLog("Orchestrator", `Queued: ${row.topic} (${template}) → job ${job.id}`, "info");

      return NextResponse.json({ success: true, queued: 1, jobs: [{ id: job.id, topic: row.topic, template }] });

    } else {
      // ── All pending rows ────────────────────────────────────────────────────
      const pending = await sheets.getPendingContent();
      if (pending.length === 0) {
        emitLog("Orchestrator", "No pending content to queue", "info");
        setStatus("done", "", 100);
        return NextResponse.json({ success: true, queued: 0, jobs: [] });
      }

      const jobs = [];

      for (const row of pending) {
        const recentTemplates = await getLastTemplatesForTopic(row.topic);
        const template      = await RenderAgent.selectTemplate(row.topic, row.style, recentTemplates);
        const renderVariant = randomVariant();
        const hookStyle     = randomHookStyle();

        await upsertContentRow({
          row_index: row.rowIndex, topic: row.topic, style: row.style, voice: row.voice,
          hook_a: row.hookA, hook_b: row.hookB, hook_c: row.hookC, script: row.script,
        });

        const job = await createJob(row.rowIndex, row.topic, template, { version: "v1", renderVariant, hookStyle, musicVibe });
        await enqueueRender({ rowIndex: row.rowIndex, template, topic: row.topic, dbJobId: job.id, renderVariant, hookStyle, musicVibe });
        await sheets.updateStatus(row.rowIndex, "Queued");
        jobs.push({ id: job.id, topic: row.topic, template, renderVariant });
        emitLog("Orchestrator", `Queued: ${row.topic} (${template} / ${renderVariant})`, "info");
      }

      setStatus("running", "", 10);
      emitLog("Orchestrator", `${jobs.length} job(s) queued — start worker with: npm run worker`, "info");
      return NextResponse.json({ success: true, queued: jobs.length, jobs });
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    setStatus("error");
    emitLog("Orchestrator", `Fatal: ${message}`, "error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
