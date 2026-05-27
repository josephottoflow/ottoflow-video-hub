/**
 * IMAGEN AGENT — Gemini 2.0 Flash image generation per scene
 *
 * Uses GOOGLE_API_KEY (already in .env) — no new signup needed.
 * Generates one 9:16 portrait image per scene, saves to temp/{slug}/
 *
 * Model: gemini-2.0-flash-exp (v1alpha API)
 *
 * Critical: gemini-2.0-flash-exp only exists in API version v1alpha, NOT v1beta.
 * The default GoogleGenAI client uses v1beta → 404. A separate client with
 * apiVersion:"v1alpha" is required for image generation.
 * Imagen 3 (models.generateImages) requires Vertex AI service-account auth → unusable.
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

export interface SceneImage {
  beat:      "hook" | "insight" | "cta";
  imagePath: string;
}

export class Imagen3Agent {
  private ai:      GoogleGenAI | null;  // v1beta — used for everything except image gen
  private aiAlpha: GoogleGenAI | null;  // v1alpha — required for gemini-2.0-flash-exp image gen

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai      = apiKey ? new GoogleGenAI({ apiKey }) : null;
    this.aiAlpha = apiKey ? new GoogleGenAI({ apiKey, apiVersion: "v1alpha" }) : null;
  }

  static isAvailable(): boolean {
    return !!process.env.GOOGLE_API_KEY;
  }

  /**
   * Generate a single image from a text prompt. Returns the output path on success, null on failure.
   */
  async generateSingleImage(prompt: string, outPath: string): Promise<string | null> {
    if (!this.aiAlpha) {
      console.warn("[imagen3] GOOGLE_API_KEY not set — skipping image generation");
      return null;
    }
    if (fs.existsSync(outPath)) {
      console.log(`[imagen3] Using cached image: ${path.basename(outPath)}`);
      return outPath;
    }
    try {
      const buf = await this.generateImageBytes(prompt);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, buf);
      console.log(`[imagen3] saved ${(buf.length/1024).toFixed(0)}KB → ${path.basename(outPath)}`);
      return outPath;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      let detail = msg;
      try {
        const asStr = JSON.stringify(err);
        if (asStr !== "{}") detail = asStr;
      } catch { /* non-serialisable */ }
      console.error(`[imagen3] generateSingleImage FAILED — model=gemini-2.0-flash-exp path=${path.basename(outPath)}`);
      console.error(`[imagen3] error.message: ${msg}`);
      if (detail !== msg) console.error(`[imagen3] error.detail: ${detail.slice(0, 1000)}`);
      return null;
    }
  }

  async generateSceneImages(
    prompts: { hook: string; insight: string; cta: string },
    slug: string,
    tempDir: string
  ): Promise<SceneImage[]> {
    if (!this.aiAlpha) {
      console.warn("[imagen3] No GOOGLE_API_KEY — skipping image generation");
      return [];
    }

    const results: SceneImage[] = [];
    const beats = [
      { beat: "hook"    as const, prompt: prompts.hook    },
      { beat: "insight" as const, prompt: prompts.insight },
      { beat: "cta"     as const, prompt: prompts.cta     },
    ];

    for (const { beat, prompt } of beats) {
      try {
        const imagePath = await this.generateOne(prompt, beat, slug, tempDir);
        results.push({ beat, imagePath });
        console.log(`[imagen3] ${beat}: ${path.basename(imagePath)}`);
      } catch (err) {
        console.error(`[imagen3] Failed for ${beat}:`, err instanceof Error ? err.message : err);
      }
    }

    return results;
  }

  private async generateOne(
    prompt:  string,
    beat:    string,
    slug:    string,
    tempDir: string
  ): Promise<string> {
    const buffer  = await this.generateImageBytes(prompt);
    const outPath = path.join(tempDir, `scene-${beat}.jpg`);
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(outPath, buffer);
    return outPath;
  }

  /**
   * Core image generation via Gemini 2.0 Flash experimental.
   * Must use apiVersion:"v1alpha" — the model only exists there, not in v1beta.
   */
  private async generateImageBytes(prompt: string): Promise<Buffer> {
    const response = await this.aiAlpha!.models.generateContent({
      model:    "gemini-2.0-flash-exp",
      contents: this.enhancePrompt(prompt),
      config:   { responseModalities: ["IMAGE"] },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart?.inlineData?.data) {
      const respSummary = JSON.stringify(response).slice(0, 500);
      console.error(`[imagen3] no image part in response: ${respSummary}`);
      throw new Error("Gemini image generation returned no image data");
    }
    return Buffer.from(imagePart.inlineData.data, "base64");
  }

  private enhancePrompt(prompt: string): string {
    return `${prompt}. Portrait orientation 9:16, photorealistic, sharp focus, natural authentic color grading, no text, no watermarks, no UI overlays.`;
  }
}
