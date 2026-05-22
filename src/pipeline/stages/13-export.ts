import * as fs   from "fs";
import * as path from "path";
import type { PipelineContext, StageResult } from "../types";

export async function exportStage(ctx: PipelineContext): Promise<StageResult> {
  // Pick the best available video in the artifact chain
  const candidates = [
    ctx.artifacts["upscaled_path"],
    ctx.artifacts["mixed_path"],
    ctx.artifacts["render_path"],
  ];

  const source = candidates.find((p) => p && fs.existsSync(p));
  if (!source) {
    throw new Error("No rendered video found in any artifact slot");
  }

  const exportName = `${ctx.pipelineId}.mp4`;
  const exportPath = path.join(ctx.workDir, exportName);

  // If source is already an mp4 at the right path, use it directly
  if (source === exportPath) {
    ctx.log(`Export: using existing ${exportName}`);
  } else {
    fs.copyFileSync(source, exportPath);
    ctx.log(`Export: ${path.basename(source)} → ${exportName}`);
  }

  const stat = fs.statSync(exportPath);
  if (stat.size < 50_000) {
    throw new Error(`Export file suspiciously small: ${stat.size} bytes — render likely failed`);
  }

  return {
    artifacts: { export_path: exportPath },
    metadata:  { fileSizeBytes: stat.size },
  };
}
