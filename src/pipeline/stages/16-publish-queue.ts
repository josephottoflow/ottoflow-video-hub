import * as fs from "fs";
import { TelegramApprovalBot } from "../../agents/approval/telegram-bot";
import { slugify } from "../../lib/slug-utils";
import type { PipelineContext, StageResult } from "../types";

const telegram = new TelegramApprovalBot();

export async function publishQueue(ctx: PipelineContext): Promise<StageResult> {
  const outputLink = ctx.artifacts["output_link"];
  // Need a local video file path for Telegram upload
  const videoPath  = ctx.artifacts["export_path"];

  if (!videoPath || !fs.existsSync(videoPath)) {
    ctx.log("No local video file for Telegram — skipping publish queue");
    return {};
  }

  ctx.log("Sending to Telegram approval queue");

  try {
    const slug   = slugify(ctx.topic);
    const result = await telegram.sendVideoForApproval(videoPath, ctx.topic, slug);
    ctx.log(`Telegram: ${result.decision} (waited ${result.waitTimeMs}ms)`);

    return {
      artifacts: { publish_decision: result.decision },
      metadata:  { decision: result.decision, outputLink },
    };
  } catch (err) {
    ctx.log(`Telegram publish failed (non-critical): ${(err as Error).message}`);
    return {};
  }
}
