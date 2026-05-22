import * as fs   from "fs";
import * as path from "path";
import { RenderAgent } from "../../agents/render/render-agent";
import { getLastTemplatesForTopic } from "../../lib/db";
import type { PipelineContext, StageResult } from "../types";

export async function sceneBuild(ctx: PipelineContext): Promise<StageResult> {
  ctx.log("Building scene data");

  // ── Template selection (anti-repeat) ────────────────────────────────────────
  let template = ctx.template;
  if (!template) {
    const recent   = await getLastTemplatesForTopic(ctx.topic, 3);
    template       = await RenderAgent.selectTemplate(ctx.topic, ctx.style, recent);
  }
  ctx.log(`Template: ${template}`);

  // ── Assemble Remotion composition props ──────────────────────────────────────
  const script       = ctx.artifacts["script"]       ?? "";
  const hookText     = ctx.artifacts["selected_hook"] ?? ctx.artifacts["hook_a"] ?? "";
  const voicePath    = ctx.artifacts["voice_path"]   ?? "";
  const bgVideoUrl   = ctx.artifacts["background_video_url"]  ?? "";
  const bgImageUrl   = ctx.artifacts["background_image_url"]  ?? "";
  const bgColor      = ctx.artifacts["background_color"]       ?? "#0a0a0a";
  const captions     = ctx.artifacts["captions"]     ?? "[]";

  const sceneData = {
    template,
    topic:    ctx.topic,
    style:    ctx.style,
    script,
    hookText,
    voicePath,
    backgrounds: {
      videoUrl:  bgVideoUrl  || undefined,
      imageUrl:  bgImageUrl  || undefined,
      color:     bgColor,
    },
    captions: JSON.parse(captions),
    musicVibe: ctx.musicVibe ?? "none",
  };

  // Write scene data to workDir for Remotion to pick up
  const sceneDataPath = path.join(ctx.workDir, "scene-data.json");
  fs.writeFileSync(sceneDataPath, JSON.stringify(sceneData, null, 2));

  ctx.log(`Scene data written: ${sceneDataPath}`);

  return {
    artifacts: {
      scene_data_path: sceneDataPath,
      template,
    },
    metadata: { template, hasVoice: !!voicePath, hasVideo: !!bgVideoUrl },
  };
}
