import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "../.env") });
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
const niche = "Six Sigma for startups";
const count = 10;

const prompt = `You are a viral TikTok content strategist specialising in short-form video angles.

NICHE: ${niche}
COUNT: Generate exactly ${count} SPECIFIC video topic angles.

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

console.log(`Testing TopicGeneratorAgent (Gemini 2.0 Flash) — niche: "${niche}"\n`);

const response = await ai.models.generateContent({ model: "gemini-2.0-flash", contents: prompt });
const raw = (response.text ?? "").trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
const data = JSON.parse(raw);

data.forEach((s, i) => {
  console.log(`${i + 1}. [${s.angle} · ${s.style}]`);
  console.log(`   ${s.topic}`);
  console.log(`   → "${s.hookPreview}"\n`);
});

console.log(`✓ ${data.length} suggestions generated`);
