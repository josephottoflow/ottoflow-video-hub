/**
 * PROMPT ENGINE — Explainer Video Creative Director
 *
 * Uses Claude to generate storyboard-style video data from a ContentRow.
 * Produces kinetic-typography-ready content: short punchy sentences, no
 * mid-word truncation, proper explainer structure.
 */

import Anthropic from "@anthropic-ai/sdk";
import { ProductVideoDataSchema } from "../../remotion/types";
import type { ProductVideoData } from "../../remotion/types";
import type { ContentRow } from "../sheets/client";
import * as fs from "fs";
import * as path from "path";

// === Style → brand colors ===

const STYLE_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  educational:       { primary: "#6366f1", secondary: "#4f46e5", accent: "#818cf8" },
  motivational:      { primary: "#dc2626", secondary: "#991b1b", accent: "#f87171" },
  "case study":      { primary: "#0891b2", secondary: "#0e7490", accent: "#22d3ee" },
  lifestyle:         { primary: "#059669", secondary: "#047857", accent: "#34d399" },
  "startup-focused": { primary: "#7c3aed", secondary: "#6d28d9", accent: "#a78bfa" },
  luxury:            { primary: "#d97706", secondary: "#92400e", accent: "#f59e0b" },
  default:           { primary: "#6366f1", secondary: "#4f46e5", accent: "#818cf8" },
};

// === Prompt Engine ===

export class PromptEngine {
  private client: Anthropic | null;

  constructor() {
    this.client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
  }

  async generateFromContent(
    row: ContentRow,
    slug: string,
    backgroundPaths: { photos: string[]; videos: string[] },
    storyboardContext?: string
  ): Promise<ProductVideoData> {
    if (!this.client) return this.fallbackVideoData(row, slug, backgroundPaths);

    const styleKey = row.style.toLowerCase();
    const colors   = STYLE_COLORS[styleKey] || STYLE_COLORS.default;
    const bestHook = row.hookA || row.hookB || row.hookC || row.topic;

    // Photo paths for image showcase (background photos, not product images)
    const p0 = backgroundPaths.photos[0] || "";
    const p1 = backgroundPaths.photos[1] || p0;
    const p2 = backgroundPaths.photos[2] || p0;

    const prompt = `You are a TikTok explainer video director. Write kinetic-text-ready content: short, punchy, complete phrases. NO sentences that end mid-word.

TOPIC: ${row.topic}
STYLE: ${row.style}
HOOK OPTIONS:
  A: ${row.hookA || "(none)"}
  B: ${row.hookB || "(none)"}
  C: ${row.hookC || "(none)"}
SCRIPT (first 600 chars): ${row.script ? row.script.slice(0, 600) : "Generate from topic."}
${storyboardContext ? `\nSTORYBOARD:\n${storyboardContext}` : ""}

OUTPUT this exact JSON — fill every field. Rules:
• painPointQuestion: Pick the BEST hook. Must be a complete thought. Max 7 words. Hook must make them stop scrolling.
• tagline: One punchy line about the topic. Max 35 chars. Must be a complete thought.
• typedText: What someone would Google about this topic. Max 35 chars.
• resultText: The core insight in 8 words or fewer. COMPLETE THOUGHT.
• resultSubtext: One word category label (e.g. "Business", "Science").
• image headlines: Each max 3 words. Must be a complete phrase.
• feature texts: Each max 5 words. Be punchy. COMPLETE thoughts. No cutting mid-word.
  Good: "Reduces errors by 99.9%" — Bad: "Reduces errors by 99.9"
• socialProofNumber: A real statistic related to the topic (companies using it, studies, etc.)
• socialProofLabel: What the number represents, max 4 words.
• ctaUrl: "Follow for daily insights"
• featureTitle: Scene 4 label — make it SPECIFIC to the topic. NOT generic "How It Works".
  Examples: "The DMAIC Steps", "3 Root Causes", "Where Teams Fail", "The Core Framework",
  "Why It Works", "Key Principles", "Proven Results", "By The Numbers"

{
  "hook": {
    "painPointQuestion": "<complete attention-grabbing question or statement>"
  },
  "productIntro": {
    "productName": "${row.topic}",
    "tagline": "<punchy one-liner, complete thought, ≤35 chars>"
  },
  "simulatedDemo": {
    "inputPlaceholder": "Search anything...",
    "typedText": "<what they'd Google, ≤35 chars>",
    "buttonText": "Learn More",
    "resultText": "<core insight, complete, ≤8 words>",
    "resultSubtext": "<one-word category>"
  },
  "imageShowcase": {
    "images": [
      { "path": "${p0}", "headline": "<3-word phrase>" },
      { "path": "${p1}", "headline": "<3-word phrase>" },
      { "path": "${p2}", "headline": "<3-word phrase>" }
    ]
  },
  "featureCallouts": {
    "productImagePath": "${p0}",
    "featureTitle": "<topic-specific scene label, ≤4 words, NOT 'How It Works'>",
    "features": [
      { "icon": "check",     "text": "<step or benefit, punchy, ≤5 words>" },
      { "icon": "lightning", "text": "<step or benefit, punchy, ≤5 words>" },
      { "icon": "star",      "text": "<step or benefit, punchy, ≤5 words>" },
      { "icon": "shield",    "text": "<step or benefit, punchy, ≤5 words>" }
    ]
  },
  "socialProofCta": {
    "socialProofNumber": <integer>,
    "socialProofLabel": "<4-word label>",
    "ctaUrl": "Follow for daily insights"
  }
}

Output ONLY the JSON. No markdown, no explanation.`;

    let parsed: Record<string, unknown>;
    try {
      const message = await this.client.messages.create({
        model:      "claude-sonnet-4-6",
        max_tokens: 1024,
        messages:   [{ role: "user", content: prompt }],
      });

      const block = message.content[0];
      if (block.type !== "text") throw new Error("Unexpected Claude response type");

      const raw = block.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("credit") || msg.includes("quota") || msg.includes("billing")) {
        console.warn(`[PromptEngine] API credits unavailable — using template data`);
        return this.fallbackVideoData(row, slug, backgroundPaths);
      }
      throw err;
    }

