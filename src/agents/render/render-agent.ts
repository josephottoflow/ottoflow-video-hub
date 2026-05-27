/**
 * RENDER AGENT — Remotion programmatic renderer
 *
 * Bundles the composition ONCE per process lifetime, then reuses the
 * bundle URL for every subsequent render.  This eliminates the 300 MB+
 * public-dir re-copy that the CLI approach suffered from, prevents
 * port-conflict errors, and gives proper per-frame timeout control.
 */

import * as path from "path";
import * as fs   from "fs";
import { getConfig } from "../config/config";
import { getBundleUrl } from "../../lib/remotion-bundle";

export interface RenderResult {
  success:        boolean;
  videoPath?:     string;
  durationMs?:    number;
  fileSizeBytes?: number;
  error?:         string;
}

// ── Render Agent ──────────────────────────────────────────────

export class RenderAgent {
  private config = getConfig();

  /** Returns true if FFmpeg is available on PATH (used by orchestrator). */
  static isAvailable(): boolean {
    try {
      const { execSync } = require("child_process") as typeof import("child_process");
      execSync("ffmpeg -version", { stdio: "pipe", timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /** Pick a composition based on topic/style keywords, avoiding recent repeats. */
  static async selectTemplate(topic: string, style: string, recentTemplates: string[] = []): Promise<string> {
    const ALL_TEMPLATES = ["myth-buster", "quote-card", "stats-story", "tutorial", "listicle", "cinematic"];
    const t = `${topic} ${style}`.toLowerCase();

    let preferred = "cinematic";
    if (t.includes("myth") || t.includes("debunk") || t.includes("truth") || t.includes("wrong") || t.includes("lie"))
      preferred = "myth-buster";
    else if (t.includes("quote") || t.includes("wisdom") || t.includes("insight") || t.includes("thought") || t.includes("mindset"))
      preferred = "quote-card";
    else if (t.includes("stat") || t.includes("data") || t.includes("number") || t.includes("percent") || t.includes("roi") || t.includes("case study") || t.includes("result"))
      preferred = "stats-story";
    else if (t.includes("how to") || t.includes("step") || t.includes("tutorial") || t.includes("guide") || t.includes("setup") || t.includes("workflow"))
      preferred = "tutorial";
    else if (t.includes("top") || t.includes("list") || t.includes("reason") || t.includes("way") || t.includes("tip") || t.includes("educational") || t.includes("principle"))
      preferred = "listicle";

    if (recentTemplates.length > 0 && recentTemplates.includes(preferred)) {
      const fresh = ALL_TEMPLATES.filter(tmpl => !recentTemplates.includes(tmpl));
      if (fresh.length > 0) return fresh[0];
      const nonLatest = ALL_TEMPLATES.filter(tmpl => tmpl !== recentTemplates[0]);
      return nonLatest[0] ?? preferred;
    }

    return preferred;
  }

  async render(
    productSlug:   string,
    videoData:     unknown,
    outputDir:     string,
    compositionId  = "cinematic"
  ): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      fs.mkdirSync(outputDir, { recursive: true });

      // Save video-data.json so the preview player can read it (local only — Vercel fs is read-only)
      if (!process.env.VERCEL) {
        const contentDir = path.resolve("public", "content", productSlug);
        fs.mkdirSync(contentDir, { recursive: true });
        fs.writeFileSync(
          path.join(contentDir, "video-data.json"),
          JSON.stringify(videoData, null, 2)
        );
      }

      const outputPath = path.join(
        outputDir,
        `${productSlug}.${this.config.app.videoFormat}`
      );

      // ── 1. Bundle (cached after first call) ──────────────
      const serveUrl = await getBundleUrl();
      console.log(`[render] serveUrl=${serveUrl.slice(0, 80)} compositionId=${compositionId} outputPath=${outputPath}`);

      // ── 2. Select composition ─────────────────────────────
      const { selectComposition } = await import("@remotion/renderer");
      console.log(`[render] Selecting composition "${compositionId}"...`);
      const composition = await selectComposition({
        serveUrl,
        id:          compositionId,
        inputProps:  { data: videoData },
        timeoutInMilliseconds: 30_000,
        chromiumOptions: process.platform === "linux" ? { gl: "swangle" } : undefined,
      });

      // ── 3. Render ─────────────────────────────────────────
      const { renderMedia } = await import("@remotion/renderer");

      let lastPct = 0;
      await renderMedia({
        composition,
        serveUrl,
        codec:       "h264",
        outputLocation: outputPath,
        inputProps:  { data: videoData },
        imageFormat: "jpeg",
        // Lower quality = smaller per-frame buffers = less peak RAM on free-tier Railway
        jpegQuality: 75,
        // Single Chrome instance — halves the Chromium RSS on Railway's 512MB free tier
        concurrency: 1,
        // scale=2/3 → Chrome renders JPEG frames at 720×1280 instead of 1080×1920,
        // cutting per-frame buffer sizes ~56%. FFmpegAgent upscales back to 1080×1920.
        scale: 2 / 3,
        // Cap video bitrate so libx264 uses fewer reference frame buffers
        videoBitrate: "2M",
        // Disable parallel encoding pipeline (saves ~50-100 MB peak)
        disallowParallelEncoding: true,
        timeoutInMilliseconds: 120_000,
        chromiumOptions: process.platform === "linux" ? { gl: "swangle" } : undefined,
        // Force x264 to 1 thread — default 60-thread lookahead at 1080×1920 was the
        // primary OOM source (60 threads × 40-frame lookahead × 6 MB/frame = GBs).
        ffmpegOverride: ({ args }) => {
          const idx = args.indexOf("libx264");
          if (idx !== -1) {
            return [
              ...args.slice(0, idx + 1),
              "-x264-params", "threads=1:lookahead_threads=1",
              ...args.slice(idx + 1),
            ];
          }
          return args;
        },
        onProgress: ({ progress }) => {
          const pct = Math.round(progress * 100);
          if (pct >= lastPct + 10) {
            console.log(`[render] ${productSlug}: ${pct}%`);
            lastPct = pct;
          }
        },
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error("renderMedia completed but output file not found");
      }

      const stats = fs.statSync(outputPath);
      console.log(`[render] Done — ${(stats.size / 1_048_576).toFixed(1)} MB`);

      return {
        success:        true,
        videoPath:      outputPath,
        durationMs:     Date.now() - startTime,
        fileSizeBytes:  stats.size,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack   = error instanceof Error ? (error.stack ?? "") : "";
      console.error(`[render] FAILED: ${message}`);
      if (stack) console.error(`[render] Stack: ${stack}`);
      return { success: false, error: message };
    }
  }
}
