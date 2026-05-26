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

export interface VisualTheme {
  palette:    string;   // 3-5 named colors or hex values shared across ALL scenes
  lighting:   string;   // shared lighting style (golden hour, neon, rim light, etc.)
  lens:       string;   // lens character (shallow DOF, 35mm, macro, etc.)
  filmLook:   string;   // film look (16mm grain, clean digital, anamorphic, etc.)
  motion:     string;   // motion language (locked-off, slow dolly, handheld, etc.)
}

export interface StoryboardScene {
  id:           string;
  beat:         SceneBeat;
  seconds:      number;
  frames:       number;         // seconds * 30
  narration:    string;
  visualPrompt: string;         // 40-80 word cinematic prompt including shared visual theme
  caption:      string;
  keyWord:      string;
  zoomDir:      ZoomDir;
  captionStyle: CaptionStyle;
  composition?: string;         // shot type + angle (ECU, CU, MS, WS, OTS)
  cameraMove?:  string;         // locked / slow dolly in / tracking / crane up
}

export interface Storyboard {
  topic:        string;
  visualStyle:  VisualStyle;
  musicMood:    MusicMood;
  visualTheme:  VisualTheme;    // shared visual language locked before any scene is written
  totalFrames:  number;
  fullScript:   string;
  scenes:       StoryboardScene[];
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
    topic:          string,
    style:          string,
    renderVariant:  string = "problem-first",
    hookStyle:      string = "shock",
    existingScript?: string
  ): Promise<Storyboard> {
    if (!this.ai) {
      console.warn("[storyboard] No GOOGLE_API_KEY — using fallback storyboard");
      return this.fallback(topic, renderVariant);
    }

    const variantGuide = VARIANT_GUIDE[renderVariant] ?? VARIANT_GUIDE["problem-first"];
    const hookGuide    = HOOK_GUIDE[hookStyle]        ?? HOOK_GUIDE["shock"];

    const seedNote = existingScript?.trim()
      ? `\nSEED SCRIPT (use this as inspiration — preserve the angle and facts, improve the pacing):\n"${existingScript.trim()}"\n`
      : "";

    const prompt = `You are a cinematic TikTok creative director. Generate a complete video storyboard JSON for a short-form vertical video.

TOPIC: "${topic}"
CONTENT STYLE: "${style}"
NARRATIVE VARIANT: ${renderVariant}
HOOK STYLE: ${hookStyle} — ${hookGuide}${seedNote}

NARRATIVE ARC (follow this scene structure exactly):
${variantGuide}

STEP 1 — VISUAL THEME (establish this FIRST, applied to EVERY scene):
Pick ONE visual style and lock these shared values:
- palette: 3-4 specific colors (e.g. "deep navy #1a1f3c, electric blue #3b82f6, white #f8fafc")
- lighting: specific style (e.g. "rim lighting from behind, warm amber key light, deep shadows")
- lens: specific character (e.g. "shallow depth of field, 35mm full-frame look, gentle bokeh")
- filmLook: specific grade (e.g. "subtle film grain, muted saturation, warm 3200K color temperature")
- motion: specific movement style (e.g. "slow dolly push-ins, no handheld shake")

Visual style presets:
- "dark-cinematic": deep blacks, dramatic rim light, high contrast, 16mm grain — for myths, problems, warnings
- "bright-minimal": clean whites, soft diffused light, shallow DOF, digital clean — for how-tos, growth
- "neon-tech": electric color accents on deep dark, lens flare, digital precision — for AI, tech, data
- "warm-story": golden backlight, amber, cream tones, 35mm warmth — for personal stories, human moments
- "high-contrast": graphic black/white with single accent color, bold shadows — for stats, shock

STEP 2 — EACH SCENE must reference the Visual Theme in its visualPrompt.

CAPTION STYLES (vary across scenes — never same style twice in a row):
- "impact": 2-3 power words (hook and cta beats)
- "word-by-word": words appear sequentially (revelation beats)
- "slide-up": phrase slides up from bottom (insight beats)
- "pulse": words scale-pulse in (proof beats)

MUSIC MOODS: tense | uplifting | mysterious | energetic | calm

SHOT TYPES (pick the right one per beat):
- ECU (Extreme Close-Up): fine detail or intense emotion — eyes only, a specific object
- CU (Close-Up): face fills frame — dialogue, reaction, emotion
- MCU (Medium Close-Up): head and shoulders — conversation, interview feel
- MS (Medium Shot): waist up — action, general dialogue
- MLS (Medium Long Shot): knees up — walking, casual movement
- LS (Long Shot): full body — character in context
- WS (Wide Shot): environment dominant — location, scale, establishing
- EWS (Extreme Wide Shot): vast landscape — epic scope, isolation, scene transitions

CAMERA ANGLES (choose based on emotional intent):
- Eye level: neutral, natural — default
- Low angle: subject looks powerful, dominant — authority, heroism, threat
- High angle: subject looks small, vulnerable — weakness, overview
- Dutch angle: unease, disorientation — tension, chaos
- OTS (Over-the-Shoulder): viewer positioned with character — conversations

CONTINUITY RULES (enforce across ALL scenes):
1. 180-degree rule: imagine an axis through the subject. ALL camera positions must stay on ONE side of that axis. If shot 1 shows subject facing right, shots 2-4 must also show subject facing right. Never flip.
2. Screen direction: if a subject moves left-to-right in one scene, maintain that direction in the next. Reversing implies they turned around.
3. Shot variety: NEVER use the same shot type (ECU/CU/MS/WS etc.) twice in a row. Alternate between tight and wide.
4. Establishing first: first scene should use WS or wider to ground the viewer in space, unless the variant demands an ECU hook.

RULES:
1. Scene count: match variant guide (3-5 scenes)
2. Narration per scene: 6-12 words ONLY. Punchy. No filler.
3. Total narration: 30-45 words across ALL scenes
4. caption: 2-3 words ONLY. Power words. No articles.
5. keyWord: ONE word from caption (most impactful, lowercase)
6. frames = seconds * 30 (integer)
7. visualPrompt: 40-80 words, cinematic, concrete subjects (not vague), NO text overlays, MUST include the visual theme palette/lighting/lens/filmLook from Step 1, end with "cinematic 1080p, 9:16 vertical"
8. composition: shot type + angle from SHOT TYPES list above (e.g. "ECU, low angle" / "WS, eye level" / "CU, OTS")
9. cameraMove: specific move (locked / slow dolly in / slow dolly out / tracking / crane up / handheld / static)
10. First scene beat = "hook". Last scene beat = "cta".
11. zoomDir: vary — never same direction twice in a row
12. Respect continuity rules — note which side of the 180-degree axis each scene uses

Return ONLY valid JSON (no markdown, no explanation):
{
  "visualStyle": "dark-cinematic",
  "musicMood": "tense",
  "visualTheme": {
    "palette": "deep navy, electric blue, white highlights",
    "lighting": "rim light from behind, warm amber key, deep shadows",
    "lens": "shallow depth of field, 35mm full-frame look",
    "filmLook": "subtle 16mm grain, muted saturation, 3200K warm temperature",
    "motion": "slow dolly push-ins, locked establishing shots"
  },
  "scenes": [
    {
      "id": "s1", "beat": "hook", "seconds": 4, "frames": 120,
      "narration": "...",
      "composition": "ECU, slightly low angle",
      "cameraMove": "slow dolly in",
      "visualPrompt": "Extreme close-up slightly low angle of [concrete subject], [specific action], [lighting from visual theme], [lens character], [film look], [palette colors visible], cinematic 1080p, 9:16 vertical",
      "caption": "HOOK WORD", "keyWord": "hook", "zoomDir": "in", "captionStyle": "impact"
    }
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
        visualStyle?:  string;
        musicMood?:    string;
        visualTheme?:  Partial<VisualTheme>;
        scenes?:       Partial<StoryboardScene>[];
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
          composition:  s.composition,
          cameraMove:   s.cameraMove,
        };
      });

      const visualTheme: VisualTheme = {
        palette:  raw.visualTheme?.palette  ?? "cinematic tones",
        lighting: raw.visualTheme?.lighting ?? "dramatic rim lighting",
        lens:     raw.visualTheme?.lens     ?? "shallow depth of field",
        filmLook: raw.visualTheme?.filmLook ?? "subtle film grain",
        motion:   raw.visualTheme?.motion   ?? "slow dolly push-ins",
      };

      const fullScript  = scenes.map(s => s.narration).filter(Boolean).join(" ");
      const totalFrames = scenes.reduce((sum, s) => sum + s.frames, 0);

      console.log(`[storyboard] ${scenes.length} scenes, ${totalFrames}f (${(totalFrames / 30).toFixed(1)}s), style=${raw.visualStyle}`);
      console.log(`[storyboard] Theme: ${visualTheme.palette} | ${visualTheme.lighting}`);
      console.log(`[storyboard] Script (${fullScript.split(" ").length}w): ${fullScript.slice(0, 80)}...`);

      return {
        topic,
        visualStyle:  (raw.visualStyle ?? "dark-cinematic") as VisualStyle,
        musicMood:    (raw.musicMood   ?? "tense") as MusicMood,
        visualTheme,
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

    const fallbackTheme: VisualTheme = {
      palette:  "deep charcoal #1a1a2e, electric indigo #6366f1, white #f8fafc",
      lighting: "dramatic rim light from behind, deep shadows, high contrast",
      lens:     "shallow depth of field, 35mm full-frame look, subtle bokeh",
      filmLook: "subtle 16mm grain, muted saturation, cool 5500K tone",
      motion:   "slow dolly push-ins, locked establishing shots",
    };

    return { topic, visualStyle: "dark-cinematic", musicMood: "tense", visualTheme: fallbackTheme, totalFrames, fullScript, scenes };
  }
}
