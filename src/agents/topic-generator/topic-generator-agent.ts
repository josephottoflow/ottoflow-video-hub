import { getAIOrchestrator } from "../../ai-orchestrator";

export interface TopicSuggestion {
  topic:       string;
  style:       string;
  angle:       string;
  hookPreview: string;
}

export class TopicGeneratorAgent {
  async generateTopics(
    niche:        string,
    count         = 15,
    avoidTopics?: string[],
    opts?:        { tier?: "basic" | "advanced"; jobId?: string }
  ): Promise<TopicSuggestion[]> {
    const avoidList = avoidTopics?.length
      ? `\nAVOID these topics (already queued):\n${avoidTopics.slice(0, 30).map((t) => `- ${t}`).join("\n")}`
      : "";

    const systemPrompt = `You are a viral TikTok content strategist specialising in short-form video angles.
Your job is to generate highly specific, scroll-stopping topic ideas that work as standalone hooks.
Never produce generic titles. Every topic must be concrete enough to be the hook itself.`;

    const prompt = `NICHE: ${niche}
COUNT: Generate exactly ${count} SPECIFIC video topic angles.
${avoidList}

RULES:
- Each topic must be a specific, concrete angle — NOT a generic category.
  GOOD: "Why 87% of Six Sigma projects fail in week 1"
  BAD:  "Six Sigma tips"
- Vary angles across: stat-driven, myth-busting, how-to, story-arc, list formats
- Mix styles: Educational, Motivational, Case Study, Startup-focused
- Make every topic punchy enough to be a TikTok hook on its own

Output ONLY valid JSON — an array of exactly ${count} objects:
[
  {
    "topic":       "specific video angle title",
    "style":       "Educational | Motivational | Case Study | Startup-focused | Lifestyle | Neon",
    "angle":       "stat-first | myth-bust | how-to | story-arc | list",
    "hookPreview": "one-line scroll-stopping hook (max 8 words)"
  }
]`;

    // Advanced tier → Claude Opus for premium topic ideation
    // Basic tier   → Gemini Flash for cost efficiency
    const aiResponse = await getAIOrchestrator().generate({
      taskType:       "topic-generate",
      prompt,
      systemPrompt,
      tier:           opts?.tier ?? "advanced", // default to advanced — topic quality is a differentiator
      jobId:          opts?.jobId,
      skipCache:      true, // always generate fresh topics
      responseFormat: "json",
    });

    const raw  = aiResponse.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) throw new Error("Expected JSON array from AI provider");
    return data as TopicSuggestion[];
  }
}
