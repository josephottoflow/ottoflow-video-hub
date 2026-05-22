import { NextResponse } from "next/server";
import { getSpendSummary } from "../../../ai-orchestrator";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const hours = Math.min(Number(searchParams.get("hours") ?? "24"), 720); // max 30 days

  try {
    const summary = await getSpendSummary(hours);

    const totalCostUsd = summary.reduce((sum, r) => sum + r.totalCostUsd, 0);
    const totalCalls   = summary.reduce((sum, r) => sum + r.calls, 0);
    const totalCached  = summary.reduce((sum, r) => sum + r.cacheHits, 0);

    return NextResponse.json({
      windowHours:  hours,
      totalCostUsd: Math.round(totalCostUsd * 1_000_000) / 1_000_000,
      totalCalls,
      cacheHitRate: totalCalls > 0 ? Math.round((totalCached / totalCalls) * 1000) / 10 : 0,
      byModel:      summary,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown error" },
      { status: 500 }
    );
  }
}
