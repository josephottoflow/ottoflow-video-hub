/**
 * IMAGEN 3 AGENT — Google AI image generation per scene
 *
 * Uses GOOGLE_API_KEY (already in .env) — no new signup needed.
 * Generates one 9:16 portrait image per scene, saves to temp/{slug}/
 *
 * Model: imagen-3.0-generate-002
 */

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs";
import * as path from "path";

export interface SceneImage {
  beat:      "hook" | "insight" | "cta";
  imagePath: string;
}

export class Imagen3Agent {
  private ai: GoogleGenAI | null;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  static isAvailable(): boolean {
    return !!process.env.GOOGLE_API_KEY;
  }

  /**
   * Generate a single image from a text prompt. Returns the output path on success, null on failure.
   */
  async generateSingleImage(prompt: string, outPath: string): Promise<string | null> {
    if (!this.ai) return null;
    if (fs.existsSync(outPath)) return outPath;
    try {
      const response = await this.ai.models.generateImages({
        model:  "imagen-3.0-generate-002",
        prompt: this.enhancePrompt(prompt),
        config: { numberOfImages: 1, aspectRatio: "9:16", outputMimeType: "image/jpeg" },
      });
      const image = response.generatedImages?.[0];
      if (!image?.image?.imageBytes) throw new Error("No image bytes returned");
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, Buffer.from(image.image.imageBytes, "base64"));
      return outPath;
    } catch (err) {
      console.error(`[imagen3] generateSingleImage failed: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  async generateSceneImages(
    prompts: { hook: string; insight: string; cta: string },
    slug: string,
    tempDir: string
  ): Promise<SceneImage[]> {
    if (!this.ai) {
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
    const response = await this.ai!.models.generateImages({
      model:  "imagen-3.0-generate-002",
      prompt: this.enhancePrompt(prompt),
      config: {
        numberOfImages:  1,
        aspectRatio:     "9:16",
        outputMimeType:  "image/jpeg",
      },
    });

    const image = response.generatedImages?.[0];
    if (!image?.image?.imageBytes) throw new Error("No image bytes returned");

    const buffer   = Buffer.from(image.image.imageBytes, "base64");
    const outPath  = path.join(tempDir, `scene-${beat}.jpg`);
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(outPath, buffer);

    return outPath;
  }

  private enhancePrompt(prompt: string): string {
    return `${prompt}. Cinematic photography, portrait orientation 9:16, dramatic lighting, photorealistic, sharp focus, professional color grading, no text, no watermarks.`;
  }
}
