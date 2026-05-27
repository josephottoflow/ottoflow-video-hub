/**
 * VOICEOVER AGENT — ElevenLabs TTS narration
 *
 * Converts the educational script to an MP3 voiceover track.
 * Mixed by FFmpegAgent: voiceover at full volume + background music at ~12%.
 * Gracefully skips if ELEVENLABS_API_KEY is not set.
 *
 * Voice selection: maps the Google Sheets "Voice" column (col F)
 * to ElevenLabs voice IDs. Falls back to ELEVENLABS_VOICE_ID env var.
 */

import { ElevenLabsClient } from "elevenlabs";
import * as fs from "fs";
import * as path from "path";

// eleven_v3 — dramatic delivery, most expressive; ideal for UGC hook-style content
// Falls back to turbo_v2_5 if v3 access is not on the account
const MODEL_ID      = "eleven_v3";
const OUTPUT_FORMAT = "mp3_44100_128";

// Target spoken duration in seconds — scripts are written for 12s, leaving 8s of visual breathing room in a 20s video
const TARGET_DURATION_S = 12;

// Maps human-readable voice names (from Google Sheets col F) → ElevenLabs voice IDs
const VOICE_MAP: Record<string, string> = {
  // Female voices
  "female energetic":     "MF3mGyEYCl7XYWbV9V6O",  // Elli — emotional, young (legacy V1)
  "female calm":          "21m00Tcm4TlvDq8ikWAM",    // Rachel — calm, clear (default fallback)
  "female soft":          "EXAVITQu4vr4xnSDxMaL",    // Bella — soft, warm
  "female warm":          "ThT5KcBeYPX3keUQqHPh",    // Dorothy — warm, engaging
  "female professional":  "jsCqWAovK2LkecY7zXl4",    // Freya — confident
  "female bright":        "jBpfuIE2acCO8z3wKNLl",    // Gigi — bright, bubbly, youthful
  "female cheerful":      "jBpfuIE2acCO8z3wKNLl",    // Gigi
  "bright friendly":      "jBpfuIE2acCO8z3wKNLl",    // Gigi — V2 canonical creator voice
  "nichalia":             "jBpfuIE2acCO8z3wKNLl",    // Gigi — Nichalia Schwartz style
  "nichalia schwartz":    "jBpfuIE2acCO8z3wKNLl",    // Gigi
  // Male voices
  "male deep":            "TxGEqnHWrfWFTfGW9XjX",    // Josh — deep, authoritative
  "male professional":    "VR6AewLTigWG4xSOukaG",    // Arnold — crisp, professional
  "male warm":            "pNInz6obpgDQGcFmaJgB",    // Adam — deep, warm
  "male conversational":  "ErXwobaYiN019PkySvjV",    // Antoni — well-rounded
  "male energetic":       "yoZ06aMxZJJ28mfd3POQ",    // Sam — raspy, energetic
};

// Voice aliases — normalize legacy/generic sheet values to canonical voice names.
// Applied BEFORE VOICE_MAP lookup. This is the single source of truth for V2 voice routing.
// "female energetic" is the legacy V1 sheet default that should map to the V2 creator voice.
const VOICE_ALIASES: Record<string, string> = {
  // V2 creator voice aliases — all route to Gigi (bright, bubbly, TikTok-native)
  "female energetic":   "bright friendly",   // legacy V1 default → V2 creator voice
  "female":             "bright friendly",
  "energetic":          "bright friendly",
  "bright":             "bright friendly",
  "friendly":           "bright friendly",
  "bubbly":             "bright friendly",
  "creator":            "bright friendly",
  "creator native":     "bright friendly",
  "creator-native":     "bright friendly",
  "tiktok":             "bright friendly",
  "reels":              "bright friendly",
  "ugc":                "bright friendly",
  "social":             "bright friendly",
  "upbeat":             "bright friendly",
  "gigi":               "bright friendly",
  // Other convenience aliases
  "calm":               "female calm",
  "professional":       "female professional",
  "rachel":             "female calm",
  "warm":               "female warm",
  "soft":               "female soft",
};

