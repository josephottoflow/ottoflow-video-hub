import * as path from "path";
import * as fs   from "fs";
import { RenderAgent } from "../../agents/render/render-agent";
import { slugify } from "../../lib/slug-utils";
import type { PipelineContext, StageResult } from "../types";

const agent = new RenderAgent();

export async function remotionRender(ctx: PipelineContext): Promise<StageResult> {
  const template = ctx.artifacts["template"] ?? "cinematic";
  ctx.log(`Remotion render [${template}]`);

  if (ctx.signal.aborted) throw new Error("Render cancelled before start");

  // Load scene data built in stage 08
  const sceneDataPath = ctx.artifacts["scene_data_path"];
  if (!sceneDataPath || !fs.existsSync(sceneDataPath)) {
    throw new Error(`Scene data file not found: ${sceneDataPath}`);
  }
  const sceneData = JSON.parse(fs.readFileSync(sceneDataPath, "utf8"));

  const slug      = slugify(ctx.topic);
  const outputDir = ctx.workDir;

  const result = await agent.render(slug, sceneData, outputDir, template);

  if (!result.success || !result.videoPath) {
    throw new Error(result.error ?? "Remotion render returned no output");
  }
  if (!fs.existsSync(result.videoPath)) {
    throw new Error(`Render output not found at: ${result.videoPath}`);
  }

  const fileSizeBytes = fs.statSync(result.videoPath).size;
  ctx.log(`Rendered: ${path.basename(result.videoPath)} (${Math.round(fileSizeBytes / 1024 / 1024)}MB)`);

  return {
    artifacts: { render_path: result.videoPath },
    metadata:  { durationMs: result.durationMs, fileSizeBytes },
  };
}
