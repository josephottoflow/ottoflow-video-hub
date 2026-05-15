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
import { createJob, upsertContentRow } from "@/lib/db";
import { enqueueRender } from "@/lib/queue";
import { emitLog, setStatus, clearLogs } from "@/lib/pipeline-store";

const ALL_TEMPLATES = ["listicle", "stats-story", "tutorial", "myth-buster", "quote-card", "cinematic"];

export async function POST(req: NextRequest) {
  const body             = await req.json().catch(() => ({})) as { rowIndex?: number; template?: string };
  const singleRowIndex   = typeof body.rowIndex  === "number" ? body.rowIndex  : undefined;
  const templateOverride = typeof body.template  === "string" ? body.template  : undefined;

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

      const template = templateOverride ?? RenderAgent.selectTemplate(row.topic, row.style);

      await upsertContentRow({
        row_index: row.rowIndex, topic: row.topic, style: row.style, voice: row.voice,
        hook_a: row.hookA, hook_b: row.hookB, hook_c: row.hookC, script: row.script,
      });

      const job = await createJob(row.rowIndex, row.topic, template);
      await enqueueRender({ rowIndex: row.rowIndex, template, topic: row.topic, dbJobId: job.id });
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

      const shuffled = [...ALL_TEMPLATES].sort(() => Math.random() - 0.5);
      const jobs = [];

      for (let i = 0; i < pending.length; i++) {
        const row      = pending[i];
        const template = shuffled[i % shuffled.length];

        await upsertContentRow({
          row_index: row.rowIndex, topic: row.topic, style: row.style, voice: row.voice,
          hook_a: row.hookA, hook_b: row.hookB, hook_c: row.hookC, script: row.script,
        });

        const job = await createJob(row.rowIndex, row.topic, template);
        await enqueueRender({ rowIndex: row.rowIndex, template, topic: row.topic, dbJobId: job.id });
        await sheets.updateStatus(row.rowIndex, "Queued");
        jobs.push({ id: job.id, topic: row.topic, template });
        emitLog("Orchestrator", `Queued: ${row.topic} (${template})`, "info");
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
