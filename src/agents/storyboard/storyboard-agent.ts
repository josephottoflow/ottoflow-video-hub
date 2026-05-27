/**
 * STORYBOARD AGENT — Gemini-powered TikTok/Reels UGC creative director
 * Generates a complete dynamic JSON storyboard per render.
 * Every call produces different scene count, pacing, visual style, and narrative arc.
 * Architecture spec: storyboard-architecture.json
 */

import { GoogleGenAI } from "@google/genai";
import * as path from "path";
import * as fs from "fs";

const ARCH = JSON.parse(
  fs.readFileSync(path.join(__dirname, "storyboard-architecture.json"), "utf-8")
);

export type VisualStyle  = "dark-cinematic" | "bright-minimal" | "neon-tech" | "warm-story" | "high-contrast";
export type CaptionStyle = "impact" | "word-by-word" | "slide-up" | "pulse";
export type MusicMood    = "tense" | "uplifting" | "mysterious" | "energetic" | "calm";
export type ZoomDir      = "in" | "out" | "pan";
export type SceneBeat    = "hook" | "reveal" | "insight" | "proof" | "cta";

export interface VisualTheme {
  palette:    string;   // 3-5 named colors or hex values shared across ALL scenes
  lighting:   string;   // shared lighting style (golden hour, neon, rim light, etc.)
  lens:       string;   // lens character (shallow DOF, 35mm, macro, etc.)
  filmLook:   string;   // film look (16mm grain, clean digital, anamorphic, etc.)
  motion:     string;   // motion language (locked-off, slow dolly, handheld, etc.)
}

export interface StoryboardScene {
  id:           string;
  beat:         SceneBeat;
  seconds:      number;
  frames:       number;         // seconds * 30
  narration:    string;
  visualPrompt: string;         // 40-80 word cinematic prompt including shared visual theme
  caption:      string;
  keyWord:      string;
  zoomDir:      ZoomDir;
  captionStyle: CaptionStyle;
  composition?: string;         // shot type + angle (ECU, CU, MS, WS, OTS)
  cameraMove?:  string;         // locked / slow dolly in / tracking / crane up
}

export interface Storyboard {
  topic:        string;
  visualStyle:  VisualStyle;
  musicMood:    MusicMood;
  visualTheme:  VisualTheme;    // shared visual language locked before any scene is written
  totalFrames:  number;
  fullScript:   string;
  scenes:       StoryboardScene[];
}

const VARIANT_GUIDE: Record<string, string> = {
  "problem-first": `Scene 1 (hook, 3-4s): Creator confessing something raw — "I wasted 3 years on this..." — first-person, uncomfortable, instantly relatable. Not a staged problem reveal.
Scene 2 (reveal, 4-6s): Why the problem is worse than they think — get specific and emotional. One concrete number or example.
Scene 3 (insight, 5-7s): The simple truth they missed. Lands like a genuine revelation, not a talking point.
Scene 4 (proof, 3-5s): Specific stat, example, or real proof — feels discovered, not presented.
Scene 5 (cta, 2-3s): Creator genuinely wants them there — soft, earned, not marketing copy.`,

  "stat-first": `Scene 1 (hook, 3-4s): Creator just discovered something alarming — reactive energy, not polished delivery. The number lands mid-conversation.
Scene 2 (insight, 5-7s): What that number actually means for the viewer — personal, one relatable consequence.
Scene 3 (proof, 4-6s): Context, trend, or a second data point — feels like the creator is connecting dots in real time.
Scene 4 (cta, 2-3s): The one thing they can do right now — specific, actionable, save-worthy.`,

  "story-arc": `Scene 1 (hook, 3-4s): Drop into an authentic creator moment — already in the middle of something real. "It was 2am and I was..." — not a staged scene.
Scene 2 (reveal, 4-6s): The moment everything changed — one specific discovery or realization. Feels earned, not scripted.
Scene 3 (insight, 5-7s): What they learned — the real lesson. Sounds like a creator processing it out loud.
Scene 4 (proof, 3-5s): The concrete result — specific and believable. Not aspirational, actual.
Scene 5 (cta, 2-3s): Invite them into the same possibility — genuine, not transactional.`,

  "myth-bust": `Scene 1 (hook, 3-4s): Creator genuinely frustrated with bad advice they keep seeing — not academic, emotionally charged. "Everyone says X and I'm so tired of it."
Scene 2 (reveal, 4-6s): The actual truth — one clear counterintuitive fact. Creator has tested this.
Scene 3 (proof, 4-6s): Back it up — specific evidence, feels discovered not curated.
Scene 4 (insight, 4-5s): What actually works instead — direct, no hedging.
Scene 5 (cta, 2-3s): Follow for more real talk — earned, not asked for.`,
};

