/**
 * SCRIPT WRITER AGENT — Generates missing scripts for Google Sheets rows
 *
 * Uses Gemini 2.0 Flash to write engaging short-form video scripts from
 * topic, style, and optional hook lines. Also generates 3 hook variations.
 *
 * Pipeline integration:
 *   1. fillMissingScripts() — scans sheet, writes scripts for empty rows
 *   2. generateScript() — single-row script generation (used by orchestrator)
 *   3. generateHooks() — 3 attention-grabbing hook variations
 */

import { getAIOrchestrator } from "../../ai-orchestrator";
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
  educational:       "Creator-teacher energy — like explaining something to a smart friend over coffee. Conversational. One idea only. No fluff.",
  motivational:      "Raw creator urgency — real talk, not hype. Short punchy sentences. Sounds like a creator who genuinely cares, not a motivational speaker.",
  "case study":      "Documentary confessional — 'here's what actually happened'. Data feels discovered, not presented. Storytelling over facts-listing.",
  lifestyle:         "Authentic vlog energy — talking while doing something. Casual, direct, first-person. Sounds like a friend who just figured something out.",
  "startup-focused": "Founder confession — bold and direct. 'We almost failed because of this.' Feels like inside knowledge being shared for the first time.",
  luxury:            "Understated creator wealth — not flashy. Confident and specific. Describes real experiences, not aspirations.",
  neon:              "High-energy creator — short bursts, pattern interrupts. Feels like a creator who can't wait to share this.",
  cinematic:         "Documentary narrator meets TikTok creator — emotionally grounded, measured pace with sudden reveals. Feels like a short film with creator energy.",
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
- End with energy, not a whimper. The last sentence should land hard.
- Start with "Okay", "So", "Look", "Here's the thing", "POV:", "Honest confession:", "Nobody tells you this" — creator-native openers that feel unscripted.
- Use rhetorical questions mid-script: "right?", "you know what I mean?", "sound familiar?" — these create a conversation, not a monologue.
- Numbers beat adjectives: "3 years" not "several years", "$40k" not "a lot of money", "11pm" not "late at night".
- Pause beats: use "..." deliberately — signals a breath, a realization, a moment the viewer needs to sit with.
- Drop into specifics suddenly — one unexpected concrete detail makes everything else believable.
- Never explain the hook — just deliver it and move on. Trust the audience.
- The CTA should feel like the creator genuinely wants them there, not marketing copy. "I post this stuff every week" beats "follow for more content".`;

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
  "question":       "Ask the question your audience is embarrassed to admit they have. Direct, slightly uncomfortable, immediately relatable. 'Be honest — how many of you...' or 'Has anyone else noticed that...' — makes viewer feel seen before you've said anything else.",
  "bold-statement": "Drop a genuine creator opinion. Sounds slightly controversial but instantly true. Like a conviction, not a claim. 'The reason most people fail at X is actually Y.' — the creator has lived this, not studied it.",
  "conflict":       "Name a contradiction the audience lives with. Something they sense but haven't articulated. Creates instant pattern interrupt and narrative tension — viewer has to keep watching to resolve it.",
  "promise":        "Specific creator-credibility promise. First-person proof. 'I went from X to Y using one framework' — concrete transformation, not vague aspiration. The specificity is what makes it believable.",
  "shock":          "Stat or fact delivered mid-conversation — reactive energy, like the creator just found it. Not presented, discovered. The emotion of the discovery matters as much as the number itself.",
  "story":          "POV cold open into a specific moment. Time, place, sensory detail. 'It's 2am, I'm staring at [specific thing]...' — viewer is dropped into the scene, not introduced to it.",
};

// ─── Story arc structure (TikTok default: Hook → Build → Payoff → CTA) ──

export type RenderVariant = "problem-first" | "stat-first" | "story-arc" | "myth-bust";

const STORY_ARC = `Story arc (12 seconds spoken, 3 beats — video is 20s so leave breathing room):
  Beat 1 (0-3s)   HOOK: One punchy sentence. Stop the scroll.
  Beat 2 (3-10s)  INSIGHT: The core idea. One fact, contrast, or revelation. No filler.
  Beat 3 (10-12s) CTA: One sentence max. Save, follow, or comment.`;

const VARIANT_ARC: Record<RenderVariant, string> = {
  "problem-first": `Story arc — TikTok pacing, spoken not written:
  Beat 1 HOOK (0-3s):   Name the exact pain. First-person or direct address. "You've been doing X wrong." Short. No setup.
  Beat 2 ESCALATE (3-10s): Get specific and emotional. Why it costs them. One concrete example or number. Make them feel it.
  Beat 3 FLIP (10-12s): The simple truth they missed. Lands like a reveal. Soft CTA feels earned, not tacked on.`,
  "stat-first": `Story arc — data as storytelling device:
  Beat 1 HOOK (0-3s):   Drop the number cold. Nothing else. Let it land. Reactive delivery, not polished.
  Beat 2 CONTEXT (3-10s): What this number actually means for them. Make it personal. One relatable consequence they haven't thought about.
  Beat 3 ACTION (10-12s): The one thing they can do right now. Specific. Actionable. Save-worthy.`,
  "story-arc": `Story arc — creator confession format:
  Beat 1 HOOK (0-3s):   Drop into the story mid-moment. "It was [specific time/place] and I was..." — not a setup, the scene itself.
  Beat 2 TURN (3-10s):  The moment everything changed. One specific discovery or realization. Feels earned, not scripted.
  Beat 3 RESULT (10-12s): Where it led. Concrete and specific. Invites them into the same possibility without overselling it.`,
  "myth-bust": `Story arc — creator truth-drop format:
  Beat 1 HOOK (0-3s):   State the bad advice everyone gives. Sounds frustrated, not academic. Short and direct.
  Beat 2 REALITY (3-10s): The actual truth. One clear counterintuitive fact. Backed by something specific. The creator has tested this.
  Beat 3 WIN (10-12s):  What works instead. Direct. No hedging. Ends with genuine CTA, not a slogan.`,
};

// ─── Script Writer Agent ──────────────────────────────────────

export class ScriptWriterAgent {
  private tasks: ScriptTask[] = [];

  /**
   * Generate a script + 3 hook variations for a topic.
   * hookStyle controls the opening approach (question, bold-statement, conflict, promise, shock, story).
   */
  async generateScript(
    topic: string,
    style: string,
    existingHooks?: { a?: string; b?: string; c?: string },
    hookStyle: HookStyle = "question",
    renderVariant?: RenderVariant,
    opts?: { tier?: "basic" | "advanced"; jobId?: string }
  ): Promise<GeneratedScript> {
    const toneGuide = STYLE_TONE[style.toLowerCase()] || STYLE_TONE.educational;
    const hookGuide = HOOK_STYLE_GUIDE[hookStyle];
    const hookHints = [existingHooks?.a, existingHooks?.b, existingHooks?.c].filter(Boolean).join(", ");
    const arc       = renderVariant ? VARIANT_ARC[renderVariant] : STORY_ARC;

    const prompt = `You are an elite short-form video scriptwriter for TikTok and Instagram Reels.

