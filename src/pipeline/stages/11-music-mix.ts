import * as path from "path";
import * as fs   from "fs";
import { FFmpegAgent } from "../../agents/ffmpeg/ffmpeg-agent";
import type { PipelineContext, StageResult } from "../types";

const ffmpeg = new FFmpegAgent();

export async function musicMix(ctx: PipelineContext): Promise<StageResult> {
  const renderPath = ctx.artifacts["render_path"];
  if (!renderPath || !fs.existsSync(renderPath)) {
    ctx.log("No render output — skipping music mix");
    return {};
  }

  ctx.log(`Mixing audio (vibe: ${ctx.musicVibe ?? "auto"})`);

  try {
    const result = await ffmpeg.postProcess(renderPath, "minimal", {
      musicVolume: 0.12,
      suffix:      "-mixed",
    });

    if (!result.success || !result.outputPath || !fs.existsSync(result.outputPath)) {
      ctx.log(`FFmpeg mix failed: ${result.error ?? "no output"} — using raw render`);
      return { artifacts: { mixed_path: renderPath } };
    }

    ctx.log(`Mixed: ${path.basename(result.outputPath)}`);
    return {
      artifacts: { mixed_path: result.outputPath },
      metadata:  { musicVibe: ctx.musicVibe },
    };
  } catch (err) {
    ctx.log(`Music mix failed (non-critical): ${(err as Error).message}`);
    return { artifacts: { mixed_path: renderPath } };
  }
}
