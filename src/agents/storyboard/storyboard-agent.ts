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

    const prompt = `You are a UGC-native TikTok creative director. Generate a complete video storyboard JSON for a short-form vertical video that feels like a high-performing creator video — NOT a stock ad or corporate explainer.

TOPIC: "${topic}"
CONTENT STYLE: "${style}"
NARRATIVE VARIANT: ${renderVariant}
HOOK STYLE: ${hookStyle} — ${hookGuide}${seedNote}

NARRATIVE ARC (follow this scene structure exactly):
${variantGuide}

UGC REALISM DOCTRINE — every visualPrompt must embody this:
- Camera: handheld or slightly unstable — never describe a locked-off tripod shot unless establishing
- Environment: real locations with texture — coffee shops, home offices, bedrooms, streets, cars, gyms
- Lighting: natural or practical sources — window light, phone screens, ring lights, sunlight, neon signs
- Human behavior: specific micro-actions — adjusting glasses, leaning forward, quick exhale, jaw tension
- Imperfection is intentional: slight lens breathing, natural shadows, authentic body language
- Creator presence: feels like a real person filmed this — not a production crew
- NO: "dramatic rim lighting", "perfect studio lighting", "generic commercial scene"
- YES: "natural window light spilling across left side of face", "phone screen glow in dark room", "golden hour through car windshield"

STEP 1 — VISUAL THEME (establish this FIRST, applied to EVERY scene):
Pick ONE visual style and lock these shared values:
- palette: 3-4 specific colors (e.g. "deep navy #1a1f3c, electric blue #3b82f6, white #f8fafc")
- lighting: specific natural/practical source (e.g. "morning window light from left, soft ambient fill, no artificial key")
- lens: specific character (e.g. "shallow depth of field, smartphone portrait mode feel, gentle natural bokeh")
- filmLook: specific grade (e.g. "subtle film grain, muted saturation, warm 3200K color temperature")
- motion: specific movement style (e.g. "slight natural handheld drift, creator-POV push-ins")

Visual style presets:
- "dark-cinematic": moody creator realism — dim practical light, phone or laptop screen glow, handheld stability, raw documentary energy, real environment texture, authentic imperfection
- "bright-minimal": clean creator aesthetic — natural window light, soft-focus backgrounds, smartphone portrait mode feel, airy home office or studio energy
- "neon-tech": late-night creator vibe — neon or monitor light as key, urban night environment, high-energy body language, TikTok tech creator aesthetic
- "warm-story": golden hour creator vlog — warm window light, natural bokeh from real backgrounds, organic camera drift, emotional warmth, human connection
- "high-contrast": documentary confessional — bold natural light vs deep shadow, creator speaking directly to camera with urgency, handheld intimacy, raw credibility

STEP 2 — EACH SCENE must reference the Visual Theme in its visualPrompt.

CAPTION STYLES (vary across scenes — never same style twice in a row):
- "impact": 2-3 power words (hook and cta beats)
- "word-by-word": words appear sequentially (revelation beats)
- "slide-up": phrase slides up from bottom (insight beats)
- "pulse": words scale-pulse in (proof beats)

MUSIC MOODS: tense | uplifting | mysterious | energetic | calm

SHOT TYPES (pick the right one per beat):
- ECU (Extreme Close-Up): fine detail or intense emotion — eyes only, a specific object
- CU (Close-Up): face fills frame — dialogue, reaction, emotion
- MCU (Medium Close-Up): head and shoulders — conversation, interview feel
- MS (Medium Shot): waist up — action, general dialogue
- MLS (Medium Long Shot): knees up — walking, casual movement
- LS (Long Shot): full body — character in context
- WS (Wide Shot): environment dominant — location, scale, establishing
- EWS (Extreme Wide Shot): vast landscape — epic scope, isolation, scene transitions

CAMERA ANGLES (choose based on emotional intent):
- Eye level: neutral, natural — default
- Low angle: subject looks powerful, dominant — authority, heroism, threat
- High angle: subject looks small, vulnerable — weakness, overview
- Dutch angle: unease, disorientation — tension, chaos
- OTS (Over-the-Shoulder): viewer positioned with character — conversations

CONTINUITY RULES (enforce across ALL scenes):
1. 180-degree rule: imagine an axis through the subject. ALL camera positions must stay on ONE side of that axis. If shot 1 shows subject facing right, shots 2-4 must also show subject facing right. Never flip.
2. Screen direction: if a subject moves left-to-right in one scene, maintain that direction in the next. Reversing implies they turned around.
3. Shot variety: NEVER use the same shot type (ECU/CU/MS/WS etc.) twice in a row. Alternate between tight and wide.
4. Establishing first: first scene should use WS or wider to ground the viewer in space, unless the variant demands an ECU hook.

RULES:
1. Scene count: match variant guide (3-5 scenes)
2. Narration per scene: 6-12 words ONLY. Punchy. No filler.
3. Total narration: 30-45 words across ALL scenes
4. caption: 2-3 words ONLY. Power words. No articles.
5. keyWord: ONE word from caption (most impactful, lowercase)
6. frames = seconds * 30 (integer)
7. visualPrompt: 40-80 words, UGC-native, concrete subjects (not vague), NO text overlays, MUST include the visual theme palette/lighting/lens/filmLook from Step 1. Formula: "Handheld creator-POV [shot type] of [specific subject doing specific action], [realistic environment: e.g. 'cluttered home desk with coffee cup visible'], [natural light source: e.g. 'morning light from left window'], [specific human behavioral cue: e.g. 'visible frustration in jaw and posture'], authentic documentary energy, slight camera drift, TikTok-native framing, 9:16 vertical portrait"
8. composition: shot type + angle from SHOT TYPES list above (e.g. "ECU, low angle" / "WS, eye level" / "CU, OTS")
9. cameraMove: specific move (slight natural drift / creator-POV handheld / slow phone push-in / documentary follow / tracking / static / slow dolly in / slow dolly out)
10. First scene beat = "hook". Last scene beat = "cta".
11. zoomDir: vary — never same direction twice in a row
12. Respect continuity rules — note which side of the 180-degree axis each scene uses

Return ONLY valid JSON (no markdown, no explanation):
{
  "visualStyle": "dark-cinematic",
  "musicMood": "tense",
  "visualTheme": {
    "palette": "deep navy, electric blue, white highlights",
    "lighting": "phone screen glow as key light, dim ambient from window behind, deep natural shadows",
    "lens": "shallow depth of field, smartphone portrait mode feel, natural bokeh",
    "filmLook": "subtle film grain, muted saturation, 3200K warm temperature",
    "motion": "slight natural handheld drift, creator-POV push-ins"
  },
  "scenes": [
    {
      "id": "s1", "beat": "hook", "seconds": 4, "frames": 120,
      "narration": "...",
      "composition": "MCU, eye level",
      "cameraMove": "creator-POV handheld",
      "visualPrompt": "Handheld creator-POV MCU of [specific person doing specific action], [realistic environment: cluttered home desk, laptop open, coffee cup nearby], [natural light source: morning window light from left spilling across face], [behavioral cue: leaning forward with visible tension in shoulders], authentic documentary energy, slight camera drift, TikTok-native framing, 9:16 vertical portrait",
      "caption": "HOOK WORD", "keyWord": "hook", "zoomDir": "in", "captionStyle": "impact"
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
