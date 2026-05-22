import { getAIOrchestrator } from "../../ai-orchestrator";
import type { PipelineContext, StageResult } from "../types";

interface CaptionWord {
  word:   string;
  start:  number;   // seconds
  end:    number;   // seconds
}

function buildCaptionsFromScript(script: string): CaptionWord[] {
  // Simple equal-time distribution: 30 words over 12s → 0.4s per word
  const words    = script.trim().split(/\s+/);
  const duration = 12;
  const perWord  = duration / words.length;

  return words.map((word, i) => ({
    word,
    start: +(i * perWord).toFixed(3),
    end:   +((i + 1) * perWord).toFixed(3),
  }));
}

export async function captionGenerate(ctx: PipelineContext): Promise<StageResult> {
  const script = ctx.artifacts["script"];
  if (!script) {
    // Non-critical: no script available
    ctx.log("No script available for captions — using empty captions");
    return { artifacts: { captions: "[]" } };
  }

  ctx.log("Generating captions");

  // For advanced tier: ask Gemini to produce natural caption groupings
  // For basic tier: use the simple equal-split approach
  if (ctx.tier === "advanced") {
    try {
      const prompt = `Split this video script into caption segments for TikTok subtitles.
Each segment is 2-5 words that read naturally together.

SCRIPT: ${script}

Output ONLY valid JSON:
[
  { "word": "phrase of 2-5 words", "start": 0.0, "end": 1.5 }
]

Total duration: 12 seconds. All segments must be sequential and non-overlapping.`;

      const response = await getAIOrchestrator().generate({
        taskType:       "caption-generate",
        prompt,
        tier:           "advanced",
        jobId:          ctx.pipelineId,
        responseFormat: "json",
      });

      const raw      = response.text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      const captions = JSON.parse(raw);
      if (Array.isArray(captions) && captions.length > 0) {
        return { artifacts: { captions: JSON.stringify(captions) }, metadata: { count: captions.length } };
      }
    } catch (err) {
      ctx.log(`AI captions failed: ${(err as Error).message} — falling back to simple split`);
    }
  }

  // Fallback: equal-time word distribution
  const captions = buildCaptionsFromScript(script);
  return {
    artifacts: { captions: JSON.stringify(captions) },
    metadata:  { count: captions.length },
  };
}
