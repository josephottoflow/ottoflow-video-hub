import type { StageDefinition, Tier } from "./types";

// Stage implementations — imported lazily below to avoid circular deps at module load
import { topicValidate }  from "./stages/01-topic-validate";
import { scriptGenerate } from "./stages/02-script-generate";
import { hookGenerate }   from "./stages/03-hook-generate";
import { scenePlan }      from "./stages/04-scene-plan";
import { assetCollect }   from "./stages/05-asset-collect";
import { voiceGenerate }  from "./stages/06-voice-generate";
import { captionGenerate } from "./stages/07-caption-generate";
import { sceneBuild }     from "./stages/08-scene-build";
import { lipsync }        from "./stages/09-lipsync";
import { remotionRender } from "./stages/10-remotion-render";
import { musicMix }       from "./stages/11-music-mix";
import { upscale }        from "./stages/12-upscale";
import { exportStage }    from "./stages/13-export";
import { upload }         from "./stages/14-upload";
import { analytics }      from "./stages/15-analytics";
import { publishQueue }   from "./stages/16-publish-queue";

// ── Stage registry ────────────────────────────────────────────────────────────
//
// tiers: ["basic"] = only runs for basic tier
//        ["advanced"] = only runs for advanced tier
//        ["basic","advanced"] = runs for both
//
// critical: false = failure is logged but pipeline continues (non-blocking step)

export const STAGE_REGISTRY: Record<string, StageDefinition> = {
  "topic-validate": {
    fn:          topicValidate,
    timeoutMs:   5_000,
    maxAttempts: 1,
    critical:    true,
    canSkip:     false,
    tiers:       ["basic", "advanced"],
    description: "Validate and normalise the topic string",
  },
  "script-generate": {
    fn:          scriptGenerate,
    timeoutMs:   60_000,
    maxAttempts: 3,
    critical:    true,
    canSkip:     false,
    tiers:       ["basic", "advanced"],
    description: "Generate 30-35 word voiceover script + hook variations via Gemini Flash",
  },
  "hook-generate": {
    fn:          hookGenerate,
    timeoutMs:   30_000,
    maxAttempts: 2,
    critical:    false,
    canSkip:     true,
    tiers:       ["basic", "advanced"],
    description: "Select and refine the best hook variation",
  },
  "scene-plan": {
    fn:          scenePlan,
    timeoutMs:   45_000,
    maxAttempts: 2,
    critical:    false,
    canSkip:     false,
    tiers:       ["advanced"],
    description: "Generate scene-by-scene visual plan for the video",
  },
  "asset-collect": {
    fn:          assetCollect,
    timeoutMs:   120_000,
    maxAttempts: 2,
    critical:    false,
    canSkip:     false,
    tiers:       ["basic", "advanced"],
    description: "Fetch background video/image assets (Pexels for basic, Veo/Imagen3 for advanced)",
  },
  "voice-generate": {
    fn:          voiceGenerate,
    timeoutMs:   120_000,
    maxAttempts: 3,
    critical:    true,
    canSkip:     false,
    tiers:       ["basic", "advanced"],
    description: "Generate voiceover via ElevenLabs (cache-first)",
  },
  "caption-generate": {
    fn:          captionGenerate,
    timeoutMs:   30_000,
    maxAttempts: 2,
    critical:    false,
    canSkip:     true,
    tiers:       ["basic", "advanced"],
    description: "Generate word-level captions from script",
  },
  "scene-build": {
    fn:          sceneBuild,
    timeoutMs:   30_000,
    maxAttempts: 1,
    critical:    true,
    canSkip:     false,
    tiers:       ["basic", "advanced"],
    description: "Assemble Remotion composition data from assets",
  },
  "lipsync": {
    fn:          lipsync,
    timeoutMs:   300_000,
    maxAttempts: 2,
    critical:    false,
    canSkip:     true,
    tiers:       ["advanced"],
    description: "D-ID avatar lipsync (advanced only, skippable)",
  },
  "remotion-render": {
    fn:          remotionRender,
    timeoutMs:   600_000,
    maxAttempts: 1,
    critical:    true,
    canSkip:     false,
    tiers:       ["basic", "advanced"],
    description: "Render final video via Remotion / Chrome Headless Shell",
  },
  "music-mix": {
    fn:          musicMix,
    timeoutMs:   120_000,
    maxAttempts: 2,
    critical:    false,
    canSkip:     true,
    tiers:       ["basic", "advanced"],
    description: "Mix background music into rendered video via FFmpeg",
  },
  "upscale": {
    fn:          upscale,
    timeoutMs:   180_000,
    maxAttempts: 1,
    critical:    false,
    canSkip:     true,
    tiers:       ["advanced"],
    description: "AI upscale to 4K (advanced only)",
  },
  "export": {
    fn:          exportStage,
    timeoutMs:   60_000,
    maxAttempts: 2,
    critical:    true,
    canSkip:     false,
    tiers:       ["basic", "advanced"],
    description: "Final format/codec export and file validation",
  },
  "upload": {
    fn:          upload,
    timeoutMs:   120_000,
    maxAttempts: 3,
    critical:    true,
    canSkip:     false,
    tiers:       ["basic", "advanced"],
    description: "Upload final video to Google Drive and obtain share link",
  },
  "analytics": {
    fn:          analytics,
    timeoutMs:   15_000,
    maxAttempts: 1,
    critical:    false,
    canSkip:     true,
    tiers:       ["advanced"],
    description: "Record render analytics and quality score",
  },
  "publish-queue": {
    fn:          publishQueue,
    timeoutMs:   15_000,
    maxAttempts: 2,
    critical:    false,
    canSkip:     true,
    tiers:       ["advanced"],
    description: "Queue video for Telegram approval and TikTok publish",
  },
};

// ── Ordered stage lists ───────────────────────────────────────────────────────

export const ALL_STAGES = [
  "topic-validate",
  "script-generate",
  "hook-generate",
  "scene-plan",
  "asset-collect",
  "voice-generate",
  "caption-generate",
  "scene-build",
  "lipsync",
  "remotion-render",
  "music-mix",
  "upscale",
  "export",
  "upload",
  "analytics",
  "publish-queue",
] as const;

export type StageName = (typeof ALL_STAGES)[number];

/** Return the ordered stage names that should run for the given tier. */
export function getStagesForTier(tier: Tier): StageName[] {
  return ALL_STAGES.filter((name) => {
    const def = STAGE_REGISTRY[name];
    return def && def.tiers.includes(tier);
  }) as StageName[];
}
