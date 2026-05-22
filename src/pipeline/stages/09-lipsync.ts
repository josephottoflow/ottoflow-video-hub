import * as fs   from "fs";
import * as path from "path";
import { LipsyncAgent } from "../../agents/lipsync/lipsync-agent";
import type { PipelineContext, StageResult } from "../types";

const agent = new LipsyncAgent();

export async function lipsync(ctx: PipelineContext): Promise<StageResult> {
  const voicePath  = ctx.artifacts["voice_path"];
  const avatarPath = ctx.artifacts["avatar_path"] ?? process.env.DEFAULT_AVATAR_PATH;

  if (!voicePath || !avatarPath) {
    ctx.log(`Lipsync skipped: missing ${!voicePath ? "voice" : "avatar"} path`);
    return {};
  }

  if (!fs.existsSync(avatarPath)) {
    ctx.log(`Avatar image not found at ${avatarPath} — skipping lipsync`);
    return {};
  }

  ctx.log("Starting D-ID lipsync");

  try {
    const result = await agent.generateTalkingHead(avatarPath, voicePath, ctx.workDir);
    if (!result || !fs.existsSync(result)) {
      ctx.log("Lipsync returned no output — skipping");
      return {};
    }
    ctx.log(`Lipsync video ready: ${path.basename(result)}`);
    return {
      artifacts: { lipsync_video_path: result },
      metadata:  { provider: "d-id" },
    };
  } catch (err) {
    ctx.log(`Lipsync failed (non-critical): ${(err as Error).message}`);
    return {};
  }
}
