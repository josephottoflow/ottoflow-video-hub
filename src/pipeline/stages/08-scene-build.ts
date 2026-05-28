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

  // Style → brand colors mapping (matches design-agent.ts defaults)
  const STYLE_COLORS: Record<string, { primary: string; secondary: string; accent: string; background: string; text: string }> = {
    "motivational":    { primary: "#dc2626", secondary: "#991b1b", accent: "#f87171",  background: "#0a0a0a", text: "#ffffff" },
    "case study":      { primary: "#0891b2", secondary: "#0e7490", accent: "#22d3ee",  background: "#080c10", text: "#e2f8ff" },
    "lifestyle":       { primary: "#059669", secondary: "#047857", accent: "#34d399",  background: "#0a0f0a", text: "#ffffff" },
    "startup-focused": { primary: "#7c3aed", secondary: "#6d28d9", accent: "#a78bfa",  background: "#08050f", text: "#f5f0ff" },
    "luxury":          { primary: "#d97706", secondary: "#92400e", accent: "#f59e0b",  background: "#06040a", text: "#fff8e7" },
    "neon":            { primary: "#ec4899", secondary: "#be185d", accent: "#f0abfc",  background: "#05000f", text: "#ffffff" },
  };
  const defaultColors = { primary: "#6366f1", secondary: "#4f46e5", accent: "#818cf8", background: "#0a0a0a", text: "#ffffff" };
  const brandColors = STYLE_COLORS[ctx.style?.toLowerCase() ?? ""] ?? defaultColors;

  const sceneData = {
    template,
    topic:    ctx.topic,
    style:    ctx.style,
    script,
    hookText,
    voicePath,
    brandColors,
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
