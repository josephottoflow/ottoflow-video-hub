/**
 * STORYBOARD AGENT — Gemini-powered creative director
 * Generates a complete dynamic JSON storyboard per render.
 * Every call produces different scene count, pacing, visual style, and narrative arc.
 */

import { GoogleGenAI } from "@google/genai";

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
    existingScript?: string
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

    const prompt = `You are a TikTok cinematic creative director and storyboard artist. Generate a complete video storyboard JSON for a short-form vertical video that looks and feels like a high-performing creator video — NOT a stock ad, NOT a corporate explainer, NOT a generic AI video.

TOPIC: "${topic}"
CONTENT STYLE: "${style}"
NARRATIVE VARIANT: ${renderVariant}
HOOK STYLE: ${hookStyle} — ${hookGuide}${seedNote}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 0 — LOCK THE CREATOR PERSONA (do this before any scene)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Before writing a single scene, decide and LOCK:
1. Creator type: (e.g. "25yo productivity nerd in home office", "burned-out corporate worker who escaped", "street-smart entrepreneur in urban apartment", "wellness creator in minimalist studio")
2. Platform energy: (e.g. "confessional and raw", "confident and slightly controversial", "genuinely excited about a discovery", "frustrated truth-teller")
3. Signature environment: ONE real location that persists across ALL or most scenes (e.g. "cramped home desk with sticky notes and coffee rings", "parked car dashboard in rain", "kitchen table at 6am", "crowded café corner booth")
4. Signature lighting: ONE lighting scenario that defines the look (e.g. "morning window light left side", "monitor glow in dark room", "golden hour through apartment window", "fluorescent office light")

ALL scenes must feel like they belong to the SAME creator in the SAME visual world.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — VISUAL THEME (locked before any scene is written)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Pick ONE visual style and LOCK these shared values for every scene:
- palette: 3-4 specific hex values or named colors dominant in the environment
- lighting: the one real-world light source that defines the look (natural/practical only — NO "dramatic lighting", NO "rim light")
- lens: lens character that matches a smartphone creator (shallow DOF portrait mode, slight natural vignette, etc.)
- filmLook: subtle grade (muted saturation, slight grain, warm/cool temp — never "cinematic grade" as a vague catch-all)
- motion: the camera's personality (slight natural handheld drift, creator self-filmed push-in, documentary follow, etc.)

Visual style presets (pick the one that fits the topic and creator):
- "dark-cinematic": dim room, phone or laptop screen glow as key, deep natural shadows, raw confessional energy, dim practical lamp in background
- "bright-minimal": clean natural window light, soft background bokeh, airy home studio, smartphone portrait mode feel
- "neon-tech": late-night urban energy, monitor or neon sign as key light, high saturation, fast cuts
- "warm-story": golden hour through window or car windshield, organic warm bokeh, emotional human connection
- "high-contrast": strong directional window light vs deep shadow, high-stakes confession, documentary urgency

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NARRATIVE ARC (follow this scene structure exactly):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${variantGuide}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — EACH SCENE: 10-POINT SHOT SPEC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For EVERY scene, mentally spec out all 10 points before writing the visualPrompt:
1. Scene purpose: what this scene accomplishes emotionally (hook, destabilize, reveal, ground, invite)
2. Emotional tone: creator's emotional state in this scene (frustrated, genuinely shocked, confiding, calm, energized)
3. Camera framing: exact shot type (ECU / CU / MCU / MS / WS)
4. Camera angle: eye level / low / high / OTS / dutch
5. Creator behavior: ONE specific micro-action the creator performs (jaw tight, leans forward 3 inches, exhales sharply, pushes glasses up, looks off then back to camera)
6. Environment detail: 2-3 specific real-world objects visible (sticky note on monitor, half-empty coffee mug, tangled headphone cable, rain on car window, plant in background)
7. Lighting: exact source and quality (morning sun from east window spilling across left shoulder, phone screen glow catching chin and nose, practical floor lamp creating warm pool behind subject)
8. Camera movement: specific move (slight natural drift, slow creator self-film push-in 3cm, documentary follow, locked frame with subtle lens breathing)
9. Social-native qualifier: one phrase that grounds it in TikTok reality (authentic street energy, intimate confession frame, handheld vlog realism, documentary interview pacing)
10. Veo prompt synthesis: collapse all 9 points into the visualPrompt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REFERENCE SHOT EXAMPLES (match this energy and specificity):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLE A — Street interview: "Handheld MCU of creator approaching strangers in downtown city environment at dusk, natural pedestrian flow behind, imperfect framing with slight horizon tilt, creator genuinely reacting to responses, social-native documentary pacing, urban ambient light, 9:16 vertical portrait"

EXAMPLE B — Car confession: "Creator-POV CU inside parked car during light rain, dashboard glow as only light source, windshield raindrops creating bokeh, creator leaning slightly toward phone with jaw tight and exhale visible, intimate TikTok confession energy, subtle natural camera drift, 9:16 vertical portrait"

EXAMPLE C — Night market: "Handheld MLS creator walking through crowded night market, neon sign reflections on wet pavement, creator turning back to camera mid-stride with genuine reaction, natural crowd movement, documentary street energy, slight camera sway from walking, 9:16 vertical portrait"

EXAMPLE D — Home office reveal: "Creator-POV slow push-in MCU at cluttered desk, monitor casting blue light on face, sticky notes visible on screen edge, creator leaning in with visible tension in shoulders like sharing something they shouldn't, dim room with single warm lamp behind, authentic imperfection, slight lens breathing, 9:16 vertical portrait"

EXAMPLE E — Kitchen confession: "Handheld CU of creator at kitchen table 6am, one hand wrapped around mug, window light barely starting, honest unpolished morning energy, slightly unfocused eyes that sharpen to camera, no performative presentation just real, 9:16 vertical portrait"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VEO-SPECIFIC REQUIREMENTS (these generate real AI video):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Veo generates MOTION from your text. Write prompts that describe BELIEVABLE MOTION:
✅ DO: walking movement, natural breathing, subtle head turn, slight lean, hand gestures, environmental motion (rain, crowd, steam from mug)
✅ DO: specific real-world textures (rain on glass, laptop fan glow, book pages)
✅ DO: simple human behaviors with natural physics
❌ DON'T: text overlays, UI elements, logos, graphs, impossible camera moves
❌ DON'T: "dramatic lighting" / "cinematic grade" / "epic" / "stunning" (too generic)
❌ DON'T: describe multiple rapid scene cuts WITHIN one visualPrompt (Veo renders ONE continuous shot)
❌ DON'T: complex multi-person interactions or impossible spatial movements

Each visualPrompt generates ONE 4-8 second continuous shot. Think: what would a creator actually film in one take?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SHOT TYPES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ECU (Extreme Close-Up): eyes only, specific object detail, intense emotion
CU (Close-Up): face fills frame, confession, reaction
MCU (Medium Close-Up): head + shoulders, conversation, interview feel
MS (Medium Shot): waist up, action + dialogue
WS (Wide Shot): environment dominant, establishing context
NEVER repeat the same shot type in consecutive scenes.

CONTINUITY — enforce across ALL scenes:
- 180° rule: if creator faces right in s1, they face right in s2-s5. Never flip axis.
- Environment continuity: unless the variant changes location, keep the same room/setting
- Shot variety: tight → wide → medium → tight (alternate always)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAPTION + TIMING RULES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Narration per scene: 6-12 words ONLY. Punchy. No filler. No passive voice.
- Total narration: 30-45 words across ALL scenes
- caption: 2-3 POWER WORDS. No articles (a/an/the). All caps.
- keyWord: ONE word (lowercase) from caption — most impactful
- frames = seconds × 30 (integer)
- zoomDir: vary — never same direction in consecutive scenes
- captionStyle: "impact" for hook/cta | "word-by-word" for revelation | "slide-up" for insight | "pulse" for proof

MUSIC MOODS: tense | uplifting | mysterious | energetic | calm

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL QUALITY CHECK (before outputting JSON):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Does every visualPrompt describe ONE continuous shot a creator could realistically film?
2. Does every scene feel like it belongs to the SAME creator in the SAME visual world?
3. Is there natural believable motion described in every shot?
4. Are shot types alternated (no two CUs in a row)?
5. Is there a specific behavioral micro-action in every scene?
6. Does the final output feel like a real TikTok, not a stock ad?

Return ONLY valid JSON (no markdown, no explanation):
{
  "visualStyle": "dark-cinematic",
  "musicMood": "tense",
  "visualTheme": {
    "palette": "deep charcoal #1a1a2e, monitor blue-white, warm amber lamp glow",
    "lighting": "monitor glow as key light on face, single warm practical lamp behind, window dark outside",
    "lens": "shallow depth of field, smartphone portrait mode, natural vignette",
    "filmLook": "subtle film grain, muted saturation, cool 5500K with warm background contrast",
    "motion": "slight natural handheld drift, creator self-film slow push-in"
  },
  "scenes": [
    {
      "id": "s1", "beat": "hook", "seconds": 4, "frames": 120,
      "narration": "6-12 words max, punchy, no filler",
      "composition": "MCU, eye level",
      "cameraMove": "creator-POV handheld slight drift",
      "visualPrompt": "Creator-POV MCU of person at cluttered home desk mid-rant, monitor glow casting blue-white light across frustrated face, sticky notes visible on screen edges, tangled headphone cable on desk surface, leaning 3 inches toward camera with jaw tight and visible tension in shoulders, dim room with warm lamp glow behind, slight natural camera drift, authentic confessional TikTok energy, 9:16 vertical portrait",
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
        palette:  raw.visualTheme?.palette  ?? "cinematic tones",
        lighting: raw.visualTheme?.lighting ?? "dramatic rim lighting",
        lens:     raw.visualTheme?.lens     ?? "shallow depth of field",
        filmLook: raw.visualTheme?.filmLook ?? "subtle film grain",
        motion:   raw.visualTheme?.motion   ?? "slow dolly push-ins",
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
      palette:  "deep charcoal #1a1a2e, electric indigo #6366f1, warm white #f8fafc",
      lighting: "natural window light from left as key, ambient room fill, practical phone screen glow in darker scenes",
      lens:     "shallow depth of field, smartphone portrait mode feel, natural background bokeh",
      filmLook: "subtle film grain, muted saturation, warm 3200K color temperature",
      motion:   "slight natural handheld drift, creator-POV slow phone push-ins",
    };

    return { topic, visualStyle: "dark-cinematic", musicMood: "tense", visualTheme: fallbackTheme, totalFrames, fullScript, scenes };
  }
}
