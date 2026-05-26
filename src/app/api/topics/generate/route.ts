/**
 * POST /api/topics/generate
 * Generate creator-native viral topic suggestions for a niche.
 * Body: { niche: string, count?: number }
 *
 * POST /api/topics/generate  (with action: "variations")
 * Generate angle variations on an existing topic.
 * Body: { action: "variations", topic: string, count?: number }
 */

import { NextResponse } from "next/server";
import { SheetsClient } from "@/agents/sheets/client";
import { TopicGeneratorAgent } from "@/agents/topic-generator/topic-generator-agent";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ── Variation mode ──────────────────────────────────────────────────────
    if (body.action === "variations") {
      const topic = (body.topic as string | undefined)?.trim();
      const count = typeof body.count === "number" ? Math.min(body.count, 10) : 5;
      if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

      const agent   = new TopicGeneratorAgent();
      const results = await agent.generateVariations(topic, count);
      const scored  = TopicGeneratorAgent.scoreTopics(results);
      return NextResponse.json({ success: true, suggestions: scored });
    }

    // ── Standard generation mode ────────────────────────────────────────────
    const niche = (body.niche as string | undefined)?.trim();
    const count = typeof body.count === "number" ? Math.min(body.count, 25) : 15;

    if (!niche) return NextResponse.json({ error: "niche is required" }, { status: 400 });

    // Fetch existing topics to pass as avoid-list (dedup)
    const sheets = new SheetsClient();
    await sheets.initializeSheet();
    const existing    = await sheets.getAllContent().catch(() => []);
    const avoidTopics = existing.map(r => r.topic).filter(Boolean);

    const agent       = new TopicGeneratorAgent();
    const suggestions = await agent.generateTopics(niche, count, avoidTopics);
    const scored      = TopicGeneratorAgent.scoreTopics(suggestions);

    return NextResponse.json({ success: true, suggestions: scored, avoidedCount: avoidTopics.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