    type ParsedSection = Record<string, unknown>;

    const hook           = (parsed.hook          as ParsedSection | undefined) ?? {};
    const productIntro   = (parsed.productIntro   as ParsedSection | undefined) ?? {};
    const simulatedDemo  = (parsed.simulatedDemo  as ParsedSection | undefined) ?? {};
    const imageShowcase  = (parsed.imageShowcase  as ParsedSection | undefined) ?? {};
    const featureCallouts = (parsed.featureCallouts as ParsedSection | undefined) ?? {};
    const socialProofCta = (parsed.socialProofCta as ParsedSection | undefined) ?? {};

    const videoData: ProductVideoData = {
      productSlug: slug,
      brandColors: {
        primary:    colors.primary,
        secondary:  colors.secondary,
        accent:     colors.accent,
        background: "#0a0a0a",
        text:       "#ffffff",
      },
      hook: {
        painPointQuestion: (hook.painPointQuestion as string | undefined) || bestHook,
      },
      productIntro: {
        productName: (productIntro.productName as string | undefined) || row.topic,
        tagline:     (productIntro.tagline     as string | undefined) || row.topic,
      },
      simulatedDemo: {
        inputPlaceholder: (simulatedDemo.inputPlaceholder as string | undefined) || "Search anything...",
        typedText:        (simulatedDemo.typedText        as string | undefined) || row.topic,
        buttonText:       (simulatedDemo.buttonText       as string | undefined) || "Learn More",
        resultText:       (simulatedDemo.resultText       as string | undefined) || row.topic,
        resultSubtext:    (simulatedDemo.resultSubtext    as string | undefined) || row.style,
      },
      imageShowcase: {
        images: (Array.isArray((imageShowcase.images))
          ? (imageShowcase.images as Array<{ path: string; headline: string }>)
          : backgroundPaths.photos.slice(0, 3).map((p, i) => ({ path: p, headline: `Key point ${i + 1}` }))
        ),
      },
      featureCallouts: {
        productImagePath: (featureCallouts.productImagePath as string | undefined) || p0,
        featureTitle: (featureCallouts.featureTitle as string | undefined) || undefined,
        features: (Array.isArray(featureCallouts.features)
          ? (featureCallouts.features as Array<{ icon: "check" | "lightning" | "star" | "shield" | "zap" | "heart"; text: string }>)
          : []
        ),
      },
      socialProofCta: {
        socialProofNumber: typeof socialProofCta.socialProofNumber === "number"
          ? socialProofCta.socialProofNumber
          : undefined,
        socialProofLabel: (socialProofCta.socialProofLabel as string | undefined) || "people learned this",
        ctaUrl: (socialProofCta.ctaUrl as string | undefined) || "Follow for daily insights",
      },
      backgrounds: (backgroundPaths.photos.length > 0 || backgroundPaths.videos.length > 0)
        ? backgroundPaths
        : undefined,
    };

