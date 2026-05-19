import Anthropic from "@anthropic-ai/sdk";

export interface TopicSuggestion {
  topic:       string;
  style:       string;
  angle:       string;
  hookPreview: string;
}

export class TopicGeneratorAgent {
  private client: Anthropic | null;

  constructor() {
    this.client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
  }

  async generateTopics(
    niche:        string,
    count         = 15,
    avoidTopics?: string[]
  ): Promise<TopicSuggestion[]> {
    if (!this.client) throw new Error("ANTHROPIC_API_KEY is not set");

    const avoidList = avoidTopics?.length
      ? `\nAVOID these topics (already queued):\n${avoidTopics.slice(0, 30).map(t => `- ${t}`).join("\n")}`
      : "";

    const prompt = `You are a viral TikTok content strategist specialising in short-form video angles.

NICHE: ${niche}
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

    const message = await this.client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
    });

    const text = message.content[0];
    if (text.type !== "text") throw new Error("Unexpected Claude response");

    const raw  = text.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) throw new Error("Expected JSON array from Claude");
    return data as TopicSuggestion[];
  }
}
