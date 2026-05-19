import { GoogleGenAI } from "@google/genai";

export interface TopicSuggestion {
  topic:       string;
  style:       string;
  angle:       string;
  hookPreview: string;
}

export class TopicGeneratorAgent {
  private ai: GoogleGenAI | null;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  async generateTopics(
    niche:        string,
    count         = 15,
    avoidTopics?: string[]
  ): Promise<TopicSuggestion[]> {
    if (!this.ai) throw new Error("GOOGLE_API_KEY is not set");

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

    const response = await this.ai.models.generateContent({
      model:    "gemini-2.0-flash",
      contents: prompt,
    });

    const raw = (response.text ?? "").trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) throw new Error("Expected JSON array from Gemini");
    return data as TopicSuggestion[];
  }
}