    return videoData;
  }

  private fallbackVideoData(
    row: ContentRow,
    slug: string,
    backgroundPaths: { photos: string[]; videos: string[] }
  ): ProductVideoData {
    const styleKey = row.style.toLowerCase();
    const colors   = STYLE_COLORS[styleKey] || STYLE_COLORS.default;
    const bestHook = row.hookA || row.hookB || row.hookC || row.topic;
    const photos   = backgroundPaths.photos;

    // Split script on ". " (period+space) — NOT bare "." to avoid splitting decimals
    const scriptLines = row.script
      ? row.script.split(/\.\s+/).filter(Boolean).slice(0, 4)
      : [];

    const w5 = (s: string) => s.trim().split(/\s+/).slice(0, 5).join(" ");
    const benefit1 = scriptLines[0] ? w5(scriptLines[0]) : `What is ${row.topic}`;
    const benefit2 = scriptLines[1] ? w5(scriptLines[1]) : "Why it matters";
    const benefit3 = scriptLines[2] ? w5(scriptLines[2]) : "How to apply it";
    const benefit4 = scriptLines[3] ? w5(scriptLines[3]) : "Real-world results";

    return {
      productSlug:  slug,
      brandColors:  { primary: colors.primary, secondary: colors.secondary, accent: colors.accent, background: "#0a0a0a", text: "#ffffff" },
      hook:         { painPointQuestion: bestHook },
      productIntro: { productName: row.topic, tagline: row.hookB || row.hookA || row.topic },
      simulatedDemo: {
        inputPlaceholder: "Search anything...",
        typedText:        row.topic.slice(0, 35),
        buttonText:       "Learn More",
        resultText:       benefit1,
        resultSubtext:    row.style,
      },
      imageShowcase: {
        images: [
          { path: photos[0] || "", headline: benefit1.split(" ").slice(0, 4).join(" ") },
          { path: photos[1] || photos[0] || "", headline: benefit2.split(" ").slice(0, 4).join(" ") },
          { path: photos[2] || photos[0] || "", headline: benefit3.split(" ").slice(0, 4).join(" ") },
        ],
      },
      featureCallouts: {
        productImagePath: photos[0] || "",
        featureTitle: `${row.topic.split(" ").slice(0, 3).join(" ")} — Key Points`,
        features: [
          { icon: "check",     text: benefit1 },
          { icon: "lightning", text: benefit2 },
          { icon: "star",      text: benefit3 },
          { icon: "shield",    text: benefit4 },
        ],
      },
      socialProofCta: {
        socialProofNumber: undefined,
        socialProofLabel:  "follow for more",
        ctaUrl:            "Follow for daily insights",
      },
      backgrounds: photos.length > 0 || backgroundPaths.videos.length > 0 ? backgroundPaths : undefined,
    };
  }

  async generateAndSave(
    row: ContentRow,
    slug: string,
    backgroundPaths: { photos: string[]; videos: string[] },
    outputDir: string
  ): Promise<ProductVideoData> {
    const videoData = await this.generateFromContent(row, slug, backgroundPaths);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, "video-data.json"), JSON.stringify(videoData, null, 2));
    return videoData;
  }
}

export type { ProductVideoData };
