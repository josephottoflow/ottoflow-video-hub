import * as fs from "fs";
import type { PipelineContext, StageResult } from "../types";

// Video upscale is currently a no-op pending GPU service integration.
// The stage exists so the pipeline schema is complete and the slot can be
// activated later (e.g. ffmpeg bicubic scale, Topaz Video AI, or a cloud GPU).
export async function upscale(ctx: PipelineContext): Promise<StageResult> {
  const inputPath = ctx.artifacts["mixed_path"] ?? ctx.artifacts["render_path"];

  if (!inputPath || !fs.existsSync(inputPath)) {
    ctx.log("No render output to upscale — skipping");
    return {};
  }

  if (!process.env.ENABLE_UPSCALE) {
    ctx.log("ENABLE_UPSCALE not set — passing through (no-op)");
    return { artifacts: { upscaled_path: inputPath } };
  }

  // Placeholder: future GPU upscale service goes here
  ctx.log("Upscale stage: GPU service not yet integrated — passing through");
  return { artifacts: { upscaled_path: inputPath } };
}
