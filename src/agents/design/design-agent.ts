/**
 * DESIGN AGENT — Visual theme + brand color generator
 *
 * Takes a ContentRow (topic + style) and returns a complete DesignSpec:
 * theme preset, brand colors, mood, overlay settings, font weight.
 *
 * Called by the orchestrator BEFORE prompt engine so every video
 * has a tailored visual identity instead of the hardcoded color map.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ContentRow } from "../sheets/client";

// ─── Types ───────────────────────────────────────────────────

export type ThemePreset = "tech" | "luxury" | "outdoor" | "minimal" | "bold" | "neon";
export type OverlayStyle = "gradient" | "solid" | "vignette" | "none";
export type FontWeight = "light" | "regular" | "bold" | "black";
export type TextEffect = "glow" | "shadow" | "outline" | "clean";
export type Mood = "energetic" | "calm" | "dramatic" | "playful" | "professional" | "mysterious";

export interface DesignSpec {
  theme: ThemePreset;
  brandColors: {
    primary:    string;  // main accent hex
    secondary:  string;  // darker variant
    accent:     string;  // highlight / CTA
    background: string;  // scene background
    text:       string;  // primary text
  };
  mood:           Mood;
  overlayStyle:   OverlayStyle;
  overlayOpacity: number;   // 0.0 – 1.0
  fontWeight:     FontWeight;
  textEffect:     TextEffect;
  rationale:      string;   // one-line explanation of the choices
}

export interface DesignAgentTask {
  id:          string;
  topic:       string;
  style:       string;
  status:      "queued" | "processing" | "done" | "error";
  result?:     DesignSpec;
  error?:      string;
  startedAt?:  string;
  completedAt?: string;
}

// ─── Fallback palette map (used when Claude is unavailable) ──

const FALLBACK: Record<string, DesignSpec> = {
  educational: {
    theme: "minimal", mood: "professional",
    brandColors: { primary: "#6366f1", secondary: "#4f46e5", accent: "#818cf8", background: "#0a0a0a", text: "#ffffff" },
    overlayStyle: "gradient", overlayOpacity: 0.55, fontWeight: "bold", textEffect: "shadow",
    rationale: "Clean indigo palette — builds trust for educational content",
  },
  motivational: {
    theme: "bold", mood: "energetic",
    brandColors: { primary: "#dc2626", secondary: "#991b1b", accent: "#f87171", background: "#0a0a0a", text: "#ffffff" },
    overlayStyle: "vignette", overlayOpacity: 0.6, fontWeight: "black", textEffect: "glow",
    rationale: "High-energy red drives action and urgency",
  },
  "case study": {
    theme: "tech", mood: "professional",
    brandColors: { primary: "#0891b2", secondary: "#0e7490", accent: "#22d3ee", background: "#080c10", text: "#e2f8ff" },
    overlayStyle: "gradient", overlayOpacity: 0.5, fontWeight: "bold", textEffect: "glow",
    rationale: "Cyan-blue conveys data, credibility, and analytical depth",
  },
  lifestyle: {
    theme: "outdoor", mood: "calm",
    brandColors: { primary: "#059669", secondary: "#047857", accent: "#34d399", background: "#0a0f0a", text: "#ffffff" },
    overlayStyle: "gradient", overlayOpacity: 0.45, fontWeight: "regular", textEffect: "shadow",
    rationale: "Nature-inspired green for authentic lifestyle content",
  },
  "startup-focused": {
    theme: "tech", mood: "energetic",
    brandColors: { primary: "#7c3aed", secondary: "#6d28d9", accent: "#a78bfa", background: "#08050f", text: "#f5f0ff" },
    overlayStyle: "gradient", overlayOpacity: 0.5, fontWeight: "bold", textEffect: "glow",
    rationale: "Deep violet signals innovation and startup energy",
  },
  luxury: {
    theme: "luxury", mood: "dramatic",
    brandColors: { primary: "#d97706", secondary: "#92400e", accent: "#f59e0b", background: "#06040a", text: "#fff8e7" },
    overlayStyle: "vignette", overlayOpacity: 0.7, fontWeight: "light", textEffect: "glow",
    rationale: "Gold on near-black — premium luxury aesthetic",
  },
  neon: {
    theme: "neon", mood: "playful",
    brandColors: { primary: "#ec4899", secondary: "#be185d", accent: "#f0abfc", background: "#05000f", text: "#ffffff" },
    overlayStyle: "vignette", overlayOpacity: 0.65, fontWeight: "black", textEffect: "glow",
    rationale: "Hot pink neon for high-energy viral content",
  },
};

const DEFAULT_DESIGN: DesignSpec = FALLBACK.educational;

// ─── Design Agent ─────────────────────────────────────────────

export class DesignAgent {
  private client: Anthropic | null;
  private tasks: DesignAgentTask[] = [];

  constructor() {
    this.client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
  }

  /**
   * Generate a DesignSpec for a content row.
   * Fast path: uses fallback palette for known styles.
   * Smart path: Claude generates custom design for unknown topics.
   */
  async generateDesign(row: ContentRow): Promise<DesignSpec> {
    const styleKey = row.style.toLowerCase().trim();

    // Fast path for known styles
    if (FALLBACK[styleKey]) {
      return FALLBACK[styleKey];
    }

    // Smart path — ask Claude
    return this.generateWithClaude(row.topic, row.style);
  }

  /**
   * Claude-generated design for any topic/style combination.
   */
  async generateWithClaude(topic: string, style: string): Promise<DesignSpec> {
    if (!this.client) return DEFAULT_DESIGN;
    const prompt = `You are a brand designer for short-form social media videos (1080x1920 portrait).

TOPIC: ${topic}
STYLE: ${style}

Pick a visual design that will make this video stand out in a feed. Output ONLY valid JSON:
{
  "theme": "tech|luxury|outdoor|minimal|bold|neon",
  "brandColors": {
    "primary": "#hex",
    "secondary": "#hex (darker variant of primary)",
    "accent": "#hex (brighter highlight)",
    "background": "#hex (very dark, near black)",
    "text": "#ffffff or near-white"
  },
  "mood": "energetic|calm|dramatic|playful|professional|mysterious",
  "overlayStyle": "gradient|solid|vignette|none",
  "overlayOpacity": 0.5,
  "fontWeight": "light|regular|bold|black",
  "textEffect": "glow|shadow|outline|clean",
  "rationale": "One sentence explaining the design choice"
}

Rules:
- background must be very dark (#000000 to #141414 range)
- text must be white or near-white for readability
- primary must have luminance > 0.1 (visible on dark bg)
- accent should be brighter/more saturated than primary`;

    try {
      const message = await this.client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages:   [{ role: "user", content: prompt }],
      });

      const text = message.content[0];
      if (text.type !== "text") throw new Error("Unexpected response");

      const raw  = text.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
      const data = JSON.parse(raw);

      return {
        theme:          data.theme          || "minimal",
        brandColors:    data.brandColors    || DEFAULT_DESIGN.brandColors,
        mood:           data.mood           || "professional",
        overlayStyle:   data.overlayStyle   || "gradient",
        overlayOpacity: data.overlayOpacity ?? 0.5,
        fontWeight:     data.fontWeight     || "bold",
        textEffect:     data.textEffect     || "shadow",
        rationale:      data.rationale      || "",
      } as DesignSpec;
    } catch {
      console.warn("[design] Claude failed, using default design");
      return DEFAULT_DESIGN;
    }
  }

  // ─── Task Management ───────────────────────────────────────

  addTask(topic: string, style: string): DesignAgentTask {
    const task: DesignAgentTask = {
      id:     `design-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      topic,
      style,
      status: "queued",
    };
    this.tasks.push(task);
    return task;
  }

  async processTask(task: DesignAgentTask, row: ContentRow): Promise<DesignSpec> {
    task.status    = "processing";
    task.startedAt = new Date().toISOString();

    try {
      const spec     = await this.generateDesign(row);
      task.result    = spec;
      task.status    = "done";
      task.completedAt = new Date().toISOString();
      return spec;
    } catch (err) {
      task.status = "error";
      task.error  = err instanceof Error ? err.message : "Unknown error";
      task.completedAt = new Date().toISOString();
      throw err;
    }
  }

  getTasks(): DesignAgentTask[] {
    return [...this.tasks];
  }

  getTask(id: string): DesignAgentTask | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  clearCompletedTasks(): void {
    this.tasks = this.tasks.filter((t) => t.status === "queued" || t.status === "processing");
  }

  // ─── Batch Design for Multiple Rows ───────────────────────

  async designBatch(rows: ContentRow[]): Promise<Map<number, DesignSpec>> {
    const results = new Map<number, DesignSpec>();
    for (const row of rows) {
      const spec = await this.generateDesign(row);
      results.set(row.rowIndex, spec);
      console.log(`[design] Row ${row.rowIndex} (${row.style}): ${spec.theme} theme — ${spec.rationale}`);
    }
    return results;
  }
}
