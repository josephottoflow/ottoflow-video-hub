/**
 * SEO AGENT — Viral Title, Description & Hashtag Generator
 * Uses Ollama (Llama) structured JSON output to generate
 * TikTok-optimized SEO metadata: viral titles, engaging descriptions,
 * and trending hashtags for maximum discoverability.
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getConfig } from "../config/config";

// === Zod Schemas for Structured Output ===

export const SeoOutputSchema = z.object({
  title: z.string().describe("Viral TikTok video title, max 150 chars"),
  description: z
    .string()
    .describe("Engaging TikTok description with emojis, max 2200 chars"),
  hashtags: z
    .array(z.string())
    .describe("15-25 trending and niche hashtags without # prefix"),
  hook: z
    .string()
    .describe("First-line hook to stop the scroll, max 80 chars"),
  cta: z
    .string()
    .describe("Call-to-action for the end of the video, max 100 chars"),
});

export type SeoOutput = z.infer<typeof SeoOutputSchema>;

// === SEO Generator ===

export class SeoGenerator {
  private config = getConfig();

  /**
   * Generate viral SEO metadata for a TikTok product video.
   */
  async generate(
    productName: string,
    productDetails?: string
  ): Promise<SeoOutput> {
    const prompt = this.buildPrompt(productName, productDetails);
    const result = await this.ollamaStructuredCompletion(prompt, SeoOutputSchema);
    return result;
  }

  /**
   * Generate and save SEO metadata to files in the output directory.
   */
  async generateAndSave(
    productName: string,
    outputDir: string,
    productDetails?: string
  ): Promise<SeoOutput> {
    const seo = await this.generate(productName, productDetails);

    const fs = await import("fs");
    const path = await import("path");

    // Write individual files
    fs.writeFileSync(
      path.join(outputDir, "title.txt"),
      seo.title,
      "utf-8"
    );

    fs.writeFileSync(
      path.join(outputDir, "description.txt"),
      `${seo.hook}\n\n${seo.description}\n\n${seo.cta}\n\n${seo.hashtags.map((h) => `#${h}`).join(" ")}`,
      "utf-8"
    );

    fs.writeFileSync(
      path.join(outputDir, "hashtags.txt"),
      seo.hashtags.map((h) => `#${h}`).join(" "),
      "utf-8"
    );

    return seo;
  }

  // === Prompt Builder ===

  private buildPrompt(productName: string, productDetails?: string): string {
    return `You are a viral TikTok Shop content strategist. Your job is to create SEO-optimized metadata that maximizes views, engagement, and sales conversions on TikTok.

PRODUCT: ${productName}
${productDetails ? `DETAILS: ${productDetails}` : ""}

Generate viral TikTok video metadata for this product. Follow these rules:

TITLE RULES:
- Max 150 characters
- Use power words: "INSANE", "GAME-CHANGER", "YOU NEED THIS", "VIRAL", "MUST HAVE"
- Include the product category for search
- Create curiosity gap — make people NEED to watch
- Format: Hook + Product + Benefit

DESCRIPTION RULES:
- Max 2200 characters
- Start with a scroll-stopping hook
- Use emojis strategically (not overdone)
- Include social proof language ("everyone's talking about", "sold out 3x")
- Add urgency ("limited stock", "price going up")
- End with a clear CTA
- Mention TikTok Shop / link in bio

HASHTAG RULES:
- 15-25 hashtags
- Mix of: 5 mega-trending (#fyp #viral #tiktokshop), 5 category (#beauty #skincare), 5 product-specific, 5 community (#tiktokmademebuyit)
- No # prefix in the output
- All lowercase

HOOK RULES:
- Max 80 characters
- This is the first thing viewers see
- Must create instant curiosity or FOMO
- Examples: "Wait till you see what this does...", "I can't believe this is real"

CTA RULES:
- Max 100 characters
- Drive to TikTok Shop link
- Create urgency
- Examples: "Link in bio before it sells out!", "Tap the yellow bag NOW"`;
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
