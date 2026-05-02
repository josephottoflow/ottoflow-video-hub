/**
 * PROMPT ENGINE — Product Video Creative Direction (6-Scene Template)
 * Takes a product manifest and generates complete ProductVideoData:
 * brand colors, hook, intro, demo script, image showcase config,
 * feature callouts, social proof + CTA — all structured for Remotion.
 *
 * Uses Ollama (Llama) for structured JSON generation.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getConfig } from "../config/config";
import { ImageManifest } from "../ingestion/image-processor";
import { ProductVideoDataSchema } from "../../remotion/types";
import type { ProductVideoData } from "../../remotion/types";

// === Prompt for Full 6-Scene Creative Direction ===

const CREATIVE_DIRECTION_PROMPT = `You are a viral TikTok product video director. Generate complete creative direction for a 25-second product showcase video.

PRODUCT: {{productName}}
PRODUCT URL: {{sourceUrl}}
NUMBER OF PRODUCT IMAGES: {{imageCount}}
IMAGE PATHS (for reference): {{imagePaths}}

Generate a JSON object with creative direction for all 6 scenes:

SCENE 1 — HOOK (3s):
- painPointQuestion: A bold, attention-grabbing question that makes viewers stop scrolling.
  Examples: "Still editing videos manually?", "Why is everyone obsessed with this?"
  Must relate to the product category.

SCENE 2 — PRODUCT INTRO (3s):
- productName: The actual product name
- tagline: A punchy tagline (real one if known, or create one that sounds authentic)
- logoPath: Leave empty string if no logo

BRAND COLORS:
- primary: Main brand color (guess from product category if unknown — tech=#6366f1, beauty=#ec4899, fitness=#10b981, food=#f59e0b)
- secondary: Supporting color
- accent: Highlight/CTA color (usually warm — orange, yellow, or contrasting)
- background: "#0a0a0a" (dark)
- text: "#ffffff"

SCENE 3 — SIMULATED DEMO (8s):
- inputPlaceholder: What goes in the input field (relates to how you'd use the product)
- typedText: Text that types character by character (a realistic user input)
- buttonText: CTA button text ("Get It", "Try Now", "Generate", "Shop Now")
- resultText: What appears as the result (a benefit or outcome)
- resultSubtext: Optional secondary text

SCENE 4 — IMAGE SHOWCASE (5s):
- images: Array of {{imageCount}} objects, each with:
  - path: Use the actual image paths provided
  - headline: Short (max 6 words) feature headline for each image

SCENE 5 — FEATURE CALLOUTS (3s):
- features: 3 benefit lines with icons. Use icons from: check, lightning, star, shield, zap, heart
- productImagePath: Use the first image path

SCENE 6 — SOCIAL PROOF + CTA (3s):
- socialProofNumber: A realistic number (or null if unknown). For TikTok products, use 1000-100000 range
- socialProofLabel: "happy customers", "units sold", "5-star reviews", etc.
- ctaUrl: "Link in bio ↗" or "Tap the yellow bag ↗"

TONE: Excited, authentic TikTok creator energy. Like someone who genuinely discovered something amazing.
Make it feel REAL, not corporate.`;

// === Prompt Engine ===

export class PromptEngine {
  private config = getConfig();

  /**
   * Generate complete ProductVideoData from a product manifest.
   * This is the main entry point — returns everything Remotion needs.
   */
  async generateVideoData(manifest: ImageManifest): Promise<ProductVideoData> {
    const imagePaths = manifest.images.map((img) => img.processedPath);

    const prompt = CREATIVE_DIRECTION_PROMPT
      .replace(/\{\{productName\}\}/g, manifest.productName)
      .replace(/\{\{sourceUrl\}\}/g, manifest.sourceUrl)
      .replace(/\{\{imageCount\}\}/g, String(manifest.totalImages))
      .replace(/\{\{imagePaths\}\}/g, imagePaths.join(", "));

    const result = await this.ollamaStructuredCompletion(
      prompt,
      ProductVideoDataSchema
    );

    // Ensure productSlug is set
    result.productSlug = manifest.productSlug;

    // Ensure image paths reference the actual processed images
    result.imageShowcase.images = result.imageShowcase.images.map((img, i) => ({
      ...img,
      path: imagePaths[i] || imagePaths[0],
    }));
    result.featureCallouts.productImagePath = imagePaths[0];

    // Ensure all required fields are present with proper types
    const finalResult: ProductVideoData = {
      productSlug: result.productSlug,
      brandColors: {
        primary: result.brandColors.primary,
        secondary: result.brandColors.secondary,
        accent: result.brandColors.accent,
        background: result.brandColors.background || "#0a0a0a",
        text: result.brandColors.text || "#ffffff",
      },
      hook: result.hook,
      productIntro: result.productIntro,
      simulatedDemo: result.simulatedDemo,
      imageShowcase: result.imageShowcase,
      featureCallouts: result.featureCallouts,
      socialProofCta: result.socialProofCta,
      backgrounds: result.backgrounds
        ? {
            photos: result.backgrounds.photos || [],
            videos: result.backgrounds.videos || [],
          }
        : undefined,
    };

    return finalResult;
  }

  /**
   * Generate video data and save as video-data.json for Remotion.
   */
  async generateAndSave(
    manifest: ImageManifest,
    outputDir: string
  ): Promise<ProductVideoData> {
    const fs = await import("fs");
    const path = await import("path");

    const videoData = await this.generateVideoData(manifest);

    const dataPath = path.join(outputDir, "video-data.json");
    fs.writeFileSync(dataPath, JSON.stringify(videoData, null, 2));

    return videoData;
  }

  // === Ollama Structured Completion ===

  private async ollamaStructuredCompletion<T>(
    prompt: string,
    schema: z.ZodType<T>
  ): Promise<T> {
    if (!this.config.ollama) {
      throw new Error("Ollama not configured — set OLLAMA_URL in .env");
    }
    const ollamaConfig = this.config.ollama;
    const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" }) as any;

    const systemPrompt = `You are an AI assistant that ONLY responds with valid JSON.
Your response must strictly match this JSON schema:
${JSON.stringify(jsonSchema, null, 2)}

IMPORTANT: Output ONLY the JSON object. No markdown, no code fences, no explanation.`;

    const response = await fetch(
      `${ollamaConfig.url}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: ollamaConfig.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          format: "json",
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Ollama API error: ${await response.text()}`);
    }

    const data = await response.json();
    const content = data.message?.content;

    if (!content) {
      throw new Error("No content in Ollama response");
    }

    const parsed = JSON.parse(content);
    return schema.parse(parsed);
  }
}

// Re-export types for convenience
export type { ProductVideoData } from "../../remotion/types";
