/**
 * STORYBOARD AGENT — Visual shot plan before PromptEngine
 *
 * Applies ai-video-storyboard skill to generate a 6-shot coordinated plan
 * with a Visual Consistency Layer before the PromptEngine builds video data.
 *
 * Output feeds directly into PromptEngine as enriched scene context,
 * ensuring visual coherence across all 6 cinematic scenes.
 *
 * Shot structure (30s TikTok Reel, Hook → Build → Payoff → CTA):
 *   Shot 1: Hook      — stop-the-scroll visual, ECU or bold graphic
 *   Shot 2: Problem   — relatable pain point or context
 *   Shot 3: Hero      — product / solution reveal
 *   Shot 4: Features  — benefit carousel, fast cuts
 *   Shot 5: Proof     — social proof, lifestyle shot
 *   Shot 6: CTA       — clear call to action
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ContentRow } from "../sheets/client";
import type { DesignSpec, ThemePreset, Mood } from "../design/design-agent";

// ─── Types ───────────────────────────────────────────────────

export type ShotPurpose = "hook" | "problem" | "hero" | "features" | "proof" | "cta";
export type CameraMove  = "locked" | "slow-dolly-in" | "slow-dolly-out" | "tracking" | "handheld" | "crane-up" | "pan";
export type ShotType    = "ECU" | "CU" | "MS" | "WS" | "OTS" | "POV" | "overhead";
export type FilmLook    = "clean-digital" | "cinematic-anamorphic" | "neon-glow" | "high-contrast" | "natural-warm";

export interface VisualTheme {
  palette:     string[];     // 3-5 hex values
  lighting:    string;       // e.g. "motivated neon rim light"
  lens:        string;       // e.g. "shallow DOF, 35mm equivalent"
  filmLook:    FilmLook;
  motion:      string;       // e.g. "slow dolly with subtle handheld"
}

export interface StoryboardShot {
  index:       number;       // 1-6
  purpose:     ShotPurpose;
  durationSec: number;
  shotType:    ShotType;
  cameraMove:  CameraMove;
  lighting:    string;
  subject:     string;
  action:      string;
  textOverlay: string;       // on-screen text for this scene
  audioNote:   string;       // music / VO direction
  pexelsQuery: string;       // best search term for Pexels background
}

export interface Storyboard {
  topic:        string;
  style:        string;
  totalSec:     number;
  shotCount:    number;
  visualTheme:  VisualTheme;
  shots:        StoryboardShot[];
  narrativeArc: string;      // one-line summary of the story arc
}

// ─── Storyboard Agent ────────────────────────────────────────

export class StoryboardAgent {
  private client: Anthropic | null;

  constructor() {
    this.client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
  }

  /**
   * Generate a 6-shot storyboard for a content row + design spec.
   * Falls back to a template-based storyboard when no API key is set.
   */
  async generate(row: ContentRow, design: DesignSpec): Promise<Storyboard> {
    if (!this.client) return this.fallbackStoryboard(row, design);

    const hook  = row.hookA || row.hookB || row.hookC || row.topic;
    const filmLook = this.themeToFilmLook(design.theme);

    const prompt = `You are a cinematic TikTok creative director. Generate a 6-shot storyboard for a 28-second vertical video (1080x1920, 30fps).

TOPIC: ${row.topic}
STYLE: ${row.style}
HOOK: ${hook}
SCRIPT: ${row.script ? row.script.slice(0, 400) : "(generate from topic)"}
VISUAL THEME: ${design.theme} theme, ${design.mood} mood
PRIMARY COLOR: ${design.brandColors.primary}
ACCENT COLOR: ${design.brandColors.accent}

Shot structure (6 shots = 28s):
- Shot 1 HOOK (4s): Stop the scroll — bold visual, ECU or graphic
- Shot 2 PROBLEM (5s): Relatable context or pain point
- Shot 3 HERO (5s): Core insight or solution reveal
- Shot 4 FEATURES (5s): 3 key benefits, fast visual
- Shot 5 PROOF (4s): Social proof or lifestyle moment
- Shot 6 CTA (5s): Clear call to action

Return ONLY valid JSON:
{
  "visualTheme": {
    "palette": ["${design.brandColors.primary}", "${design.brandColors.secondary}", "${design.brandColors.accent}", "#0a0a0a", "#ffffff"],
    "lighting": "describe the lighting style",
    "lens": "describe the lens/DOF character",
    "filmLook": "${filmLook}",
    "motion": "describe the motion language"
  },
  "narrativeArc": "one sentence describing the story arc",
  "shots": [
    {
      "index": 1,
      "purpose": "hook",
      "durationSec": 4,
      "shotType": "ECU|CU|MS|WS|OTS|POV|overhead",
      "cameraMove": "locked|slow-dolly-in|slow-dolly-out|tracking|handheld|crane-up|pan",
      "lighting": "specific lighting for this shot",
      "subject": "concrete description of what is in frame",
      "action": "what is happening in the shot",
      "textOverlay": "on-screen text for this scene (hook line, benefit, CTA)",
      "audioNote": "music beat or VO line direction",
      "pexelsQuery": "3-5 word Pexels video search term — MUST be topic-specific and visually concrete"
    }
    // ... 6 total
  ]
}

Rules:
- Every shot must reference the palette and lighting style (visual consistency)
- Text overlays must be short (max 8 words)
- pexelsQuery MUST be specific to the topic — NOT generic words like "background", "abstract", "concept", "dark background"
- pexelsQuery examples for "OKRs goal setting": "executive strategy whiteboard night", "team alignment meeting dark", "goal tracker notebook closeup", "performance review laptop office"
- pexelsQuery examples for "5 Whys method": "engineer analyzing factory problem", "root cause diagram whiteboard", "manufacturing inspection closeup", "problem solving team huddle"
- Think: what does an expert in this topic physically DO? What environment are they in? What tools do they use?
- Make subject descriptions specific — describe exactly what is in frame`;

    try {
      const message = await this.client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages:   [{ role: "user", content: prompt }],
      });

      const text = message.content[0];
      if (text.type !== "text") throw new Error("Unexpected Claude response");

      const raw    = text.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      const parsed = JSON.parse(raw);

      return {
        topic:       row.topic,
        style:       row.style,
        totalSec:    28,
        shotCount:   6,
        visualTheme: parsed.visualTheme || this.fallbackTheme(design),
        shots:       (parsed.shots || []).slice(0, 6),
        narrativeArc: parsed.narrativeArc || `${row.topic} — Hook to CTA`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("credit") || msg.includes("quota") || msg.includes("billing")) {
        console.warn(`[StoryboardAgent] API credits unavailable — using template storyboard`);
        return this.fallbackStoryboard(row, design);
      }
      throw err;
    }
  }

  /**
   * Extract Pexels queries from a storyboard for background fetching.
   * Returns deduplicated list, most important shots first.
   */
  getPexelsQueries(storyboard: Storyboard): string[] {
    const queries = storyboard.shots
      .map((s) => s.pexelsQuery)
      .filter(Boolean);
    return [...new Set(queries)];
  }

  /**
   * Format storyboard into a context string for the PromptEngine.
   */
  toPromptContext(storyboard: Storyboard): string {
    const theme = storyboard.visualTheme;
    const lines = [
      `VISUAL THEME: ${theme.filmLook} | ${theme.lighting} | ${theme.lens} | motion: ${theme.motion}`,
      `PALETTE: ${theme.palette.join(", ")}`,
      `STORY ARC: ${storyboard.narrativeArc}`,
      "",
      "SHOT PLAN:",
      ...storyboard.shots.map((s) =>
        `  Shot ${s.index} [${s.purpose.toUpperCase()}] ${s.durationSec}s — ${s.shotType}, ${s.cameraMove} | "${s.textOverlay}" | VO: ${s.audioNote}`
      ),
    ];
    return lines.join("\n");
  }

  // ─── Private Helpers ──────────────────────────────────────

  private themeToFilmLook(theme: ThemePreset): FilmLook {
    const map: Record<ThemePreset, FilmLook> = {
      neon:    "neon-glow",
      bold:    "high-contrast",
      tech:    "clean-digital",
      luxury:  "cinematic-anamorphic",
      outdoor: "natural-warm",
      minimal: "clean-digital",
    };
    return map[theme] || "clean-digital";
  }

  private fallbackTheme(design: DesignSpec): VisualTheme {
    return {
      palette:  [design.brandColors.primary, design.brandColors.secondary, design.brandColors.accent, "#0a0a0a", "#ffffff"],
      lighting: "motivated rim light with soft fill",
      lens:     "shallow DOF, 35mm equivalent",
      filmLook: this.themeToFilmLook(design.theme),
      motion:   "slow dolly with subtle handheld energy",
    };
  }

  private fallbackStoryboard(row: ContentRow, design: DesignSpec): Storyboard {
    const kw = row.topic.toLowerCase().split(" ").slice(0, 2).join(" ");
    const shots: StoryboardShot[] = [
      { index: 1, purpose: "hook",     durationSec: 4, shotType: "ECU", cameraMove: "slow-dolly-in",  lighting: "high-key rim light",  subject: "bold graphic with hook text",      action: "text animates in fast",    textOverlay: (row.hookA || row.topic).slice(0, 50), audioNote: "punchy beat drop",          pexelsQuery: `${kw} dramatic closeup dark` },
      { index: 2, purpose: "problem",  durationSec: 5, shotType: "MS",  cameraMove: "handheld",        lighting: "motivated natural",    subject: "person looking concerned at data", action: "slow head shake",          textOverlay: "The hidden problem",                  audioNote: "tense underscore",          pexelsQuery: `${kw} frustrated person office` },
      { index: 3, purpose: "hero",     durationSec: 5, shotType: "CU",  cameraMove: "slow-dolly-in",  lighting: "clean backlight",      subject: "insight or core concept visual",   action: "reveal with light flash",  textOverlay: row.topic.slice(0, 40),                audioNote: "triumphant sting",          pexelsQuery: `${kw} insight strategy night` },
      { index: 4, purpose: "features", durationSec: 5, shotType: "MS",  cameraMove: "tracking",        lighting: "motivated fill",       subject: "three key benefit callouts",       action: "fast cuts between points", textOverlay: "3 things you need to know",           audioNote: "rhythmic beat",             pexelsQuery: `${kw} professional team meeting` },
      { index: 5, purpose: "proof",    durationSec: 4, shotType: "WS",  cameraMove: "crane-up",        lighting: "golden hour warm",     subject: "success metric or social proof",   action: "number counter animation", textOverlay: "Results that matter",                 audioNote: "inspirational swell",       pexelsQuery: `${kw} success achievement growth` },
      { index: 6, purpose: "cta",      durationSec: 5, shotType: "MS",  cameraMove: "locked",          lighting: "motivated rim light",  subject: "follow button and channel brand",  action: "call to action pulse",     textOverlay: "Follow for more",                     audioNote: "outro beat",                pexelsQuery: `${kw} action motivation confident` },
    ];
    return {
      topic:       row.topic,
      style:       row.style,
      totalSec:    28,
      shotCount:   6,
      visualTheme: this.fallbackTheme(design),
      shots,
      narrativeArc: `${row.topic} — from problem awareness to actionable insight`,
    };
  }
}
