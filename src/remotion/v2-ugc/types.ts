// v2 — V2 UGC template: dynamic AI storyboard, variable scene count, multiple caption styles

import { z } from "zod";

export const V2_FPS    = 30;
export const V2_WIDTH  = 1080;
export const V2_HEIGHT = 1920;
export const V2_TOTAL  = 600; // 20s fallback for legacy renders

// Legacy 3-scene constants — kept for backward compatibility
export const V2_SCENES = {
  hook:    { start: 0,   frames: 150 },
  insight: { start: 150, frames: 330 },
  cta:     { start: 480, frames: 120 },
} as const;

// ── Legacy per-scene schema (hook/insight/cta object) ────────────
const v2SceneSchema = z.object({
  imagePath:     z.string(),
  videoClipPath: z.string().optional(),
  caption:       z.string(),
  keyWord:       z.string(),
});

// ── Dynamic storyboard scene schema ──────────────────────────────
export const storyboardSceneSchema = z.object({
  id:           z.string(),
  beat:         z.enum(["hook", "reveal", "insight", "proof", "cta"]),
  seconds:      z.number(),
  frames:       z.number(),
  narration:    z.string(),
  visualPrompt: z.string(),
  caption:      z.string(),
  keyWord:      z.string(),
  zoomDir:      z.enum(["in", "out", "pan"]).default("in"),
  captionStyle: z.enum(["impact", "word-by-word", "slide-up", "pulse"]).default("impact"),
  imagePath:    z.string().optional(),
  videoClipPath: z.string().optional(),
});

export const visualThemeSchema = z.object({
  palette:  z.string(),
  lighting: z.string(),
  lens:     z.string(),
  filmLook: z.string(),
  motion:   z.string(),
});

export const storyboardSchema = z.object({
  topic:        z.string(),
  visualStyle:  z.enum(["dark-cinematic", "bright-minimal", "neon-tech", "warm-story", "high-contrast"]).default("dark-cinematic"),
  musicMood:    z.enum(["tense", "uplifting", "mysterious", "energetic", "calm"]).default("tense"),
  visualTheme:  visualThemeSchema.optional(),
  totalFrames:  z.number(),
  fullScript:   z.string(),
  scenes:       z.array(storyboardSceneSchema),
});

export const v2UGCSchema = z.object({
  data: z.object({
    topic:        z.string(),
    // Legacy: fixed 3-scene object (still supported)
    scenes: z.object({
      hook:    v2SceneSchema,
      insight: v2SceneSchema,
      cta:     v2SceneSchema,
    }).optional(),
    // Dynamic: storyboard-driven (takes priority over legacy scenes)
    storyboard:   storyboardSchema.optional(),
    voiceoverUrl: z.string().optional(),
  }).nullable(),
});

export type V2SceneLegacy  = z.infer<typeof v2SceneSchema>;
export type V2Scene        = z.infer<typeof storyboardSceneSchema>;
export type Storyboard     = z.infer<typeof storyboardSchema>;
export type V2UGCData      = NonNullable<z.infer<typeof v2UGCSchema>["data"]>;
export type V2UGCProps     = z.infer<typeof v2UGCSchema>;

// Visual style → overlay + highlight color
export const VISUAL_STYLE_TOKENS: Record<string, { overlayColor: string; highlightColor: string; overlayAlpha: number }> = {
  "dark-cinematic": { overlayColor: "0,0,0",     highlightColor: "#FFE500", overlayAlpha: 0.55 },
  "bright-minimal": { overlayColor: "10,10,30",   highlightColor: "#6366f1", overlayAlpha: 0.30 },
  "neon-tech":      { overlayColor: "5,0,20",     highlightColor: "#00ff88", overlayAlpha: 0.65 },
  "warm-story":     { overlayColor: "20,8,0",     highlightColor: "#FFD700", overlayAlpha: 0.50 },
  "high-contrast":  { overlayColor: "0,0,0",      highlightColor: "#FF0055", overlayAlpha: 0.70 },
};
