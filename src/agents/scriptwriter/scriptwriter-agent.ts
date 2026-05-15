/**
 * SCRIPT WRITER AGENT — Generates missing scripts for Google Sheets rows
 *
 * Uses Claude to write engaging short-form video scripts from topic,
 * style, and optional hook lines. Also generates 3 hook variations.
 *
 * Pipeline integration:
 *   1. fillMissingScripts() — scans sheet, writes scripts for empty rows
 *   2. generateScript() — single-row script generation (used by orchestrator)
 *   3. generateHooks() — 3 attention-grabbing hook variations
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ContentRow } from "../sheets/client";

// ─── Types ───────────────────────────────────────────────────

export interface GeneratedScript {
  script:    string;   // 30-35 word voiceover script (fits 12s at 160 wpm)
  hookA:     string;   // hook variation 1
  hookB:     string;   // hook variation 2
  hookC:     string;   // hook variation 3
  wordCount: number;
}

export interface ScriptTask {
  id:          string;
  rowIndex:    number;
  topic:       string;
  style:       string;
  status:      "queued" | "writing" | "done" | "error";
  result?:     GeneratedScript;
  error?:      string;
  startedAt?:  string;
  completedAt?: string;
}

// ─── Style → tone guide ──────────────────────────────────────

const STYLE_TONE: Record<string, string> = {
  educational:       "Clear, approachable, informative. Build trust. Teach one thing well.",
  motivational:      "High energy, direct, inspiring. Short punchy sentences. Drive action.",
  "case study":      "Data-driven, credible, storytelling format. Problem → Solution → Result.",
  lifestyle:         "Conversational, authentic, relatable. Talk like a friend, not a brand.",
  "startup-focused": "Bold, visionary, confident. Future-focused language. Build excitement.",
  luxury:            "Elegant, aspirational, exclusive. Slow, deliberate pacing.",
  neon:              "Fun, playful, high-energy. Short sentences. Use contrast and surprise.",
};

// ─── Human voice rules (applied in prompt + post-processed) ──

const HUMAN_VOICE_RULES = `
HUMAN VOICE RULES — non-negotiable:
- ZERO em-dashes (— or --). Never use them. Not once. If you feel like using one, use a period or comma instead.
- Write exactly how a real person talks out loud. Read it back in your head — if it sounds like writing, rewrite it.
- Use contractions freely: you're, it's, they've, don't, can't, won't, that's, here's.
- Short sentences win. Three to eight words each. Mix lengths for rhythm.
- Start sentences with "And", "But", "So", "Because" — that's how people actually speak.
- No corporate words: leverage, utilize, implement, facilitate, synergy, paradigm.
- No passive voice. "Companies lose money" not "money is lost by companies".
- Direct address: say "you" and "your" constantly. Make it personal.
- Specific beats generic. "Amazon cut costs by 90 percent" beats "significant cost reduction".
- End with energy, not a whimper. The last sentence should land hard.`;

// ─── Post-processor: strip any em-dashes that slip through ───

function humanize(text: string): string {
  return text
    .replace(/ — /g, ". ")       // em-dash surrounded by spaces → period
    .replace(/—/g, ", ")          // bare em-dash → comma
    .replace(/--/g, ", ")         // double hyphen used as em-dash → comma
    .replace(/\s{2,}/g, " ")      // collapse double spaces
    .trim();
}

/** Exported for use in orchestrator — sanitizes pre-written scripts from the sheet */
export function sanitizeScript(text: string): string {
  return humanize(text);
}

// ─── Hook style → instruction (from script-writer skill) ─────

export type HookStyle =
  | "question"       // open with a compelling question
  | "bold-statement" // make a provocative claim
  | "conflict"       // present a tension or problem
  | "promise"        // lead with a clear benefit
  | "shock"          // surprising fact or number
  | "story"          // open mid-story

const HOOK_STYLE_GUIDE: Record<HookStyle, string> = {
  "question":       "Open with a compelling question the audience desperately wants answered. Make them feel it's about them.",
  "bold-statement": "Make a bold, slightly provocative claim. Confident, no hedging. Should feel controversial but true.",
  "conflict":       "Open with a tension or problem that immediately creates narrative pull. Viewers need to know the resolution.",
  "promise":        "Lead with a clear, specific benefit. Tell them exactly what they'll get if they watch. No vague promises.",
  "shock":          "Hit with a surprising statistic, fact, or counterintuitive truth. The more unexpected the better.",
  "story":          "Start in the middle of a story. Drop the viewer into a moment already happening. Create instant immersion.",
};

// ─── Story arc structure (TikTok default: Hook → Build → Payoff → CTA) ──

const STORY_ARC = `Story arc (12 seconds spoken, 3 beats — video is 20s so leave breathing room):
  Beat 1 (0-3s)   HOOK: One punchy sentence. Stop the scroll.
  Beat 2 (3-10s)  INSIGHT: The core idea. One fact, contrast, or revelation. No filler.
  Beat 3 (10-12s) CTA: One sentence max. Save, follow, or comment.`;

// ─── Script Writer Agent ──────────────────────────────────────

export class ScriptWriterAgent {
  private client: Anthropic | null;
  private tasks: ScriptTask[] = [];

  constructor() {
    this.client = process.env.ANTHROPIC_API_KEY
      ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      : null;
  }

