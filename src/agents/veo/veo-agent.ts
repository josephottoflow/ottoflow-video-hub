/**
 * VEO AGENT — Google Veo 3.1 Lite text-to-video + image-to-video
 *
 * Generates cinematic 9:16 video clips via the official Gemini API.
 * Falls back gracefully if the API key lacks Veo access.
 */

import { GoogleGenAI } from "@google/genai";
import * as fs   from "fs";
import * as path from "path";

export interface VeoSceneClip {
  beat:      "hook" | "insight" | "cta";
  clipPath:  string;
  durationS: number;
}

export interface VeoSceneInput {
  imagePath: string;
  prompt:    string;
}

const VEO_MODEL        = "veo-3.1-lite-generate-preview";
const POLL_INTERVAL_MS = 10_000;
const MAX_WAIT_MS      = 360_000;

const SCENE_DURATIONS: Array<{ beat: "hook" | "insight" | "cta"; durationS: number }> = [
  { beat: "hook",    durationS: 5 },
  { beat: "insight", durationS: 8 },
  { beat: "cta",     durationS: 5 },
];

// Text-to-video durations — all 8s (veo-3.1-lite-preview only accepts 4–8; 8 is safest)
const TEXT_SCENE_DURATIONS: Array<{ beat: "hook" | "insight" | "cta"; durationS: number }> = [
  { beat: "hook",    durationS: 8 },
  { beat: "insight", durationS: 8 },
  { beat: "cta",     durationS: 8 },
];

export class VeoAgent {
  private ai: GoogleGenAI | null;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  static isAvailable(): boolean {
    return !!process.env.GOOGLE_API_KEY;
  }

