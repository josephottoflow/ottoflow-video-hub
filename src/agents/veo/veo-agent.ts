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
  // Set to true after a 429 quota error — stops burning time on subsequent clips
  private quotaExhausted = false;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  static isAvailable(): boolean {
    return !!process.env.GOOGLE_API_KEY;
  }

  /** Reset quota flag — call at the start of each job so a new job gets a fresh attempt. */
  resetQuota(): void {
    this.quotaExhausted = false;
  }

  /**
   * Generate a single clip from a text prompt. Returns the output path on success, null on failure.
   * If a 429 quota error is seen, sets quotaExhausted=true so subsequent clips are skipped
   * immediately rather than wasting 5s per clip on guaranteed failures.
   */
  async generateSingleClip(
    prompt:    string,
    outPath:   string,
    durationS: number
  ): Promise<string | null> {
    if (!this.ai) {
      console.warn("[veo] GOOGLE_API_KEY not set — skipping clip generation");
      return null;
    }
    if (this.quotaExhausted) {
      console.warn(`[veo] Quota exhausted — skipping ${path.basename(outPath)} (fast-fail)`);
      return null;
    }
    if (fs.existsSync(outPath)) {
      console.log(`[veo] Using cached clip: ${path.basename(outPath)}`);
      return outPath;
    }
    // veo-3.1-lite-generate-preview only accepts 4 or 8 seconds — snap to nearest valid value
    const safeDuration = durationS <= 6 ? 4 : 8;
    if (safeDuration !== durationS) {
      console.log(`[veo] Snapping duration ${durationS}s → ${safeDuration}s (model constraint)`);
    }
    try {
      return await this.generateFromText(prompt, outPath, safeDuration);
    } catch (err) {
      const msg   = err instanceof Error ? err.message : String(err);
      let detail  = msg;
      try {
        const asStr = JSON.stringify(err);
        if (asStr !== "{}") detail = asStr;
      } catch { /* non-serialisable */ }
      // 429 = daily/project quota exhausted — flag it so remaining clips fast-fail
      if (msg.includes("429") || detail.includes("429") || detail.includes("RESOURCE_EXHAUSTED")) {
        this.quotaExhausted = true;
        console.error(`[veo] QUOTA EXHAUSTED — remaining clips will be skipped. Reset at next daily quota cycle.`);
      }
      console.error(`[veo] generateSingleClip FAILED — model=${VEO_MODEL} duration=${safeDuration}s path=${path.basename(outPath)}`);
      console.error(`[veo] error.message: ${msg}`);
      if (detail !== msg) console.error(`[veo] error.detail: ${detail.slice(0, 1000)}`);
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
    // Pass the storyboard's UGC-native visualPrompt directly — do NOT append generic
    // "dramatic lighting" or "cinematic" modifiers that override the creator-realism doctrine.
    // The storyboard already includes: handheld framing, natural light, real environments,
    // behavioral cues, and TikTok-native framing. Appending "dramatic lighting" fights that.
    const veoPrompt = `${prompt}. 9:16 vertical portrait, natural authentic motion, no text overlays, no UI elements.`;
    let operation = await this.ai!.models.generateVideos({
      model:  VEO_MODEL,
      prompt: veoPrompt,
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

    if (operation.error) {
      const errJson = JSON.stringify(operation.error);
      console.error(`[veo] operation error: ${errJson}`);
      throw new Error(`Veo operation failed: ${errJson}`);
    }

    const generated = operation.response?.generatedVideos?.[0];
    if (!generated?.video) {
      const respJson = JSON.stringify(operation.response ?? {}).slice(0, 500);
      console.error(`[veo] no video in response. operation.done=${operation.done} response=${respJson}`);
      throw new Error("Veo returned no video in response");
    }

    const { videoBytes, uri } = generated.video;
    fs.mkdirSync(path.dirname(outPath), { recursive: true });

    if (videoBytes) {
      fs.writeFileSync(outPath, Buffer.from(videoBytes, "base64"));
      console.log(`[veo] wrote ${(Buffer.from(videoBytes,"base64").length/1024/1024).toFixed(1)}MB from videoBytes`);
    } else if (uri) {
      console.log(`[veo] downloading from uri: ${uri.slice(0, 80)}`);
      const apiKey = process.env.GOOGLE_API_KEY ?? "";
      const dlUrl  = `${uri}${uri.includes("?") ? "&" : "?"}key=${apiKey}`;
      const res = await fetch(dlUrl);
      if (!res.ok) throw new Error(`Failed to download video from uri: HTTP ${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outPath, buf);
      console.log(`[veo] downloaded ${(buf.length/1024/1024).toFixed(1)}MB`);
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
      prompt: `${prompt}. 9:16 vertical portrait, natural authentic motion, no text overlays, no UI elements.`,
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
      const apiKey = process.env.GOOGLE_API_KEY ?? "";
      const dlUrl  = `${uri}${uri.includes("?") ? "&" : "?"}key=${apiKey}`;
      const res = await fetch(dlUrl);
      if (!res.ok) throw new Error(`Failed to download video from ${uri}: ${res.statusText}`);
      fs.writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
    } else {
      throw new Error("Veo response has neither videoBytes nor uri");
    }

    return outPath;
  }
}