const HOOK_GUIDE: Record<string, string> = {
  "question":       "Direct conversational question — 'be honest, how many of you...' or 'nobody told me this...' — makes viewer feel seen, slightly uncomfortable, immediately relatable",
  "bold-statement": "Creator-opinion drop — genuine frustration or conviction, not a corporate claim. Sounds slightly controversial but instantly true. Like the creator can't hold it in anymore.",
  "conflict":       "Personal contradiction — the creator sharing something that doesn't add up about their own life or industry. Names a tension the audience lives with but hasn't articulated.",
  "promise":        "Specific transformation with creator credibility — 'I went from X to Y and here's the exact thing' — first-person proof, concrete transformation, not vague aspiration.",
  "shock":          "Statistic delivered mid-conversation, like the creator just found it — reactive, not rehearsed. The emotion of discovery matters as much as the number itself.",
  "story":          "POV cold open — drop into a specific moment: 'It was 2am and I was staring at my laptop...' — viewer is dropped into the scene with sensory detail and real tension.",
};

/**
 * Sheet-driven cinematic context — all fields optional.
 * When provided, these values are locked into the Gemini prompt as constraints
 * rather than letting Gemini invent them. Sheet = orchestration brain.
 */
export interface CinematicContext {
  // Creator Identity
  creatorPersona?:     string;
  creatorEnergy?:      string;
  creatorArchetype?:   string;
  cameraStyle?:        string;
  speakingStyle?:      string;
  environmentStyle?:   string;

  // Visual Cinematic
  visualIdentity?:     string;
  lightingStyle?:      string;
  motionStyle?:        string;
  pacingProfile?:      string;
  colorMood?:          string;
  shotLanguage?:       string;

  // Content DNA
  emotionalTrigger?:   string;
  ctaStyle?:           string;
  coreAngle?:          string;
  storyArc?:           string;

  // Storyboard scene overrides (Gemini refines/expands these — does not replace)
  sceneCount?:           number;
  hookScenePrompt?:      string;
  revealScenePrompt?:    string;
  insightScenePrompt?:   string;
  proofScenePrompt?:     string;
  ctaScenePrompt?:       string;

  // Veo generation directives
  veoPromptStrategy?:    string;
  motionIntensity?:      string;
  cameraMotion?:         string;
  realismLevel?:         string;
  ugcStyle?:             string;

  // Voice + Caption
  narrationStyle?:       string;
  speechCadence?:        string;
  emphasisStyle?:        string;
  captionStyle?:         string;
}

export class StoryboardAgent {
  private ai: GoogleGenAI | null;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  static isAvailable(): boolean {
    return !!process.env.GOOGLE_API_KEY;
  }

