/**
 * STORYBOARD AGENT — Gemini-powered creative director
 * Generates a complete dynamic JSON storyboard per render.
 * Every call produces different scene count, pacing, visual style, and narrative arc.
 */

import { GoogleGenAI } from "@google/genai";

export type VisualStyle  = "dark-cinematic" | "bright-minimal" | "neon-tech" | "warm-story" | "high-contrast";
export type CaptionStyle = "impact" | "word-by-word" | "slide-up" | "pulse";
export type MusicMood    = "tense" | "uplifting" | "mysterious" | "energetic" | "calm";
export type ZoomDir      = "in" | "out" | "pan";
export type SceneBeat    = "hook" | "reveal" | "insight" | "proof" | "cta";

export interface StoryboardScene {
  id:           string;
  beat:         SceneBeat;
  seconds:      number;
  frames:       number;         // seconds * 30
  narration:    string;
  visualPrompt: string;
  caption:      string;
  keyWord:      string;
  zoomDir:      ZoomDir;
  captionStyle: CaptionStyle;
}

export interface Storyboard {
  topic:       string;
  visualStyle: VisualStyle;
  musicMood:   MusicMood;
  totalFrames: number;
  fullScript:  string;
  scenes:      StoryboardScene[];
}

const VARIANT_GUIDE: Record<string, string> = {
  "problem-first": `Scene 1 (hook, 3-4s): Shocking problem or pain point
Scene 2 (reveal, 4-6s): Why the problem is worse than they think
Scene 3 (insight, 5-7s): Core insight or turning-point knowledge
Scene 4 (proof, 3-5s): Specific stat, example, or proof point
Scene 5 (cta, 2-3s): Strong call to action`,

  "stat-first": `Scene 1 (hook, 3-4s): Shocking statistic or number
Scene 2 (insight, 5-7s): What that number means and why it matters
Scene 3 (proof, 4-6s): Context, trend, or a second data point
Scene 4 (cta, 2-3s): What to do with this information`,

  "story-arc": `Scene 1 (hook, 3-4s): "I used to struggle with this..." — personal, relatable
Scene 2 (reveal, 4-6s): "Then I discovered the turning point..."
Scene 3 (insight, 5-7s): "Here is what actually changed..." — the lesson
Scene 4 (proof, 3-5s): Show or state the tangible result
Scene 5 (cta, 2-3s): Invite them to the same transformation`,

  "myth-bust": `Scene 1 (hook, 3-4s): State the popular belief everyone holds
Scene 2 (reveal, 4-6s): Deliver the reality check: "But the truth is..."
Scene 3 (proof, 4-6s): Back it up with stats, examples, real evidence
Scene 4 (insight, 4-5s): What actually works instead
Scene 5 (cta, 2-3s): Follow for more myth-busting`,
};

const HOOK_GUIDE: Record<string, string> = {
  "question":       "Open with a provocative question that speaks to the viewer's pain or desire",
  "bold-statement": "Open with a bold, contrarian, or unexpected claim — no hedging",
  "conflict":       "Open by naming a contradiction or paradox the viewer will recognize",
  "promise":        "Open with a clear, specific promise of transformation or result",
  "shock":          "Open with something surprising, alarming, or counterintuitive",
  "story":          "Open mid-story — as if the viewer just walked into something happening",
};

export class StoryboardAgent {
  private ai: GoogleGenAI | null;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  static isAvailable(): boolean {
    return !!process.env.GOOGLE_API_KEY;
  }

