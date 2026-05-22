import { getDb } from "../../lib/db";
import type { PipelineContext, StageResult } from "../types";

export async function analytics(ctx: PipelineContext): Promise<StageResult> {
  ctx.log("Recording analytics");

  try {
    // Write a summary record to the legacy jobs table if dbJobId is present
    const dbJobId = ctx.config.dbJobId;
    if (dbJobId && ctx.artifacts["output_link"]) {
      await getDb().query(
        `UPDATE jobs
           SET output_link = $1,
               status      = 'done',
               completed_at = now()
         WHERE id = $2`,
        [ctx.artifacts["output_link"], dbJobId]
      );
    }

    // Quality score placeholder (can be wired to AI scoring later)
    const qualityScore = 85; // default until AI quality scoring is implemented

    ctx.log(`Analytics recorded (quality: ${qualityScore})`);
    return {
      artifacts: { quality_score: String(qualityScore) },
      metadata:  { qualityScore, dbJobId },
    };
  } catch (err) {
    ctx.log(`Analytics write failed (non-critical): ${(err as Error).message}`);
    return {};
  }
}
