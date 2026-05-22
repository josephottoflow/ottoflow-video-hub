import * as path from "path";
import { VoiceoverAgent } from "../../agents/voiceover/voiceover-agent";
import type { PipelineContext, StageResult } from "../types";

const agent = new VoiceoverAgent();

export async function voiceGenerate(ctx: PipelineContext): Promise<StageResult> {
  const script = ctx.artifacts["script"];
  if (!script) {
    throw new Error("No script in artifacts — script-generate stage must run first");
  }

  ctx.log(`Generating voiceover (${script.split(/\s+/).length} words)`);

  const voiceName = ctx.artifacts["voice_name"] ?? "female energetic";
  const voicePath = await agent.generate(script, ctx.workDir, voiceName);

  if (!voicePath) {
    throw new Error("Voiceover generation failed — ElevenLabs returned no audio");
  }

  // Use relative path within workDir so artifacts survive workDir location changes
  const relPath = path.relative(ctx.workDir, voicePath);
  ctx.log(`Voiceover ready: ${relPath}`);

  return {
    artifacts: { voice_path: voicePath },
    metadata:  { voiceName },
  };
}
