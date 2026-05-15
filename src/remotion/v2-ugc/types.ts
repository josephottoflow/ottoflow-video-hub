// v2 — V2 UGC template: 3-scene, AI image or Veo video clip backgrounds, bold captions

import { z } from "zod";

export const V2_FPS    = 30;
export const V2_WIDTH  = 1080;
export const V2_HEIGHT = 1920;
export const V2_TOTAL  = 600; // 20s

export const V2_SCENES = {
  hook:    { start: 0,   frames: 150 }, // 5s
  insight: { start: 150, frames: 330 }, // 11s
  cta:     { start: 480, frames: 120 }, // 4s
} as const;

const v2SceneSchema = z.object({
  imagePath:     z.string(),
  videoClipPath: z.string().optional(), // Veo-animated clip URL (prefers over static image)
  caption:       z.string(),
  keyWord:       z.string(),
});

export const v2UGCSchema = z.object({
  data: z.object({
    topic:        z.string(),
    scenes:       z.object({
      hook:    v2SceneSchema,
      insight: v2SceneSchema,
      cta:     v2SceneSchema,
    }),
    voiceoverUrl: z.string().optional(),
  }).nullable(),
});

export type V2Scene    = z.infer<typeof v2SceneSchema>;
export type V2UGCData  = NonNullable<z.infer<typeof v2UGCSchema>["data"]>;
export type V2UGCProps = z.infer<typeof v2UGCSchema>;
