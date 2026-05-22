import { getAIOrchestrator } from "../../ai-orchestrator";
import type { PipelineContext, StageResult } from "../types";

export async function scenePlan(ctx: PipelineContext): Promise<StageResult> {
  ctx.log(`Planning scenes for: "${ctx.topic}"`);

  const script = ctx.artifacts["script"] ?? ctx.topic;

  const prompt = `You are a TikTok video director. Plan 3 scenes for this 15-second video.

TOPIC: ${ctx.topic}
STYLE: ${ctx.style}
SCRIPT: ${script}

For each scene, specify:
- durationFrames: number (total must equal 450 for 15s at 30fps)
- visualQuery: search query for background video/image
- textOverlay: optional text to display
- transition: "cut" | "fade"

Output ONLY valid JSON:
{
  "scenes": [
    { "id": 1, "durationFrames": 150, "visualQuery": "...", "textOverlay": "...", "transition": "cut" },
    { "id": 2, "durationFrames": 180, "visualQuery": "...", "textOverlay": "...", "transition": "cut" },
    { "id": 3, "durationFrames": 120, "visualQuery": "...", "textOverlay": "...", "transition": "fade" }
  ]
}`;

  const response = await getAIOrchestrator().generate({
    taskType:       "scene-plan",
    prompt,
    tier:           ctx.tier,
    jobId:          ctx.pipelineId,
    responseFormat: "json",
  });

  const raw  = response.text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const data = JSON.parse(raw);

  if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
    throw new Error("Scene plan returned invalid structure");
  }

  const scenePlanJson = JSON.stringify(data.scenes);
  ctx.log(`Scene plan: ${data.scenes.length} scenes`);

  return {
    artifacts: { scene_plan: scenePlanJson },
    metadata:  { sceneCount: data.scenes.length },
  };
}