TOPIC: ${topic}
CONTENT STYLE: ${style}
TONE GUIDE: ${toneGuide}
HOOK STYLE: ${hookStyle} — ${hookGuide}
${renderVariant ? `NARRATIVE VARIANT: ${renderVariant}` : ""}
${hookHints ? `EXISTING HOOK IDEAS: ${hookHints}` : ""}

${arc}
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

    const aiResponse = await getAIOrchestrator().generate({
      taskType:       "script-generate",
      prompt,
      tier:           opts?.tier ?? "basic",
      jobId:          opts?.jobId,
      responseFormat: "json",
    });

    const raw  = aiResponse.text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    const data = JSON.parse(raw);

    const script = humanize(data.script || "");
    const hookA  = humanize(data.hookA  || data.hook_a || "");
    const hookB  = humanize(data.hookB  || data.hook_b || "");
    const hookC  = humanize(data.hookC  || data.hook_c || "");

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
  async generateHooks(
    topic: string,
    style: string,
    opts?: { tier?: "basic" | "advanced"; jobId?: string }
  ): Promise<{ a: string; b: string; c: string }> {
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

    const aiResponse = await getAIOrchestrator().generate({
      taskType:       "hook-generate",
      prompt,
      tier:           opts?.tier ?? "basic",
      jobId:          opts?.jobId,
      responseFormat: "json",
    });
    const raw  = aiResponse.text.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
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
