/**
 * API: /api/pipeline/v2
 * POST → Enqueue a V2 Advanced render job into BullMQ/Redis.
 *
 * Body: { rowIndex?: number }
 *   - rowIndex omitted → enqueue ALL pending rows from Sheet2
 *   - rowIndex provided → enqueue that single row
 */

import { NextRequest, NextResponse } from "next/server";
import { SheetsClient }              from "@/agents/sheets/client";
import { createJob, upsertContentRow } from "@/lib/db";
import { enqueueRender }             from "@/lib/queue";
import { emitLog, setStatus, clearLogs } from "@/lib/pipeline-store";

const SHEET_NAME = "Sheet2";

export async function POST(req: NextRequest) {
  const body           = await req.json().catch(() => ({})) as { rowIndex?: number };
  const singleRowIndex = typeof body.rowIndex === "number" ? body.rowIndex : undefined;

  try {
    clearLogs();
    setStatus("running", "", 0);
    emitLog("V2-Orchestrator", singleRowIndex !== undefined ? `Queuing V2 row ${singleRowIndex}` : "Queuing all V2 pending", "info");

    const sheets = new SheetsClient(SHEET_NAME);
    await sheets.initializeSheet();

    if (singleRowIndex !== undefined) {
      const all = await sheets.getAllContent();
      const row = all.find((r) => r.rowIndex === singleRowIndex);
      if (!row) {
        return NextResponse.json({ error: `V2 Row ${singleRowIndex} not found` }, { status: 404 });
      }

      await upsertContentRow({
        row_index: row.rowIndex, topic: row.topic, style: row.style, voice: row.voice,
        hook_a: row.hookA, hook_b: row.hookB, hook_c: row.hookC, script: row.script,
      });

      const job = await createJob(row.rowIndex, row.topic, "v2-ugc");
      await enqueueRender({ rowIndex: row.rowIndex, template: "v2-ugc", topic: row.topic, dbJobId: job.id, version: "v2", sheetName: SHEET_NAME });
      await sheets.updateStatus(row.rowIndex, "Queued");

      setStatus("running", row.topic, 10);
      emitLog("V2-Orchestrator", `Queued V2: ${row.topic} → job ${job.id}`, "info");

      return NextResponse.json({ success: true, queued: 1, version: "v2", jobs: [{ id: job.id, topic: row.topic }] });

    } else {
      const pending = await sheets.getPendingContent();
      if (pending.length === 0) {
        emitLog("V2-Orchestrator", "No pending V2 content", "info");
        setStatus("done", "", 100);
        return NextResponse.json({ success: true, queued: 0, jobs: [] });
      }

      const jobs = [];
      for (const row of pending) {
        await upsertContentRow({
          row_index: row.rowIndex, topic: row.topic, style: row.style, voice: row.voice,
          hook_a: row.hookA, hook_b: row.hookB, hook_c: row.hookC, script: row.script,
        });

        const job = await createJob(row.rowIndex, row.topic, "v2-ugc");
        await enqueueRender({ rowIndex: row.rowIndex, template: "v2-ugc", topic: row.topic, dbJobId: job.id, version: "v2", sheetName: SHEET_NAME });
        await sheets.updateStatus(row.rowIndex, "Queued");
        jobs.push({ id: job.id, topic: row.topic });
        emitLog("V2-Orchestrator", `Queued V2: ${row.topic}`, "info");
      }

      setStatus("running", "", 10);
      emitLog("V2-Orchestrator", `${jobs.length} V2 job(s) queued — start worker with: npm run worker`, "info");
      return NextResponse.json({ success: true, queued: jobs.length, version: "v2", jobs });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    setStatus("error");
    emitLog("V2-Orchestrator", `Fatal: ${message}`, "error");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