  async generate(
    topic:         string,
    style:         string,
    renderVariant: string = "problem-first",
    hookStyle:     string = "shock"
  ): Promise<Storyboard> {
    if (!this.ai) {
      console.warn("[storyboard] No GOOGLE_API_KEY — using fallback storyboard");
      return this.fallback(topic, renderVariant);
    }

    const variantGuide = VARIANT_GUIDE[renderVariant] ?? VARIANT_GUIDE["problem-first"];
    const hookGuide    = HOOK_GUIDE[hookStyle]        ?? HOOK_GUIDE["shock"];

    const prompt = `You are a viral TikTok creative director. Generate a complete video storyboard JSON.

TOPIC: "${topic}"
CONTENT STYLE: "${style}"
NARRATIVE VARIANT: ${renderVariant}
HOOK STYLE: ${hookStyle} — ${hookGuide}

NARRATIVE ARC (follow this scene structure):
${variantGuide}

VISUAL STYLES (pick ONE that fits the topic emotional tone):
- "dark-cinematic": dramatic tension, contrast, urgency — myths, problems, warnings
- "bright-minimal": clean, optimistic — how-tos, growth, transformation
- "neon-tech": deep dark with electric accents — AI, tech, data, automation
- "warm-story": golden intimate feel — personal stories, human moments
- "high-contrast": bold black/white aesthetic — big claims, statistics, shock

CAPTION STYLES (vary across scenes — never repeat same style twice in a row):
- "impact": 2-3 power words, one highlighted (hook and cta)
- "word-by-word": words appear sequentially (revelations)
- "slide-up": phrase slides up from bottom (mid-video insights)
- "pulse": words scale-pulse in (proof points)

MUSIC MOODS: tense | uplifting | mysterious | energetic | calm

RULES:
1. Scene count: match variant guide (3-5 scenes)
2. Narration per scene: 6-12 words ONLY. Punchy. No filler.
3. Total narration: 30-45 words across ALL scenes
4. caption: 2-3 words ONLY. Power words. No articles.
5. keyWord: ONE word from caption (most impactful, lowercase)
6. frames = seconds * 30 (integer)
7. visualPrompt: cinematic, specific, NO text overlays, 9:16 portrait, slow motion, photorealistic
8. First scene beat = "hook". Last scene beat = "cta".
9. zoomDir: vary — never same direction twice in a row

Return ONLY valid JSON:
{
  "visualStyle": "dark-cinematic",
  "musicMood": "tense",
  "scenes": [
    { "id": "s1", "beat": "hook", "seconds": 4, "frames": 120, "narration": "...", "visualPrompt": "...", "caption": "EXAMPLE HOOK", "keyWord": "hook", "zoomDir": "in", "captionStyle": "impact" }
  ]
}`;

    try {
      const response = await this.ai.models.generateContent({
        model:    "gemini-2.0-flash",
        contents: prompt,
      });

      const text = response.text ?? "";
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) throw new Error("No JSON in Gemini response");

      const raw = JSON.parse(json) as {
        visualStyle?: string;
        musicMood?:   string;
        scenes?:      Partial<StoryboardScene>[];
      };

      if (!raw.scenes?.length) throw new Error("Storyboard has no scenes");

      const scenes: StoryboardScene[] = raw.scenes.map((s, i) => {
        const secs = Math.max(3, Math.min(12, Number(s.seconds) || 5));
        const VALID_ZOOM:    ZoomDir[]      = ["in", "out", "pan"];
        const VALID_CAPTION: CaptionStyle[] = ["impact", "word-by-word", "slide-up", "pulse"];
        return {
          id:           s.id           ?? `s${i + 1}`,
          beat:         (s.beat        ?? (i === 0 ? "hook" : i === raw.scenes!.length - 1 ? "cta" : "insight")) as SceneBeat,
          seconds:      secs,
          frames:       secs * 30,
          narration:    s.narration    ?? "",
          visualPrompt: s.visualPrompt ?? `${topic}, cinematic 9:16, slow motion, dramatic lighting`,
          caption:      (s.caption     ?? topic.split(" ").slice(0, 3).join(" ")).toUpperCase(),
          keyWord:      ((s.keyWord    ?? (s.caption ?? "now").split(" ")[0])).toLowerCase(),
          zoomDir:      VALID_ZOOM.includes(s.zoomDir as ZoomDir) ? (s.zoomDir as ZoomDir) : VALID_ZOOM[i % 3],
          captionStyle: VALID_CAPTION.includes(s.captionStyle as CaptionStyle) ? (s.captionStyle as CaptionStyle) : "impact",
        };
      });

      const fullScript  = scenes.map(s => s.narration).filter(Boolean).join(" ");
      const totalFrames = scenes.reduce((sum, s) => sum + s.frames, 0);

      console.log(`[storyboard] ${scenes.length} scenes, ${totalFrames}f (${(totalFrames / 30).toFixed(1)}s), style=${raw.visualStyle}`);
      console.log(`[storyboard] Script (${fullScript.split(" ").length}w): ${fullScript.slice(0, 80)}...`);

      return {
        topic,
        visualStyle: (raw.visualStyle ?? "dark-cinematic") as VisualStyle,
        musicMood:   (raw.musicMood   ?? "tense") as MusicMood,
        totalFrames,
        fullScript,
        scenes,
      };
    } catch (err) {
      console.error("[storyboard] Gemini failed:", err instanceof Error ? err.message : err);
      return this.fallback(topic, renderVariant);
    }
  }

  private fallback(topic: string, renderVariant: string): Storyboard {
    const t = topic.slice(0, 40);

    const scenesByVariant: Record<string, StoryboardScene[]> = {
      "myth-bust": [
        { id: "s1", beat: "hook",    seconds: 4, frames: 120, narration: `Everyone thinks they understand ${t}.`,                              visualPrompt: `Confident people making assumptions, dramatic backlighting, ${t}, 9:16 portrait, slow zoom`,                 caption: "EVERYONE THINKS",  keyWord: "thinks",  zoomDir: "in",  captionStyle: "impact"       },
        { id: "s2", beat: "reveal",  seconds: 5, frames: 150, narration: "But 73% of practitioners get the fundamentals completely wrong.",     visualPrompt: "Shocked reaction, red warning indicators, dark tense office, slow zoom, 9:16",                              caption: "73% WRONG",        keyWord: "wrong",   zoomDir: "pan", captionStyle: "word-by-word" },
        { id: "s3", beat: "insight", seconds: 7, frames: 210, narration: "The real approach focuses on systems, not symptoms. Always has.",     visualPrompt: "Clean structured diagram, systematic workflow, professional environment, 9:16 cinematic",                   caption: "SYSTEMS WIN",      keyWord: "systems", zoomDir: "pan", captionStyle: "slide-up"     },
        { id: "s4", beat: "cta",     seconds: 3, frames: 90,  narration: "Follow for the framework that actually works.",                       visualPrompt: "Professional looking directly at camera, confident minimal background, natural light, 9:16",                 caption: "FOLLOW NOW",       keyWord: "follow",  zoomDir: "in",  captionStyle: "pulse"        },
      ],
      "stat-first": [
        { id: "s1", beat: "hook",    seconds: 4, frames: 120, narration: `Only 14% of professionals truly master ${t}.`,                        visualPrompt: "Bold statistic visualization, dark dramatic background, spotlight on number, 9:16 slow zoom",                 caption: "ONLY 14%",         keyWord: "14%",     zoomDir: "in",  captionStyle: "impact"       },
        { id: "s2", beat: "insight", seconds: 7, frames: 210, narration: "Those who do earn 3x more and work half as hard. That is the gap.",    visualPrompt: "Two contrasting environments, success vs struggle, dramatic split lighting, 9:16 cinematic",                  caption: "3X MORE",          keyWord: "3x",      zoomDir: "pan", captionStyle: "slide-up"     },
        { id: "s3", beat: "proof",   seconds: 4, frames: 120, narration: "The data does not lie. This works across every industry.",             visualPrompt: "Upward trending graphs, green success metrics, clean data visualization, 9:16 slow zoom out",                caption: "DATA PROVES",      keyWord: "data",    zoomDir: "out", captionStyle: "word-by-word" },
        { id: "s4", beat: "cta",     seconds: 3, frames: 90,  narration: "Follow to close that gap starting today.",                            visualPrompt: "Upward motion, sunrise, bright optimistic energy, 9:16 portrait",                                           caption: "CLOSE THE GAP",   keyWord: "gap",     zoomDir: "in",  captionStyle: "pulse"        },
      ],
    };

    const scenes = scenesByVariant[renderVariant] ?? [
      { id: "s1", beat: "hook" as SceneBeat,    seconds: 4, frames: 120, narration: `Most people get ${t} completely wrong.`,                  visualPrompt: `Dramatic close-up, tension and urgency, ${t} environment, slow cinematic push-in, 9:16`,                   caption: "MOST FAIL THIS",   keyWord: "fail",    zoomDir: "in"  as ZoomDir, captionStyle: "impact"       as CaptionStyle },
      { id: "s2", beat: "reveal" as SceneBeat,  seconds: 5, frames: 150, narration: "Here is the painful truth nobody wants to admit.",         visualPrompt: "Reality check moment, sharp contrast lighting, raw honest environment, 9:16 portrait",                      caption: "THE TRUTH",        keyWord: "truth",   zoomDir: "pan" as ZoomDir, captionStyle: "word-by-word" as CaptionStyle },
      { id: "s3", beat: "insight" as SceneBeat, seconds: 7, frames: 210, narration: "The real secret is simpler than any expert admits.",       visualPrompt: "Clarity and breakthrough moment, light breaking through, modern professional, 9:16 slow pan",               caption: "ONE THING",        keyWord: "one",     zoomDir: "pan" as ZoomDir, captionStyle: "slide-up"     as CaptionStyle },
      { id: "s4", beat: "cta" as SceneBeat,     seconds: 3, frames: 90,  narration: "Follow for more frameworks that actually deliver.",         visualPrompt: "Confident direct-to-camera moment, clean backdrop, forward momentum, 9:16 portrait",                       caption: "FOLLOW NOW",       keyWord: "follow",  zoomDir: "in"  as ZoomDir, captionStyle: "pulse"        as CaptionStyle },
    ];

    const fullScript  = scenes.map(s => s.narration).join(" ");
    const totalFrames = scenes.reduce((sum, s) => sum + s.frames, 0);

    return { topic, visualStyle: "dark-cinematic", musicMood: "tense", totalFrames, fullScript, scenes };
  }
}
