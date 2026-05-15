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
  "female energetic":     "MF3mGyEYCl7XYWbV9V6O",  // Elli — emotional, young
  "female calm":          "21m00Tcm4TlvDq8ikWAM",    // Rachel — calm, clear (default)
  "female soft":          "EXAVITQu4vr4xnSDxMaL",    // Bella — soft, warm
  "female warm":          "ThT5KcBeYPX3keUQqHPh",    // Dorothy — warm, engaging
  "female professional":  "jsCqWAovK2LkecY7zXl4",    // Freya — confident
  // Male voices
  "male deep":            "TxGEqnHWrfWFTfGW9XjX",    // Josh — deep, authoritative
  "male professional":    "VR6AewLTigWG4xSOukaG",    // Arnold — crisp, professional
  "male warm":            "pNInz6obpgDQGcFmaJgB",    // Adam — deep, warm
  "male conversational":  "ErXwobaYiN019PkySvjV",    // Antoni — well-rounded
  "male energetic":       "yoZ06aMxZJJ28mfd3POQ",    // Sam — raspy, energetic
};

function resolveVoiceId(voiceName?: string): string {
  const fallback = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  if (!voiceName) return fallback;
  const key = voiceName.toLowerCase().trim();
  return VOICE_MAP[key] ?? fallback;
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
    const voiceId  = resolveVoiceId(voiceName);
    const destPath = path.join(destDir, "voiceover.mp3");
    const label    = voiceName ? `"${voiceName}" (${voiceId})` : voiceId;

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
          stability:         0.35,
          similarity_boost:  0.80,
          style:             0.55,
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
