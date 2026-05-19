/**
 * POST /api/topics/generate
 * Use Claude to generate topic angle suggestions for a given niche.
 *
 * Body: { niche: string, count?: number }
 * Response: { suggestions: TopicSuggestion[] }
 */

import { NextResponse } from "next/server";
import { SheetsClient } from "@/agents/sheets/client";
import { TopicGeneratorAgent } from "@/agents/topic-generator/topic-generator-agent";

export async function POST(req: Request) {
  try {
    const body  = await req.json();
    const niche = (body.niche as string | undefined)?.trim();
    const count = typeof body.count === "number" ? Math.min(body.count, 20) : 15;

    if (!niche) {
      return NextResponse.json({ error: "niche is required" }, { status: 400 });
    }

    // Fetch existing topics to avoid duplicates
    const sheets = new SheetsClient();
    await sheets.initializeSheet();
    const existing = await sheets.getAllContent().catch(() => []);
    const avoidTopics = existing.map(r => r.topic).filter(Boolean);

    const agent = new TopicGeneratorAgent();
    const suggestions = await agent.generateTopics(niche, count, avoidTopics);

    return NextResponse.json({ success: true, suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
