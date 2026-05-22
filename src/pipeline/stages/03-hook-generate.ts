import type { PipelineContext, StageResult } from "../types";

// Selects the best hook from the three generated in stage 02.
// For advanced tier: could call an AI quality scorer.
// For now: picks hookA (matches the job's hookStyle) unless it's empty.
export async function hookGenerate(ctx: PipelineContext): Promise<StageResult> {
  const hookA = ctx.artifacts["hook_a"] ?? "";
  const hookB = ctx.artifacts["hook_b"] ?? "";
  const hookC = ctx.artifacts["hook_c"] ?? "";

  if (!hookA && !hookB && !hookC) {
    throw new Error("No hook variations available — script-generate stage may have failed");
  }

  // Primary hook = hookA (matches ctx.hookStyle); fall back to first non-empty
  const selectedHook = hookA || hookB || hookC;
  ctx.log(`Selected hook: "${selectedHook}" (style: ${ctx.hookStyle})`);

  return {
    artifacts: { selected_hook: selectedHook },
    metadata:  { hookStyle: ctx.hookStyle },
  };
}
