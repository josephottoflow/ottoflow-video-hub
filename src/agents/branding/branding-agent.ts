/**
 * BRANDING AGENT — Ottoflow brand profile + content tone adapter
 *
 * Stores the Ottoflow brand identity and adapts video content
 * (hooks, CTAs, captions) to match the brand voice.
 *
 * Brand source: https://ottoflow.ai/
 */

import type { ContentRow } from "../sheets/client";
import type { DesignSpec } from "../design/design-agent";

// ─── Ottoflow Brand Profile ───────────────────────────────────

export const OTTOFLOW_BRAND = {
  name:        "Ottoflow",
  tagline:     "Automate Intelligently. Grow Effortlessly.",
  website:     "https://ottoflow.ai/",
  email:       "joseph@ottoflow.ai",

  voice: {
    tone:        "Professional yet approachable. Confident. Solution-oriented. Slight wit.",
    persona:     "The smart automation partner — not a tool, a growth engine.",
    avoid:       ["jargon overload", "hype without substance", "passive language"],
    embrace:     ["clear value", "specific outcomes", "action-oriented CTAs", "credibility signals"],
  },

  colors: {
    primary:    "#6366f1",  // indigo — tech-forward, trustworthy
    secondary:  "#4f46e5",  // deep indigo
    accent:     "#818cf8",  // light indigo highlight
    background: "#0a0a0a",  // near-black
    text:       "#ffffff",
    cta:        "#f59e0b",  // amber — TikTok basket yellow
  },

  typography: {
    headline:   "bold black — short punchy statements",
    subheadline: "regular — supporting context",
    cta:        "bold uppercase — action-driving",
  },

  contentPillars: [
    "AI automation tips",
    "n8n workflow tutorials",
    "Business efficiency wins",
    "Case studies & ROI proof",
    "Behind-the-build content",
  ],

  ctas: [
    "Automate this →",
    "Build it with Ottoflow",
    "Get the workflow",
    "Link in bio",
    "DM us to automate",
    "ottoflow.ai",
  ],

  hashtags: [
    "ottoflow", "aiautomation", "n8nautomation", "workflowautomation",
    "businessautomation", "aitools", "automatemore", "nocode",
    "startuptools", "growthhacking", "productivityhacks", "aiagents",
  ] as string[],
} as const;

// ─── Design spec override for Ottoflow brand ─────────────────

export const OTTOFLOW_DESIGN: DesignSpec = {
  theme:          "tech",
  mood:           "professional",
  brandColors: {
    primary:    OTTOFLOW_BRAND.colors.primary,
    secondary:  OTTOFLOW_BRAND.colors.secondary,
    accent:     OTTOFLOW_BRAND.colors.accent,
    background: OTTOFLOW_BRAND.colors.background,
    text:       OTTOFLOW_BRAND.colors.text,
  },
  overlayStyle:   "gradient",
  overlayOpacity: 0.55,
  fontWeight:     "bold",
  textEffect:     "glow",
  rationale:      "Ottoflow brand — indigo tech palette, confident & clean",
};

// ─── Branding Agent ───────────────────────────────────────────

export class BrandingAgent {

  /**
   * Apply Ottoflow brand design to a content row.
   * Standardises colors to Ottoflow indigo but preserves the
   * DesignAgent's style-driven theme (bold/tech/outdoor/etc.) and mood
   * so lighting and visual energy match the content style.
   */
  applyBrand(design: DesignSpec): DesignSpec {
    return {
      ...design,
      brandColors: { ...OTTOFLOW_DESIGN.brandColors },
      // Keep DesignAgent theme/mood — they control lighting & visual energy
      textEffect: OTTOFLOW_DESIGN.textEffect,
    };
  }

  /**
   * Pick the best branded CTA for a given style.
   */
  getCta(style: string): string {
    const styleKey = style.toLowerCase();
    const map: Record<string, string> = {
      educational:       "Get the workflow",
      motivational:      "Automate this →",
      "case study":      "Build it with Ottoflow",
      lifestyle:         "Link in bio",
      "startup-focused": "DM us to automate",
      luxury:            "ottoflow.ai",
    };
    return map[styleKey] || OTTOFLOW_BRAND.ctas[0];
  }

  /**
   * Build branded hashtag set for a content row.
   * Merges topic-specific tags with Ottoflow brand tags.
   */
  getHashtags(row: ContentRow, topicTags: string[] = []): string[] {
    const brand   = [...OTTOFLOW_BRAND.hashtags];
    const topic   = topicTags.filter((t) => !brand.includes(t));
    const styleTag = row.style.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const all = [...new Set([...topic, styleTag, ...brand])];
    return all.slice(0, 20);
  }

  /**
   * Build the Telegram delivery caption in Ottoflow voice.
   */
  buildCaption(row: ContentRow, hashtags: string[]): string {
    const hook     = row.hookA || row.hookB || row.hookC || row.topic;
    const cta      = this.getCta(row.style);
    const tags     = hashtags.slice(0, 15).map((h) => `#${h}`).join(" ");
    const esc      = (t: string) => t.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");

    return [
      `🤖 *${esc(row.topic)}*`,
      ``,
      `🪝 ${esc(hook)}`,
      ``,
      row.script ? esc(row.script.slice(0, 200)) + (row.script.length > 200 ? "\\.\\.\\." : "") : "",
      ``,
      `👉 *${esc(cta)}*`,
      ``,
      esc(tags),
    ].filter(Boolean).join("\n");
  }

  /**
   * Returns the full brand profile (for logging/debugging).
   */
  getProfile() {
    return OTTOFLOW_BRAND;
  }
}
