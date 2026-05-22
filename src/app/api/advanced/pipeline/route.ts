// POST /api/advanced/pipeline — create and queue an advanced pipeline
//
// Creates a pipeline row in Postgres, then enqueues it for the advanced worker.
// The pipeline state machine lives entirely in Postgres — BullMQ is just the trigger.

import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { getDb } from "../../../../lib/db";
import { enqueueAdvancedPipeline } from "../../../../lib/queue/advanced";
import { emitEvent } from "../../../../pipeline/events";
import type { PipelineConfig, RenderVariant, HookStyle } from "../../../../pipeline/types";

const VARIANTS: RenderVariant[]  = ["problem-first", "stat-first", "story-arc", "myth-bust"];
const HOOK_STYLES: HookStyle[]   = ["question", "bold-statement", "conflict", "promise", "shock", "story"];

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic    = String(body.topic ?? "").trim();
  const style    = String(body.style ?? "Educational");
  const tier     = (body.tier as string) === "basic" ? "basic" : "advanced";
  const priority = Number(body.priority ?? 5);

  if (!topic || topic.length < 3) {
    return NextResponse.json({ error: "topic is required (min 3 chars)" }, { status: 422 });
  }

  const pipelineId    = crypto.randomUUID();
  const renderVariant = (body.renderVariant as RenderVariant) ?? randomPick(VARIANTS);
  const hookStyle     = (body.hookStyle    as HookStyle)     ?? randomPick(HOOK_STYLES);
  const musicVibe     = body.musicVibe ? String(body.musicVibe) : null;
  const template      = body.template  ? String(body.template)  : null;
  const rowIndex      = body.rowIndex  ? Number(body.rowIndex)  : null;
  const dbJobId       = body.dbJobId   ? String(body.dbJobId)   : null;

  const config: PipelineConfig = {
    tier,
    dbJobId:       dbJobId ?? undefined,
    skipLipsync:   body.skipLipsync   === true,
    skipUpscale:   body.skipUpscale   === true,
    skipAnalytics: body.skipAnalytics === true,
    skipPublish:   body.skipPublish   === true,
  };

  // Insert pipeline row
  await getDb().query(
    `INSERT INTO pipelines
       (id, status, tier, topic, style, render_variant, hook_style, music_vibe, template,
        priority, row_index, db_job_id, config, queued_at)
     VALUES ($1,'queued',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())`,
    [pipelineId, tier, topic, style, renderVariant, hookStyle,
     musicVibe, template, priority, rowIndex, dbJobId, JSON.stringify(config)]
  );

  // Enqueue in BullMQ
  await enqueueAdvancedPipeline(pipelineId, config, priority);

  // Emit creation event
  await emitEvent({ type: "pipeline_queued", pipelineId, ts: new Date().toISOString() });

  return NextResponse.json({ pipelineId, renderVariant, hookStyle, tier }, { status: 201 });
}