  async generate(
    topic:          string,
    style:          string,
    renderVariant:  string = "problem-first",
    hookStyle:      string = "shock",
    existingScript?: string,
    ctx?:           CinematicContext
  ): Promise<Storyboard> {
    if (!this.ai) {
      console.warn("[storyboard] No GOOGLE_API_KEY — using fallback storyboard");
      return this.fallback(topic, renderVariant);
    }

    const variantGuide = VARIANT_GUIDE[renderVariant] ?? VARIANT_GUIDE["problem-first"];
    const hookGuide    = HOOK_GUIDE[hookStyle]        ?? HOOK_GUIDE["shock"];

    const seedNote = existingScript?.trim()
      ? `\nSEED SCRIPT (use this as inspiration — preserve the angle and facts, improve the pacing):\n"${existingScript.trim()}"\n`
      : "";

    // Build sheet-locked context blocks — when set, Gemini must inherit not invent
    const hasIdentityLock = !!(ctx?.creatorPersona || ctx?.creatorEnergy || ctx?.creatorArchetype || ctx?.cameraStyle || ctx?.environmentStyle);
    const hasVisualLock   = !!(ctx?.visualIdentity || ctx?.lightingStyle || ctx?.motionStyle || ctx?.colorMood);
    const hasSceneSeeds   = !!(ctx?.hookScenePrompt || ctx?.revealScenePrompt || ctx?.insightScenePrompt || ctx?.proofScenePrompt || ctx?.ctaScenePrompt);

    const identityBlock = hasIdentityLock
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHEET-LOCKED CREATOR IDENTITY — inherit exactly, do not change:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${ctx?.creatorPersona    ? `Creator Persona:   ${ctx.creatorPersona}`    : ""}
${ctx?.creatorEnergy     ? `Creator Energy:    ${ctx.creatorEnergy}`     : ""}
${ctx?.creatorArchetype  ? `Creator Archetype: ${ctx.creatorArchetype}`  : ""}
${ctx?.cameraStyle       ? `Camera Style:      ${ctx.cameraStyle}`       : ""}
${ctx?.environmentStyle  ? `Environment:       ${ctx.environmentStyle}`  : ""}
${ctx?.speakingStyle     ? `Speaking Style:    ${ctx.speakingStyle}`     : ""}
${ctx?.emotionalTrigger  ? `Emotional Trigger: ${ctx.emotionalTrigger}`  : ""}
All scenes MUST feature the SAME creator in the SAME environment.`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 0 — LOCK THE CREATOR PERSONA (before any scene)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lock these BEFORE writing any scene. All scenes inherit them.

1. Creator archetype — one specific human: (e.g. "25yo productivity obsessive at cluttered home desk", "burned-out corporate worker who escaped", "self-taught entrepreneur in city apartment")
2. Platform energy — their emotional register: (e.g. "confessional and raw", "frustrated truth-teller", "genuinely excited about a discovery", "conspiratorial friend sharing something private")
3. Signature environment — ONE real location that persists: (e.g. "cluttered home desk with sticky notes and cold coffee", "parked car in light rain", "kitchen table at 6am", "bedroom floor against bed frame")
4. Signature lighting — ONE real-world light source: (e.g. "laptop screen glow in dark room", "east window morning light", "golden hour through apartment window", "warm floor lamp behind creator")
5. Axis lock — pick a facing direction in s1 and NEVER flip it. 180° rule enforced across ALL scenes.`;

    const visualBlock = hasVisualLock
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHEET-LOCKED VISUAL IDENTITY — do not change these values:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${ctx?.visualIdentity ? `Visual Style:  ${ctx.visualIdentity}` : ""}
${ctx?.lightingStyle  ? `Lighting:      ${ctx.lightingStyle}`  : ""}
${ctx?.motionStyle    ? `Motion:        ${ctx.motionStyle}`    : ""}
${ctx?.colorMood      ? `Color Mood:    ${ctx.colorMood}`      : ""}
${ctx?.shotLanguage   ? `Shot Language: ${ctx.shotLanguage}`   : ""}
${ctx?.pacingProfile  ? `Pacing:        ${ctx.pacingProfile}`  : ""}
Use these as the locked visual theme across ALL scenes. Write visualTheme JSON from these values.`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — LOCK VISUAL IDENTITY (before any scene)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pick ONE visual style preset and lock ALL values for every scene:

${Object.entries(ARCH.visual_style_presets as Record<string, { environment: string; energy: string; lighting: string; film_look: string }>)
  .map(([key, v]) => `- "${key}": ${v.environment} | ${v.energy} | ${v.lighting}`)
  .join("\n")}

Lock:
- palette: 3-4 specific environment colors (hex or named)
- lighting: the ONE real light source (practical/natural only — no "dramatic lighting", no "rim light setup")
- lens: smartphone portrait feel — shallow DOF, natural vignette, imperfect corners
- filmLook: muted saturation, slight grain, warm or cool temp — never "cinematic grade" as a vague catch-all
- motion: camera personality that matches filming context (self-filmed drift, documentary follow, locked with lens breathing)`;

    const sceneSeedBlock = hasSceneSeeds
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHEET-SEEDED SCENE PROMPTS — expand and refine these (do not replace):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The sheet author has defined scene-level visual direction. Take each as a starting seed:
add camera motion, micro-actions, specific objects, and light source detail to meet the 10-point spec.
${ctx?.hookScenePrompt    ? `Hook Scene Seed:    "${ctx.hookScenePrompt}"`    : ""}
${ctx?.revealScenePrompt  ? `Reveal Scene Seed:  "${ctx.revealScenePrompt}"`  : ""}
${ctx?.insightScenePrompt ? `Insight Scene Seed: "${ctx.insightScenePrompt}"` : ""}
${ctx?.proofScenePrompt   ? `Proof Scene Seed:   "${ctx.proofScenePrompt}"`   : ""}
${ctx?.ctaScenePrompt     ? `CTA Scene Seed:     "${ctx.ctaScenePrompt}"`     : ""}
`
      : "";

    const veoDirectivesBlock = (ctx?.veoPromptStrategy || ctx?.motionIntensity || ctx?.cameraMotion || ctx?.realismLevel || ctx?.ugcStyle)
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHEET-LOCKED VEO DIRECTIVES — apply to every visualPrompt:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${ctx?.veoPromptStrategy ? `Prompt Strategy: ${ctx.veoPromptStrategy}` : ""}
${ctx?.motionIntensity   ? `Motion Intensity: ${ctx.motionIntensity}`   : ""}
${ctx?.cameraMotion      ? `Camera Motion: ${ctx.cameraMotion}`         : ""}
${ctx?.realismLevel      ? `Realism Level: ${ctx.realismLevel}`         : ""}
${ctx?.ugcStyle          ? `UGC Style: ${ctx.ugcStyle}`                 : ""}
`
      : "";

    const sceneCountNote = ctx?.sceneCount
      ? `\nSCENE COUNT: Generate exactly ${ctx.sceneCount} scenes following the narrative arc.`
      : "";

    const captionNote = ctx?.captionStyle && ctx.captionStyle !== "auto"
      ? `\nCAPTION STYLE OVERRIDE: Use "${ctx.captionStyle}" for all scenes unless the beat requires a different style.`
      : "";

    // Pull example prompts and quality rules from architecture spec
    const examplePrompts = Object.values(ARCH.example_ugc_prompts as Record<string, string>)
      .map((p, i) => `EXAMPLE ${String.fromCharCode(65 + i)}: "${p}"`)
      .join("\n\n");

    const avoidList = (ARCH.quality_rules.avoid as string[]).map(x => `❌ ${x}`).join("\n");
    const includeList = (ARCH.quality_rules.always_include as string[]).map(x => `✅ ${x}`).join("\n");

    const prompt = `${ARCH.system_role}

You are generating a TikTok/Reels creator video — NOT a luxury commercial, NOT a SaaS ad, NOT a cinematic trailer.
Every scene must feel like a real creator filmed it on their phone. Authentic, imperfect, emotionally true.

TOPIC: "${topic}"
CONTENT STYLE: "${style}"
NARRATIVE VARIANT: ${renderVariant}
HOOK STYLE: ${hookStyle} — ${hookGuide}${sceneCountNote}${seedNote}
${ctx?.emotionalTrigger ? `EMOTIONAL TRIGGER: ${ctx.emotionalTrigger}` : ""}
${ctx?.ctaStyle         ? `CTA STYLE: ${ctx.ctaStyle}`                 : ""}

${identityBlock}

${visualBlock}
${veoDirectivesBlock}${sceneSeedBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NARRATIVE ARC — follow this exactly:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${variantGuide}

Emotional continuity arc for ${renderVariant}:
${(ARCH.emotional_continuity.arc_types as Record<string, string>)[renderVariant] ?? "frustrated → exposed → realized → relieved → inviting"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — EACH SCENE: 10-POINT SHOT SPEC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EVERY scene, mentally work through all 10 before writing the visualPrompt:
1. Scene purpose: emotional job this scene does (hook, destabilize, reveal, ground, invite)
2. Creator emotional state: ONE word (frustrated, shocked, confiding, certain, energized)
3. Shot type: ECU / CU / MCU / MS / WS — alternate, never repeat consecutive
4. Camera angle: eye level / slightly low / slightly high / OTS
5. ONE micro-action: jaw tightens, exhales through nose, leans forward 3cm, glances off then back, hand wraps tighter around mug
6. 2-3 specific objects: sticky notes on monitor, tangled cable, cold coffee, rain on windshield, book spine visible
7. Exact light source: "laptop screen catching chin and nose", "east window morning light across left shoulder", "warm lamp creating separation behind"
8. Camera behavior: "slight handheld drift", "slow self-film push-in 3cm", "documentary follow with slight lag", "locked with subtle lens breathing"
9. Social-native qualifier: one phrase anchoring it in TikTok reality
10. Synthesize all 9 → visualPrompt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE PROMPTS (match this energy and specificity):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${examplePrompts}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VEO REQUIREMENTS — motion-first thinking:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Veo renders ONE continuous shot from your prompt. Describe BELIEVABLE MOTION:
✅ Natural breathing, slight lean, subtle head turn, hand gestures, environmental motion (rain, steam, crowd)
✅ Specific textures: rain on glass, mug steam, laptop fan glow, book pages
✅ Simple human physics — one action at a time
❌ Text overlays, logos, UI, graphs in the prompt
❌ Multiple cuts described in one prompt
❌ Impossible camera moves (orbit, crane, dolly track)
❌ Generic language: "dramatic", "cinematic grade", "epic", "stunning", "luxury"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUALITY RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${includeList}

${avoidList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAPTION + TIMING:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Narration: 6-12 words per scene, punchy, no filler, no passive voice
- Total narration: 30-45 words across ALL scenes
- caption: 2-3 POWER WORDS, no articles, ALL CAPS
- keyWord: ONE word (lowercase) — the most emotionally loaded word in the caption
- frames = seconds × 30
- zoomDir: vary — never same direction in consecutive scenes
- captionStyle: "impact" for hook/cta | "word-by-word" for revelation | "slide-up" for insight | "pulse" for proof
- musicMood: tense | uplifting | mysterious | energetic | calm

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL CHECK before outputting:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Every visualPrompt = ONE continuous shot a creator could film in one take?
2. Every scene belongs to the SAME creator in the SAME visual world?
3. Believable motion described in every shot?
4. Shot types alternated — no two identical types in a row?
5. ONE specific micro-action per scene?
6. Does the complete video feel like a real TikTok, not a stock commercial?

Return ONLY valid JSON (no markdown, no explanation):
{
  "visualStyle": "dark-cinematic",
  "musicMood": "tense",
  "visualTheme": {
    "palette": "deep charcoal #1a1a2e, monitor blue-white #d4e9ff, warm amber lamp #ffbf00",
    "lighting": "laptop screen as sole key light — cold blue-white on face in dark room, warm lamp creating background separation",
    "lens": "shallow depth of field, smartphone portrait mode, natural background melt, slight vignette",
    "filmLook": "subtle film grain, muted saturation, cool 5500K screen temp with warm background contrast",
    "motion": "slight natural handheld drift, creator self-film slow push-in 3cm"
  },
  "scenes": [
    {
      "id": "s1", "beat": "hook", "seconds": 4, "frames": 120,
      "narration": "6-12 words max, punchy, first-person, no filler",
      "composition": "MCU, eye level",
      "cameraMove": "slight natural handheld drift",
      "visualPrompt": "Creator-POV MCU of person in late 20s at cluttered home desk mid-rant, laptop screen casting cold blue-white light across frustrated face in dim room, sticky notes on monitor edges visible, tangled headphone cable in foreground, leaning 3cm toward camera with jaw tight and shoulders forward, slight natural handheld drift, authentic TikTok confessional energy, 9:16 vertical portrait",
      "caption": "POWER WORDS", "keyWord": "word", "zoomDir": "in", "captionStyle": "impact"
    }
  ]
}`;

    try {
      const response = await this.ai.models.generateContent({
        model:    "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text ?? "";
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) throw new Error("No JSON in Gemini response");

      const raw = JSON.parse(json) as {
        visualStyle?:  string;
        musicMood?:    string;
        visualTheme?:  Partial<VisualTheme>;
        scenes?:       Partial<StoryboardScene>[];
      };

      if (!raw.scenes?.length) throw new Error("Storyboard has no scenes");

      const scenes: StoryboardScene[] = raw.scenes.map((s, i) => {
        const secs = Math.max(3, Math.min(12, Number(s.seconds) || 5));
        const VALID_ZOOM:    ZoomDir[]      = ["in", "out", "pan"];
        const VALID_CAPTION: CaptionStyle[] = ["impact", "word-by-word", "slide-up", "pulse"];
        return {
          id:           s.id           ?? `s${i + 1}`,
          beat:         (s.beat        ?? (i === 0 ? "hook" : i === raw.scenes!.length - 1 ? "cta" : "insight")) as SceneBeat,
          seconds:      secs,
          frames:       secs * 30,
          narration:    s.narration    ?? "",
          visualPrompt: s.visualPrompt ?? `${topic}, cinematic 9:16, slow motion, dramatic lighting`,
          caption:      (s.caption     ?? topic.split(" ").slice(0, 3).join(" ")).toUpperCase(),
          keyWord:      ((s.keyWord    ?? (s.caption ?? "now").split(" ")[0])).toLowerCase(),
          zoomDir:      VALID_ZOOM.includes(s.zoomDir as ZoomDir) ? (s.zoomDir as ZoomDir) : VALID_ZOOM[i % 3],
          captionStyle: VALID_CAPTION.includes(s.captionStyle as CaptionStyle) ? (s.captionStyle as CaptionStyle) : "impact",
          composition:  s.composition,
          cameraMove:   s.cameraMove,
        };
      });

      const visualTheme: VisualTheme = {
        palette:  raw.visualTheme?.palette  ?? "deep charcoal, monitor blue-white, warm lamp amber",
        lighting: raw.visualTheme?.lighting ?? "laptop screen glow as key light, warm practical lamp behind",
        lens:     raw.visualTheme?.lens     ?? "shallow depth of field, smartphone portrait mode, natural vignette",
        filmLook: raw.visualTheme?.filmLook ?? "subtle film grain, muted saturation, slight warm-cool contrast",
        motion:   raw.visualTheme?.motion   ?? "slight natural handheld drift, creator self-film slow push-in",
      };

      const fullScript  = scenes.map(s => s.narration).filter(Boolean).join(" ");
      const totalFrames = scenes.reduce((sum, s) => sum + s.frames, 0);

      console.log(`[storyboard] ${scenes.length} scenes, ${totalFrames}f (${(totalFrames / 30).toFixed(1)}s), style=${raw.visualStyle}`);
      console.log(`[storyboard] Theme: ${visualTheme.palette} | ${visualTheme.lighting}`);
      console.log(`[storyboard] Script (${fullScript.split(" ").length}w): ${fullScript.slice(0, 80)}...`);

      return {
        topic,
        visualStyle:  (raw.visualStyle ?? "dark-cinematic") as VisualStyle,
        musicMood:    (raw.musicMood   ?? "tense") as MusicMood,
        visualTheme,
        totalFrames,
        fullScript,
        scenes,
      };
    } catch (err) {
      console.error("[storyboard] Gemini failed:", err instanceof Error ? err.message : err);
      return this.fallback(topic, renderVariant);
    }
  }

  private fallback(topic: string, renderVariant: string): Storyboard {
    const t = topic.slice(0, 40);

    const scenesByVariant: Record<string, StoryboardScene[]> = {
      "myth-bust": [
        { id: "s1", beat: "hook",    seconds: 4, frames: 120, narration: `Everyone thinks they understand ${t}.`,                              visualPrompt: `Handheld creator-POV MCU of person mid-rant at home office desk, laptop open behind them, morning window light from left catching face, jaw tight with visible frustration, authentic documentary energy, slight camera drift, TikTok-native framing, 9:16 vertical portrait`,                 caption: "EVERYONE THINKS",  keyWord: "thinks",  zoomDir: "in",  captionStyle: "impact"       },
        { id: "s2", beat: "reveal",  seconds: 5, frames: 150, narration: "But 73% of practitioners get the fundamentals completely wrong.",     visualPrompt: "Handheld CU of creator leaning closer to camera with wide eyes, phone screen glow on face in dim room, visible surprise in body language, slight lens breathing, real bedroom environment with blurred background, authentic UGC energy, 9:16 vertical portrait",              caption: "73% WRONG",        keyWord: "wrong",   zoomDir: "pan", captionStyle: "word-by-word" },
        { id: "s3", beat: "insight", seconds: 7, frames: 210, narration: "The real approach focuses on systems, not symptoms. Always has.",     visualPrompt: "Creator-POV slow phone push-in on person gesturing confidently at camera, natural window light creating soft shadows, cluttered-but-real home studio backdrop, relaxed posture of someone who has figured it out, organic camera drift, 9:16 vertical portrait",                   caption: "SYSTEMS WIN",      keyWord: "systems", zoomDir: "pan", captionStyle: "slide-up"     },
        { id: "s4", beat: "cta",     seconds: 3, frames: 90,  narration: "Follow for the framework that actually works.",                       visualPrompt: "Handheld MCU of creator speaking directly to camera phone with warm smile, golden afternoon window light from right, home office with lived-in texture visible behind, genuine energy not performed, slight natural movement, 9:16 vertical portrait",                 caption: "FOLLOW NOW",       keyWord: "follow",  zoomDir: "in",  captionStyle: "pulse"        },
      ],
      "stat-first": [
        { id: "s1", beat: "hook",    seconds: 4, frames: 120, narration: `Only 14% of professionals truly master ${t}.`,                        visualPrompt: "Handheld ECU of creator's face reacting to something they just read on phone, screen light reflecting in eyes, dim late-night bedroom, jaw slightly dropped, authentic moment of discovery energy, natural shadows on half the face, slight camera drift, 9:16 vertical portrait",                 caption: "ONLY 14%",         keyWord: "14%",     zoomDir: "in",  captionStyle: "impact"       },
        { id: "s2", beat: "insight", seconds: 7, frames: 210, narration: "Those who do earn 3x more and work half as hard. That is the gap.",    visualPrompt: "Creator-POV handheld MS of person at kitchen table with coffee, morning light flooding in from window behind them, leaning forward with elbows on table like confiding in a friend, real home environment with natural clutter, organic camera movement, 9:16 vertical portrait",                  caption: "3X MORE",          keyWord: "3x",      zoomDir: "pan", captionStyle: "slide-up"     },
        { id: "s3", beat: "proof",   seconds: 4, frames: 120, narration: "The data does not lie. This works across every industry.",             visualPrompt: "Handheld CU of creator nodding with conviction directly at camera, ring light creating clean catch light in eyes, home studio setup visible in soft focus behind, body language of someone who has lived this, slight natural camera drift, 9:16 vertical portrait",                caption: "DATA PROVES",      keyWord: "data",    zoomDir: "out", captionStyle: "word-by-word" },
        { id: "s4", beat: "cta",     seconds: 3, frames: 90,  narration: "Follow to close that gap starting today.",                            visualPrompt: "Handheld MCU of creator pointing gently at camera with warm authentic smile, soft window light on face, real living room environment blurred behind them, genuine non-performative energy, slight camera drift, TikTok-native framing, 9:16 vertical portrait",                                           caption: "CLOSE THE GAP",   keyWord: "gap",     zoomDir: "in",  captionStyle: "pulse"        },
      ],
    };

    const scenes = scenesByVariant[renderVariant] ?? [
      { id: "s1", beat: "hook" as SceneBeat,    seconds: 4, frames: 120, narration: `Most people get ${t} completely wrong.`,                  visualPrompt: `Handheld creator-POV MCU of person mid-confession at desk, morning window light from left side, leaning toward camera with frustrated energy, home office with real texture behind them, slight natural camera drift, authentic documentary feel, TikTok-native framing, 9:16 vertical portrait`,                   caption: "MOST FAIL THIS",   keyWord: "fail",    zoomDir: "in"  as ZoomDir, captionStyle: "impact"       as CaptionStyle },
      { id: "s2", beat: "reveal" as SceneBeat,  seconds: 5, frames: 150, narration: "Here is the painful truth nobody wants to admit.",         visualPrompt: "Creator-POV handheld CU of person leaning closer to camera, phone screen glow as soft key light in dim room, eyes slightly widened, visible tension in jaw, authentic bedroom environment with natural shadows, slight lens breathing, 9:16 vertical portrait",                      caption: "THE TRUTH",        keyWord: "truth",   zoomDir: "pan" as ZoomDir, captionStyle: "word-by-word" as CaptionStyle },
      { id: "s3", beat: "insight" as SceneBeat, seconds: 7, frames: 210, narration: "The real secret is simpler than any expert admits.",       visualPrompt: "Slow phone push-in on creator gesturing with open hands at camera, natural afternoon window light creating warm shadows, cluttered but real work environment in soft focus behind, body language of genuine revelation, organic camera drift, 9:16 vertical portrait",               caption: "ONE THING",        keyWord: "one",     zoomDir: "pan" as ZoomDir, captionStyle: "slide-up"     as CaptionStyle },
      { id: "s4", beat: "cta" as SceneBeat,     seconds: 3, frames: 90,  narration: "Follow for more frameworks that actually deliver.",         visualPrompt: "Handheld MCU of creator speaking directly to phone camera with relaxed confidence, soft window light from right side, real home environment visible and lived-in behind them, genuine energy not produced, slight natural drift, TikTok-native framing, 9:16 vertical portrait",                       caption: "FOLLOW NOW",       keyWord: "follow",  zoomDir: "in"  as ZoomDir, captionStyle: "pulse"        as CaptionStyle },
    ];

    const fullScript  = scenes.map(s => s.narration).join(" ");
    const totalFrames = scenes.reduce((sum, s) => sum + s.frames, 0);

    const fallbackTheme: VisualTheme = {
      palette:  "deep charcoal #1a1a2e, monitor blue-white #d4e9ff, warm amber lamp #ffbf00, dark wood #5b4a3a",
      lighting: "laptop screen as sole key light in dark room, warm practical floor lamp creating background separation",
      lens:     "shallow depth of field, smartphone portrait mode, natural background melt, slight vignette",
      filmLook: "subtle film grain, muted saturation, cool screen temp contrasting warm ambient",
      motion:   "slight natural handheld drift, creator self-film slow push-in 3cm",
    };

    return { topic, visualStyle: "dark-cinematic", musicMood: "tense", visualTheme: fallbackTheme, totalFrames, fullScript, scenes };
  }
}
