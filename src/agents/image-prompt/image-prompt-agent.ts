/**
 * IMAGE PROMPT AGENT — Per-scene visual prompt generator
 *
 * Claude Haiku generates:
 *  - A Veo text-to-video prompt (cinematic, 9:16 portrait, slow motion)
 *  - A 3-word caption for the screen overlay (enforced in V2Caption)
 *  - The one key word from the caption highlighted in yellow
 */

import { GoogleGenAI } from "@google/genai";

export interface ScenePromptSet {
  hook:    ScenePrompt;
  insight: ScenePrompt;
  cta:     ScenePrompt;
}

export interface ScenePrompt {
  imagePrompt: string;
  caption:     string;
  keyWord:     string;
}

const SYSTEM = `You are a visual director for short-form TikTok videos.
Given a topic and 3-beat script, you write:
1. imagePrompt — a Veo text-to-video prompt: cinematic scene, dramatic lighting, slow motion, 9:16 portrait, vivid and specific
2. caption — EXACTLY 3 words that summarize the beat (power words, bold impact)
3. keyWord — ONE word from the caption to highlight in yellow (the most impactful word)

Rules:
- imagePrompt: no text/logos, slow cinematic motion, specific setting, photorealistic, dramatic mood
- caption: EXACTLY 3 words — no more, no less. Short. Punchy. Memorable.
- keyWord: must be one exact word from the caption (lowercase match)

Return JSON only.`;

export class ImagePromptAgent {
  private ai: GoogleGenAI | null;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  async generateScenePrompts(
    topic:   string,
    script:  string,
    style:   string
  ): Promise<ScenePromptSet> {
    if (!this.ai) {
      return this.fallbackPrompts(topic);
    }

    const prompt = `${SYSTEM}

Topic: "${topic}"
Style: ${style}
Script: "${script}"

Generate visual prompts for 3 beats:
- hook (0-5s): grab attention, dramatic — the problem or surprise
- insight (5-16s): the core idea, knowledge, solution — most of the voiceover plays here
- cta (16-20s): action, transformation, forward motion

Return this JSON:
{
  "hook":    { "imagePrompt": "...", "caption": "...", "keyWord": "..." },
  "insight": { "imagePrompt": "...", "caption": "...", "keyWord": "..." },
  "cta":     { "imagePrompt": "...", "caption": "...", "keyWord": "..." }
}`;

    try {
      const response = await this.ai.models.generateContent({
        model:    "gemini-2.0-flash",
        contents: prompt,
      });
      const text = response.text ?? "";
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) throw new Error("No JSON in response");
      return JSON.parse(json) as ScenePromptSet;
    } catch (err) {
      console.warn("[image-prompt] Gemini failed, using fallback:", err instanceof Error ? err.message : err);
      return this.fallbackPrompts(topic);
    }
  }

  private fallbackPrompts(topic: string): ScenePromptSet {
    const t = topic.slice(0, 40);
    return {
      hook:    { imagePrompt: `dramatic dark cinematic close-up, tension and urgency, ${t}, slow motion, 9:16 portrait`, caption: "Most fail this", keyWord: "fail" },
      insight: { imagePrompt: `bright modern breakthrough moment, clarity and insight, ${t}, cinematic slow motion, 9:16`, caption: "Here is why", keyWord: "why" },
      cta:     { imagePrompt: `inspiring forward motion, sunrise cityscape, success energy, ${t}, cinematic 9:16`, caption: "Follow for more", keyWord: "follow" },
    };
  }
}
