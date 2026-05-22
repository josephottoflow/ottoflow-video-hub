import { ScriptWriterAgent } from "../../agents/scriptwriter/scriptwriter-agent";
import type { PipelineContext, StageResult } from "../types";

const agent = new ScriptWriterAgent();

export async function scriptGenerate(ctx: PipelineContext): Promise<StageResult> {
  ctx.log(`Generating script for: "${ctx.topic}" [${ctx.renderVariant}/${ctx.hookStyle}]`);

  const result = await agent.generateScript(
    ctx.topic,
    ctx.style,
    undefined,
    ctx.hookStyle,
    ctx.renderVariant,
    { tier: ctx.tier, jobId: ctx.pipelineId }
  );

  if (!result.script || result.script.length < 10) {
    throw new Error(`Script generation returned empty result`);
  }

  ctx.log(`Script generated: ${result.wordCount} words`);

  return {
    artifacts: {
      script: result.script,
      hook_a: result.hookA,
      hook_b: result.hookB,
      hook_c: result.hookC,
    },
    metadata: { wordCount: result.wordCount },
  };
}
