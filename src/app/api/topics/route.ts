/**
 * POST /api/topics
 * Add one or more topics to Sheet1 and optionally queue a render job for each.
 *
 * Body: {
 *   topics:    string[];          // one topic per element
 *   style?:    string;            // default "Educational"
 *   voice?:    string;            // default "Female energetic"
 *   autoQueue?: boolean;          // default true — also enqueue a render job
 * }
 */

import { NextResponse } from "next/server";
import { SheetsClient } from "@/agents/sheets/client";
import { RenderAgent } from "@/agents/render/render-agent";
import { createJob, upsertContentRow, getLastTemplatesForTopic } from "@/lib/db";
import { enqueueRender } from "@/lib/queue";
import type { RenderVariant } from "@/lib/queue";

const ALL_VARIANTS: RenderVariant[] = ["problem-first", "stat-first", "story-arc", "myth-bust"];
const ALL_HOOK_STYLES = ["question", "bold-statement", "conflict", "promise", "shock", "story"];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export async function POST(req: Request) {
  try {
    const body      = await req.json();
    const topics    = (body.topics as string[] | undefined)?.map(t => t.trim()).filter(Boolean) ?? [];
    const style     = (body.style  as string | undefined)?.trim() || "Educational";
    const voice     = (body.voice  as string | undefined)?.trim() || "Female energetic";
    const autoQueue = body.autoQueue !== false;

    if (topics.length === 0) {
      return NextResponse.json({ error: "topics array is required and must not be empty" }, { status: 400 });
    }

    const sheets = new SheetsClient();
    await sheets.initializeSheet();

    const results: { rowIndex: number; topic: string; jobId?: string; template?: string }[] = [];

    for (const topic of topics) {
      const rowIndex = await sheets.addContent({ topic, style, voice });

      if (autoQueue) {
        const recentTemplates = await getLastTemplatesForTopic(topic);
        const template        = await RenderAgent.selectTemplate(topic, style, recentTemplates);
        const renderVariant   = rand(ALL_VARIANTS);
        const hookStyle       = rand(ALL_HOOK_STYLES);

        await upsertContentRow({ row_index: rowIndex, topic, style, voice });
        const job = await createJob(rowIndex, topic, template);
        await enqueueRender({ rowIndex, template, topic, dbJobId: job.id, renderVariant, hookStyle });
        await sheets.updateStatus(rowIndex, "Queued");
        results.push({ rowIndex, topic, jobId: job.id, template });
      } else {
        results.push({ rowIndex, topic });
      }
    }

    return NextResponse.json({
      success: true,
      added:   topics.length,
      queued:  autoQueue ? topics.length : 0,
      jobs:    results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
