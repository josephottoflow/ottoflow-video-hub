/**
 * POST /api/topics
 * Add one or more topics to Sheet1 (v1) or Sheet2 (v2) and optionally queue a render job.
 *
 * Body: {
 *   topics:     string[];          // one topic per element
 *   style?:     string;            // default "Educational"
 *   voice?:     string;            // default "Female energetic"
 *   autoQueue?: boolean;           // default true
 *   version?:   "v1" | "v2";      // default "v1" — "v2" targets Sheet2 + Advanced pipeline
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
    const style     = (body.style     as string | undefined)?.trim() || "Educational";
    const voice     = (body.voice     as string | undefined)?.trim() || "Female energetic";
    const musicVibe      = (body.musicVibe      as string | undefined)?.trim() || undefined;
    const variantOverride = (body.renderVariant as string | undefined)?.trim() || undefined;
    const scheduledAt   = typeof body.scheduledAt === "number" && body.scheduledAt > Date.now() ? body.scheduledAt : undefined;
    const autoQueue = body.autoQueue !== false;
    const version   = (body.version as string | undefined) === "v2" ? "v2" : "v1";

    if (topics.length === 0) {
      return NextResponse.json({ error: "topics array is required and must not be empty" }, { status: 400 });
    }

    const sheetName = version === "v2" ? "Video Gen — Advance Tier" : undefined;
    const schema    = version === "v2" ? "v2-advanced" as const : "v1" as const;
    const sheets    = new SheetsClient(sheetName, schema);
    await sheets.initializeSheet();

    const results: { rowIndex: number; topic: string; jobId?: string; template?: string }[] = [];
    const errors:  { topic: string; error: string }[] = [];

    for (const topic of topics) {
      try {
        const rowIndex = version === "v2"
          ? await sheets.appendRow({ topic, style, voice })
          : await sheets.addContent({ topic, style, voice });

        if (autoQueue) {
          const renderVariant = (variantOverride as RenderVariant | undefined) ?? rand(ALL_VARIANTS);
          const hookStyle     = rand(ALL_HOOK_STYLES);

          await upsertContentRow({ row_index: rowIndex, topic, style, voice });

          if (version === "v2") {
            const job = await createJob(rowIndex, topic, "v2-ugc", { version: "v2", renderVariant, hookStyle, sheetName: "Video Gen — Advance Tier", musicVibe });
            await enqueueRender({ rowIndex, template: "v2-ugc", topic, dbJobId: job.id, version: "v2", sheetName: "Video Gen — Advance Tier", renderVariant, hookStyle, musicVibe, scheduledAt });
            await sheets.updateStatus(rowIndex, scheduledAt ? "Scheduled" : "Queued");
            results.push({ rowIndex, topic, jobId: job.id, template: "v2-ugc" });
          } else {
            const recentTemplates = await getLastTemplatesForTopic(topic);
            const template        = await RenderAgent.selectTemplate(topic, style, recentTemplates);
            const job = await createJob(rowIndex, topic, template, { version: "v1", renderVariant, hookStyle, musicVibe });
            await enqueueRender({ rowIndex, template, topic, dbJobId: job.id, renderVariant, hookStyle, musicVibe, scheduledAt });
            await sheets.updateStatus(rowIndex, scheduledAt ? "Scheduled" : "Queued");
            results.push({ rowIndex, topic, jobId: job.id, template });
          }
        } else {
          results.push({ rowIndex, topic });
        }
      } catch (err) {
        errors.push({ topic, error: err instanceof Error ? err.message : String(err) });
      }
    }

    const hasErrors = errors.length > 0;
    return NextResponse.json({
      success: !hasErrors || results.length > 0,
      added:   results.length,
      queued:  autoQueue ? results.length : 0,
      version,
      jobs:    results,
      ...(hasErrors ? { errors } : {}),
    }, { status: hasErrors && results.length === 0 ? 500 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