  /**
   * Generate a script + 3 hook variations for a topic.
   * hookStyle controls the opening approach (question, bold-statement, conflict, promise, shock, story).
   */
  async generateScript(
    topic: string,
    style: string,
    existingHooks?: { a?: string; b?: string; c?: string },
    hookStyle: HookStyle = "question"
  ): Promise<GeneratedScript> {
    if (!this.client) throw new Error("ANTHROPIC_API_KEY is not set");
    const toneGuide      = STYLE_TONE[style.toLowerCase()] || STYLE_TONE.educational;
    const hookGuide      = HOOK_STYLE_GUIDE[hookStyle];
    const hookHints      = [existingHooks?.a, existingHooks?.b, existingHooks?.c].filter(Boolean).join(", ");

    const prompt = `You are an elite short-form video scriptwriter for TikTok and Instagram Reels.

TOPIC: ${topic}
CONTENT STYLE: ${style}
TONE GUIDE: ${toneGuide}
HOOK STYLE: ${hookStyle} — ${hookGuide}
${hookHints ? `EXISTING HOOK IDEAS: ${hookHints}` : ""}

${STORY_ARC}
${HUMAN_VOICE_RULES}

Write a complete content package. Output ONLY valid JSON:
{
  "script": "30-35 word voiceover script. Sounds like a real person talking. Follows the 3-beat arc. One idea only. Ends with a soft CTA. STRICT MAX 35 WORDS.",
  "hookA": "${hookStyle} style hook — max 8 words, no em-dashes",
  "hookB": "Surprising fact or number hook — max 8 words, no em-dashes",
  "hookC": "Direct you-language challenge — max 8 words, no em-dashes",
  "wordCount": 32
}

Structural rules:
- Script follows the 4-beat story arc (Hook, Build, Payoff, CTA)
- Each hook uses a different opening structure
- Spoken-word only — no bullet points, no headers, no markdown
- If you produce an em-dash anywhere, you have failed the task`;

    const message = await this.client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages:   [{ role: "user", content: prompt }],
    });

    const text = message.content[0];
    if (text.type !== "text") throw new Error("Unexpected Claude response");

    const raw  = text.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(raw);

    const script = humanize(data.script    || "");
    const hookA  = humanize(data.hookA     || data.hook_a || "");
    const hookB  = humanize(data.hookB     || data.hook_b || "");
    const hookC  = humanize(data.hookC     || data.hook_c || "");

    return {
      script,
      hookA,
      hookB,
      hookC,
      wordCount: data.wordCount || data.word_count || script.split(/\s+/).length || 0,
    };
  }

  /**
   * Generate only 3 hook variations (faster — used when script exists).
   */
  async generateHooks(topic: string, style: string): Promise<{ a: string; b: string; c: string }> {
    if (!this.client) throw new Error("ANTHROPIC_API_KEY is not set");
    const prompt = `Generate 3 scroll-stopping video hooks for this topic.

TOPIC: ${topic}
STYLE: ${style}

${HUMAN_VOICE_RULES}

Output ONLY valid JSON:
{
  "a": "Pain-point hook, max 8 words, no em-dashes",
  "b": "Fact or number hook, max 8 words, no em-dashes",
  "c": "Direct you-challenge, max 8 words, no em-dashes"
}`;

    const message = await this.client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages:   [{ role: "user", content: prompt }],
    });

    const text = message.content[0];
    if (text.type !== "text") throw new Error("Unexpected response");
    const raw  = text.text.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(raw);
    return {
      a: humanize(data.a || ""),
      b: humanize(data.b || ""),
      c: humanize(data.c || ""),
    };
  }

  /**
   * Fill missing scripts for a batch of ContentRows.
   * Returns a map of rowIndex → GeneratedScript for rows that were updated.
   * Skips rows that already have a script.
   */
  async fillMissingScripts(rows: ContentRow[]): Promise<Map<number, GeneratedScript>> {
    const results = new Map<number, GeneratedScript>();
    const missing = rows.filter((r) => !r.script || r.script.trim().length < 10);

    if (missing.length === 0) {
      console.log("[scriptwriter] All rows already have scripts.");
      return results;
    }

    console.log(`[scriptwriter] Writing scripts for ${missing.length} rows...`);

    for (const row of missing) {
      const task = this.addTask(row.rowIndex, row.topic, row.style);
      try {
        task.status    = "writing";
        task.startedAt = new Date().toISOString();

        const existingHooks = { a: row.hookA, b: row.hookB, c: row.hookC };
        const generated     = await this.generateScript(row.topic, row.style, existingHooks);

        task.result      = generated;
        task.status      = "done";
        task.completedAt = new Date().toISOString();

        results.set(row.rowIndex, generated);
        console.log(`[scriptwriter] Row ${row.rowIndex} (${row.topic}): ${generated.wordCount} words`);
      } catch (err) {
        task.status      = "error";
        task.error       = err instanceof Error ? err.message : "Unknown error";
        task.completedAt = new Date().toISOString();
        console.error(`[scriptwriter] Row ${row.rowIndex} failed: ${task.error}`);
      }
    }

    return results;
  }

  // ─── Task Management ──────────────────────────────────────

  addTask(rowIndex: number, topic: string, style: string): ScriptTask {
    const task: ScriptTask = {
      id:       `script-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      rowIndex,
      topic,
      style,
      status:   "queued",
    };
    this.tasks.push(task);
    return task;
  }

  getTasks(): ScriptTask[] {
    return [...this.tasks];
  }

  getPendingTasks(): ScriptTask[] {
    return this.tasks.filter((t) => t.status === "queued");
  }

  getTaskStats(): { queued: number; writing: number; done: number; error: number } {
    return {
      queued:  this.tasks.filter((t) => t.status === "queued").length,
      writing: this.tasks.filter((t) => t.status === "writing").length,
      done:    this.tasks.filter((t) => t.status === "done").length,
      error:   this.tasks.filter((t) => t.status === "error").length,
    };
  }

  clearCompletedTasks(): void {
    this.tasks = this.tasks.filter((t) => t.status === "queued" || t.status === "writing");
  }
}
