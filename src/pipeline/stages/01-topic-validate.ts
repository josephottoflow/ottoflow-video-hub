import type { PipelineContext, StageResult } from "../types";

export async function topicValidate(ctx: PipelineContext): Promise<StageResult> {
  const topic = ctx.topic?.trim();
  if (!topic || topic.length < 3) {
    throw new Error(`Invalid topic: "${ctx.topic}" (must be at least 3 characters)`);
  }
  if (topic.length > 500) {
    throw new Error(`Topic too long: ${topic.length} chars (max 500)`);
  }

  ctx.log(`Topic validated: "${topic}" (${topic.length} chars)`);

  return {
    artifacts: { topic_validated: "true" },
    metadata:  { topicLength: topic.length, style: ctx.style },
  };
}