  /**
   * Generate a single clip from a text prompt. Returns the output path on success, null on failure.
   * durationS is clamped to [4, 8] by the caller (Veo API constraint).
   */
  async generateSingleClip(
    prompt:    string,
    outPath:   string,
    durationS: number
  ): Promise<string | null> {
    if (!this.ai) return null;
    if (fs.existsSync(outPath)) return outPath;
    try {
      return await this.generateFromText(prompt, outPath, durationS);
    } catch (err) {
      console.error(`[veo] generateSingleClip failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async animateScenes(
    scenes:  { hook: VeoSceneInput; insight: VeoSceneInput; cta: VeoSceneInput },
    slug:    string,
    tempDir: string
  ): Promise<VeoSceneClip[]> {
    if (!this.ai) {
      console.warn("[veo] No GOOGLE_API_KEY — skipping video animation");
      return [];
    }

    const clips = await Promise.all(
      SCENE_DURATIONS.map(async ({ beat, durationS }) => {
        const { imagePath, prompt } = scenes[beat];
        if (!imagePath || !fs.existsSync(imagePath)) {
          console.warn(`[veo] Image missing for ${beat} — skipping`);
          return null;
        }

        const outPath = path.join(tempDir, `clip-${beat}.mp4`);
        if (fs.existsSync(outPath)) {
          console.log(`[veo] Using cached clip-${beat}.mp4`);
          return { beat, clipPath: outPath, durationS } as VeoSceneClip;
        }

        try {
          console.log(`[veo] Animating ${beat} scene (${durationS}s)...`);
          const clipPath = await this.animateOne(imagePath, prompt, outPath, durationS);
          console.log(`[veo] ${beat}: saved ${path.basename(clipPath)}`);
          return { beat, clipPath, durationS } as VeoSceneClip;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[veo] ${beat} failed (falling back to static): ${msg}`);
          return null;
        }
      })
    );

    return clips.filter((c): c is VeoSceneClip => c !== null);
  }

  /**
   * Generate video clips from text prompts only — no source image required.
   * Clips loop in Remotion to fill the scene duration.
   */
  async generateScenesFromText(
    prompts: { hook: string; insight: string; cta: string },
    slug:    string,
    tempDir: string
  ): Promise<VeoSceneClip[]> {
    if (!this.ai) {
      console.warn("[veo] No GOOGLE_API_KEY — skipping text-to-video");
      return [];
    }

    const clips = await Promise.all(
      TEXT_SCENE_DURATIONS.map(async ({ beat, durationS }) => {
        const prompt  = prompts[beat];
        const outPath = path.join(tempDir, `clip-${beat}.mp4`);

        if (fs.existsSync(outPath)) {
          console.log(`[veo] Using cached clip-${beat}.mp4`);
          return { beat, clipPath: outPath, durationS } as VeoSceneClip;
        }

        try {
          console.log(`[veo] Text-to-video ${beat} (${durationS}s)...`);
          const clipPath = await this.generateFromText(prompt, outPath, durationS);
          console.log(`[veo] ${beat}: saved ${path.basename(clipPath)}`);
          return { beat, clipPath, durationS } as VeoSceneClip;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[veo] ${beat} text-to-video failed: ${msg}`);
          return null;
        }
      })
    );

    return clips.filter((c): c is VeoSceneClip => c !== null);
  }

  private async generateFromText(
    prompt:   string,
    outPath:  string,
    durationS: number
  ): Promise<string> {
    let operation = await this.ai!.models.generateVideos({
      model:  VEO_MODEL,
      prompt: `${prompt}. Slow cinematic camera movement, smooth motion, dramatic lighting, photorealistic 9:16 portrait, no text overlays.`,
      config: {
        numberOfVideos:  1,
        durationSeconds: durationS,
        aspectRatio:     "9:16",
      },
    });

    const deadline = Date.now() + MAX_WAIT_MS;
    while (!operation.done) {
      if (Date.now() > deadline) throw new Error(`Veo timed out after ${MAX_WAIT_MS / 60000}min`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      operation = await this.ai!.operations.getVideosOperation({ operation });
    }

    if (operation.error) throw new Error(`Veo operation failed: ${JSON.stringify(operation.error)}`);

    const generated = operation.response?.generatedVideos?.[0];
    if (!generated?.video) throw new Error("Veo returned no video");

    const { videoBytes, uri } = generated.video;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    if (videoBytes) {
      fs.writeFileSync(outPath, Buffer.from(videoBytes, "base64"));
    } else if (uri) {
      const res = await fetch(uri);
      if (!res.ok) throw new Error(`Failed to download video: ${res.statusText}`);
      fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
    } else {
      throw new Error("Veo response has neither videoBytes nor uri");
    }

    return outPath;
  }

  private async animateOne(
    imagePath: string,
    prompt:    string,
    outPath:   string,
    durationS: number
  ): Promise<string> {
    const imageBytes = fs.readFileSync(imagePath).toString("base64");

    let operation = await this.ai!.models.generateVideos({
      model:  VEO_MODEL,
      prompt: `${prompt}. Slow cinematic camera movement, smooth motion, dramatic lighting, photorealistic, no text overlays.`,
      image: { imageBytes, mimeType: "image/jpeg" },
      config: {
        numberOfVideos:  1,
        durationSeconds: durationS,
        aspectRatio:     "9:16",
      },
    });

    const deadline = Date.now() + MAX_WAIT_MS;
    while (!operation.done) {
      if (Date.now() > deadline) throw new Error(`Veo timed out after ${MAX_WAIT_MS / 60000}min`);
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      operation = await this.ai!.operations.getVideosOperation({ operation });
    }

    if (operation.error) throw new Error(`Veo operation failed: ${JSON.stringify(operation.error)}`);

    const generated = operation.response?.generatedVideos?.[0];
    if (!generated?.video) throw new Error("Veo returned no video");

    const { videoBytes, uri } = generated.video;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    if (videoBytes) {
      fs.writeFileSync(outPath, Buffer.from(videoBytes, "base64"));
    } else if (uri) {
      const res = await fetch(uri);
      if (!res.ok) throw new Error(`Failed to download video from ${uri}: ${res.statusText}`);
      fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
    } else {
      throw new Error("Veo response has neither videoBytes nor uri");
    }

    return outPath;
  }
}