function normalizeVoiceName(voiceName: string): string {
  return VOICE_ALIASES[voiceName.toLowerCase().trim()] ?? voiceName.toLowerCase().trim();
}

function resolveVoiceId(voiceName?: string): string {
  const fallback = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  if (!voiceName) return fallback;
  const normalized = normalizeVoiceName(voiceName);
  return VOICE_MAP[normalized] ?? fallback;
}

export class VoiceoverAgent {
  private client: ElevenLabsClient | null;

  constructor() {
    const apiKey  = process.env.ELEVENLABS_API_KEY;
    this.client   = apiKey ? new ElevenLabsClient({ apiKey }) : null;
  }

  async generate(script: string, destDir: string, voiceName?: string): Promise<string | null> {
    if (!this.client) {
      console.log("[voiceover] No ELEVENLABS_API_KEY — skipping");
      return null;
    }
    if (!script || script.trim().length < 5) {
      console.log("[voiceover] Script too short — skipping");
      return null;
    }

    const destPath = path.join(destDir, "voiceover.mp3");
    if (fs.existsSync(destPath)) {
      console.log("[voiceover] Using cached voiceover.mp3");
      return destPath;
    }

    return this.generateWithModel(script, destDir, voiceName, MODEL_ID);
  }

  private async generateWithModel(
    script:    string,
    destDir:   string,
    voiceName: string | undefined,
    modelId:   string
  ): Promise<string | null> {
    const voiceId      = resolveVoiceId(voiceName);
    const destPath     = path.join(destDir, "voiceover.mp3");
    const rawKey       = voiceName?.toLowerCase().trim() ?? "";
    const normalizedKey = voiceName ? normalizeVoiceName(voiceName) : "";
    const wasAliased   = voiceName ? normalizedKey !== rawKey : false;
    if (wasAliased) {
      console.log(`[voice] requested="${voiceName}" normalized="${normalizedKey}" voiceId="${voiceId}" (alias applied)`);
    } else {
      console.log(`[voice] requested="${voiceName ?? "none"}" voiceId="${voiceId}"`);
    }
    const label = voiceName ? `"${voiceName}"→"${normalizedKey}" (${voiceId})` : voiceId;

    // Estimate speech duration at 160 wpm; scale speed so VO fits TARGET_DURATION_S
    const wordCount  = script.trim().split(/\s+/).length;
    const naturalSec = (wordCount / 160) * 60;
    // ElevenLabs speed range: 0.7–1.3; clamp to 0.85–1.3 to avoid unnatural extremes
    const speed = Math.min(1.3, Math.max(0.85, naturalSec / TARGET_DURATION_S));
    console.log(`[voiceover] Generating — model: ${modelId}, voice: ${label}, ${wordCount} words, speed: ${speed.toFixed(2)}x`);

    try {
      const audioStream = await this.client!.textToSpeech.convert(voiceId, {
        text:          script,
        model_id:      modelId,
        output_format: OUTPUT_FORMAT,
        voice_settings: {
          stability:         0.25,   // lower = more dynamic delivery, less monotone
          similarity_boost:  0.85,   // higher = stays on-voice while being expressive
          style:             0.70,   // higher = more creator-native cadence and energy
          use_speaker_boost: true,
          speed,
        },
      });

      fs.mkdirSync(destDir, { recursive: true });
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.from(chunk));
      }
      fs.writeFileSync(destPath, Buffer.concat(chunks));

      const sizeKb = Math.round(fs.statSync(destPath).size / 1024);
      console.log(`[voiceover] Saved voiceover.mp3 (${sizeKb} KB)`);
      return destPath;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // eleven_v3 may not be on all plans — fall back to turbo_v2_5
      if (modelId === "eleven_v3" && (msg.includes("model") || msg.includes("400") || msg.includes("422"))) {
        console.warn(`[voiceover] eleven_v3 unavailable — retrying with eleven_turbo_v2_5`);
        return this.generateWithModel(script, destDir, voiceName, "eleven_turbo_v2_5");
      }
      console.warn(`[voiceover] Failed: ${msg}`);
      return null;
    }
  }

  static isAvailable(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  static getVoiceMap(): Record<string, string> {
    return { ...VOICE_MAP };
  }
}
