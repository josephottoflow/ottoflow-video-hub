/**
 * FFMPEG POST-PROCESSOR — Smart video finisher for social media
 *
 * Applied after every Remotion render:
 *   1. Per-theme color grade (eq filter)
 *   2. Video fade in/out
 *   3. EBU R128 audio loudness normalization (-16 LUFS — TikTok/YouTube standard)
 *   4. Background music injection (loops to video length, full volume, no voiceover)
 *   5. Platform-aware H.264 compression (CRF + preset per platform)
 *   6. Portrait 1080×1920 lock, 30fps, AAC 192k
 *
 * Uses system FFmpeg; falls back to ffmpeg-static bundled binary.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { ThemePreset } from "../design/design-agent";

// ─── Bundled binary fallback ──────────────────────────────────

function getFfmpegBin(): string {
  try {
    execSync("ffmpeg -version", { stdio: "pipe", timeout: 3000 });
    return "ffmpeg";
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = require("ffmpeg-static") as string;
    if (staticPath && fs.existsSync(staticPath)) return `"${staticPath}"`;
    throw new Error("FFmpeg not found on PATH and ffmpeg-static binary missing");
  }
}

function getFfprobeBin(): string {
  try {
    execSync("ffprobe -version", { stdio: "pipe", timeout: 3000 });
    return "ffprobe";
  } catch {
    // ffprobe ships alongside ffmpeg-static — swap bin name
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const staticPath = (require("ffmpeg-static") as string) || "";
    const probe = staticPath.replace("ffmpeg", "ffprobe");
    if (probe && fs.existsSync(probe)) return `"${probe}"`;
    return "ffprobe"; // last resort
  }
}

// ─── Color grade presets (per theme) ─────────────────────────

const GRADE: Record<ThemePreset, string> = {
  neon:    "eq=brightness=0.05:contrast=1.3:saturation=1.8",
  bold:    "eq=brightness=0.05:contrast=1.4:saturation=1.5",
  tech:    "eq=brightness=0.0:contrast=1.2:saturation=1.1",
  luxury:  "eq=brightness=0.02:contrast=1.15:saturation=0.85",
  outdoor: "eq=brightness=0.03:contrast=1.1:saturation=1.25",
  minimal: "eq=brightness=0.0:contrast=1.05:saturation=1.0",
};

// ─── Platform encoding presets ────────────────────────────────

const PLATFORM_PRESET = {
  tiktok:    { crf: 23, preset: "fast"      },
  youtube:   { crf: 22, preset: "medium"    },
  instagram: { crf: 24, preset: "fast"      },
  // ultrafast + single thread: ~60% less encoder RAM — acceptable quality for Railway free tier
  default:   { crf: 28, preset: "ultrafast" },
} as const;

// EBU R128 target for social media platforms
const LUFS_TARGET  = -16;
const LUFS_TP      = -1.5;  // true peak
const LUFS_LRA     = 11;    // loudness range

// ─── Types ────────────────────────────────────────────────────

export interface FFmpegResult {
  success:       boolean;
  inputPath:     string;
  outputPath:    string;
  fileSizeBytes?: number;
  durationMs?:   number;
  error?:        string;
}

export interface PostProcessOptions {
  fadeIn?:          number;   // seconds, default 0.3
  fadeOut?:         number;   // seconds, default 0.3
  crf?:             number;   // overrides platform preset
  suffix?:          string;   // default "" (replaces input in-place slug)
  platform?:        "tiktok" | "youtube" | "instagram" | "default";
  voiceoverPath?:   string;   // ElevenLabs narration MP3 (primary audio)
  musicPath?:       string;   // background music MP3
  musicVolume?:     number;   // 0.0–1.0 when mixed with voiceover, default 0.12
  normalize?:       boolean;  // EBU R128 loudness normalize, default true
}

// ─── FFmpeg Agent ─────────────────────────────────────────────

export class FFmpegAgent {

  async postProcess(
    inputPath: string,
    theme: ThemePreset = "minimal",
    options: PostProcessOptions = {}
  ): Promise<FFmpegResult> {
    const startTime    = Date.now();
    const fadeIn          = options.fadeIn       ?? 0.3;
    const fadeOut         = options.fadeOut      ?? 0.3;
    const platform        = options.platform     ?? "default";
    const platPreset      = PLATFORM_PRESET[platform];
    const crf             = options.crf          ?? platPreset.crf;
    const preset          = platPreset.preset;
    const suffix          = options.suffix       ?? "";
    const musicVolume     = options.musicVolume  ?? 0.12;
    const normalize       = options.normalize    ?? true;
    const grade        = GRADE[theme] || GRADE.minimal;
    const ffmpeg       = getFfmpegBin();
    const ffprobe      = getFfprobeBin();

    const ext          = path.extname(inputPath);
    const base         = inputPath.replace(ext, "");
    const outputPath   = suffix ? `${base}${suffix}${ext}` : inputPath.replace(ext, `-out${ext}`);

    if (!fs.existsSync(inputPath)) {
      return { success: false, inputPath, outputPath, error: `Input not found: ${inputPath}` };
    }

    // Probe video duration and whether an audio stream exists
    let duration = 32;
    let hasInputAudio = false;
    try {
      const probe = execSync(
        `${ffprobe} -v error -show_entries format=duration:stream=codec_type -of json "${inputPath}"`,
        { encoding: "utf-8", timeout: 15000 }
      ).trim();
      const probeData = JSON.parse(probe);
      duration = parseFloat(probeData?.format?.duration) || 32;
      hasInputAudio = (probeData?.streams || []).some(
        (s: { codec_type: string }) => s.codec_type === "audio"
      );
    } catch {
      console.warn(`[ffmpeg] Duration probe failed — using ${duration}s fallback (check video is valid)`);
    }

    const fadeOutStart    = Math.max(0, duration - fadeOut);
    const hasVoiceover    = !!(options.voiceoverPath && fs.existsSync(options.voiceoverPath));
    const hasMusicFile    = !!(options.musicPath      && fs.existsSync(options.musicPath));

    // Video filtergraph: grade → fade in → fade out → portrait scale
    const vf = [
      grade,
      `fade=t=in:st=0:d=${fadeIn}`,
      `fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut}`,
      "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
    ].join(",");

    const normFilter = normalize ? `loudnorm=I=${LUFS_TARGET}:TP=${LUFS_TP}:LRA=${LUFS_LRA}` : null;

    let cmd: string;

    if (hasVoiceover && hasMusicFile) {
      // Voiceover (primary, 1.0) + background music (0.12) — mix both
      const musicFadeOut = Math.max(0, duration - 2.0);
      const voFadeOut    = Math.max(0, duration - 1.0);
      const outLabel     = normFilter ? "[final]" : "[aout]";
      const filterComplex = [
        `[1:a]volume=1.0,afade=t=in:st=0:d=0.3,afade=t=out:st=${voFadeOut.toFixed(3)}:d=1.0[vo]`,
        `[2:a]volume=${musicVolume},afade=t=in:st=0:d=2,afade=t=out:st=${musicFadeOut.toFixed(3)}:d=2[bg]`,
        `[vo][bg]amix=inputs=2:duration=longest:dropout_transition=2[aout]`,
        ...(normFilter ? [`[aout]${normFilter}[final]`] : []),
      ].join(";");

      cmd = [
        `${ffmpeg} -y -threads 1`,
        `-i "${inputPath}"`,
        `-i "${options.voiceoverPath}"`,
        `-stream_loop -1 -i "${options.musicPath}"`,
        `-vf "${vf}"`,
        `-filter_complex "${filterComplex}"`,
        "-map 0:v",
        `-map "${outLabel}"`,
        "-c:v libx264", `-crf ${crf}`, `-preset ${preset}`,
        "-x264opts threads=1:lookahead_threads=1",
        "-c:a aac -b:a 128k",
        `-t ${duration.toFixed(3)}`,
        "-r 30", "-movflags +faststart", "-pix_fmt yuv420p",
        `"${outputPath}"`,
      ].join(" ");

      console.log(`[ffmpeg] Voiceover + music (${(musicVolume * 100).toFixed(0)}% bg), EBU R128 ${LUFS_TARGET} LUFS`);

    } else if (hasVoiceover) {
      // Voiceover only — no background music
      const voFadeOut = Math.max(0, duration - 1.0);
      const outLabel  = normFilter ? "[final]" : "[vo]";
      const filterComplex = [
        `[1:a]volume=1.0,afade=t=in:st=0:d=0.3,afade=t=out:st=${voFadeOut.toFixed(3)}:d=1.0[vo]`,
        ...(normFilter ? [`[vo]${normFilter}[final]`] : []),
      ].join(";");

      cmd = [
        `${ffmpeg} -y -threads 1`,
        `-i "${inputPath}"`,
        `-i "${options.voiceoverPath}"`,
        `-vf "${vf}"`,
        `-filter_complex "${filterComplex}"`,
        "-map 0:v",
        `-map "${outLabel}"`,
        "-c:v libx264", `-crf ${crf}`, `-preset ${preset}`,
        "-x264opts threads=1:lookahead_threads=1",
        "-c:a aac -b:a 128k",
        `-t ${duration.toFixed(3)}`,
        "-r 30", "-movflags +faststart", "-pix_fmt yuv420p",
        `"${outputPath}"`,
      ].join(" ");

      console.log(`[ffmpeg] Voiceover only, EBU R128 ${LUFS_TARGET} LUFS`);

    } else if (hasMusicFile) {
      // Music only (no voiceover) — replaces video audio entirely
      const musicFadeOut = Math.max(0, duration - 2.0);
      const afFilters = [
        `volume=1.0`,
        `afade=t=in:st=0:d=2`,
        `afade=t=out:st=${musicFadeOut.toFixed(3)}:d=2`,
        ...(normalize ? [`loudnorm=I=${LUFS_TARGET}:TP=${LUFS_TP}:LRA=${LUFS_LRA}`] : []),
      ].join(",");

      cmd = [
        `${ffmpeg} -y -threads 1`,
        `-i "${inputPath}"`,
        `-stream_loop -1 -i "${options.musicPath}"`,
        `-vf "${vf}"`,
        `-filter:a "${afFilters}"`,
        "-map 0:v", "-map 1:a",
        "-c:v libx264", `-crf ${crf}`, `-preset ${preset}`,
        "-x264opts threads=1:lookahead_threads=1",
        "-c:a aac -b:a 128k",
        "-r 30", "-shortest", "-movflags +faststart", "-pix_fmt yuv420p",
        `"${outputPath}"`,
      ].join(" ");

      console.log(`[ffmpeg] Music only, EBU R128 ${LUFS_TARGET} LUFS`);

    } else if (hasInputAudio) {
      // No external audio — normalize video's own audio stream
      const afFilters = [
        `afade=t=in:st=0:d=${fadeIn}`,
        `afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut}`,
        ...(normalize ? [`loudnorm=I=${LUFS_TARGET}:TP=${LUFS_TP}:LRA=${LUFS_LRA}`] : []),
      ].join(",");

      cmd = [
        `${ffmpeg} -y -threads 1`,
        `-i "${inputPath}"`,
        `-vf "${vf}"`,
        `-af "${afFilters}"`,
        "-c:v libx264", `-crf ${crf}`, `-preset ${preset}`,
        "-x264opts threads=1:lookahead_threads=1",
        "-c:a aac -b:a 128k",
        "-r 30", "-movflags +faststart", "-pix_fmt yuv420p",
        `"${outputPath}"`,
      ].join(" ");
    } else {
      // No audio at all (silent Remotion render) — video-only output
      cmd = [
        `${ffmpeg} -y -threads 1`,
        `-i "${inputPath}"`,
        `-vf "${vf}"`,
        "-an",
        "-c:v libx264", `-crf ${crf}`, `-preset ${preset}`,
        "-x264opts threads=1:lookahead_threads=1",
        "-r 30", "-movflags +faststart", "-pix_fmt yuv420p",
        `"${outputPath}"`,
      ].join(" ");
    }

    try {
      console.log(`[ffmpeg] cmd: ${cmd}`);
      execSync(cmd, { stdio: "pipe", timeout: 300000 });

      if (!fs.existsSync(outputPath)) {
        throw new Error("FFmpeg completed but output not found");
      }

      const stats = fs.statSync(outputPath);
      console.log(
        `[ffmpeg] Done: ${path.basename(outputPath)} — ` +
        `${(stats.size / 1024 / 1024).toFixed(1)}MB in ${Math.round((Date.now() - startTime) / 1000)}s`
      );

      return {
        success:       true,
        inputPath,
        outputPath,
        fileSizeBytes: stats.size,
        durationMs:    Date.now() - startTime,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown FFmpeg error";
      // execSync with stdio:"pipe" puts the actual FFmpeg error in err.stderr (not err.message)
      const raw    = (err as { stderr?: Buffer | string }).stderr;
      const stderr = Buffer.isBuffer(raw) ? raw.toString("utf-8") : (raw ?? "");
      // FFmpeg errors appear at the END of stderr — take last 3000 chars
      const errDetail = stderr ? stderr.slice(-3000).trim() : msg;
      console.error(`[ffmpeg] FAILED: ${msg}`);
      if (stderr) console.error(`[ffmpeg] stderr:\n${errDetail}`);
      return { success: false, inputPath, outputPath, error: errDetail || msg };
    }
  }

  /**
   * Probe a video file — returns duration, resolution, codec, bitrate.
   */
  probeVideo(videoPath: string): { duration: number; width: number; height: number; bitrate: number } {
    const ffprobe = getFfprobeBin();
    try {
      const raw = execSync(
        `${ffprobe} -v error -select_streams v:0 -show_entries stream=width,height,bit_rate:format=duration -of json "${videoPath}"`,
        { encoding: "utf-8", timeout: 15000 }
      );
      const data = JSON.parse(raw);
      return {
        duration: parseFloat(data.format?.duration || "32"),
        width:    parseInt(data.streams?.[0]?.width || "1080"),
        height:   parseInt(data.streams?.[0]?.height || "1920"),
        bitrate:  parseInt(data.streams?.[0]?.bit_rate || data.format?.bit_rate || "0"),
      };
    } catch {
      return { duration: 32, width: 1080, height: 1920, bitrate: 0 };
    }
  }

  /**
   * Extract a thumbnail frame at the given time (default 1s).
   */
  extractThumbnail(videoPath: string, atSeconds = 1): string {
    const ffmpeg   = getFfmpegBin();
    const thumbPath = videoPath.replace(/\.mp4$/, "-thumb.jpg");
    try {
      execSync(
        `${ffmpeg} -y -ss ${atSeconds} -i "${videoPath}" -frames:v 1 -q:v 2 "${thumbPath}"`,
        { stdio: "pipe", timeout: 30000 }
      );
    } catch { /* ignore */ }
    return thumbPath;
  }

  /**
   * Compress a finished video for Telegram delivery (< 45MB target).
   */
  async compressForTelegram(inputPath: string): Promise<FFmpegResult> {
    return this.postProcess(inputPath, "minimal", {
      fadeIn: 0, fadeOut: 0, crf: 33, suffix: "-tg", normalize: false,
    });
  }

  /**
   * Returns true if FFmpeg is available (system or bundled).
   */
  static isAvailable(): boolean {
    try {
      getFfmpegBin();
      return true;
    } catch {
      return false;
    }
  }
}
