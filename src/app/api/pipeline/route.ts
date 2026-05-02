/**
 * API: /api/pipeline
 * POST → Run the full pipeline on all pending products
 */

import { NextResponse } from "next/server";
import { PipelineOrchestrator } from "@/agents/pipeline/orchestrator";

export async function POST() {
  try {
    const pipeline = new PipelineOrchestrator();
    const results = await pipeline.processAll();

    return NextResponse.json({
      success: true,
      results: results.map((r) => ({
        productName: r.productName,
        productSlug: r.productSlug,
        success: r.success,
        videoUrl: r.videoUrl,
        error: r.error,
        durationMs: r.timing.durationMs,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
