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

  /** Pick a composition based on topic/style keywords. */
  static selectTemplate(topic: string, style: string): string {
    const t = `${topic} ${style}`.toLowerCase();
    if (t.includes("myth") || t.includes("debunk") || t.includes("truth") || t.includes("wrong") || t.includes("lie"))
      return "myth-buster";
    if (t.includes("quote") || t.includes("wisdom") || t.includes("insight") || t.includes("thought") || t.includes("mindset"))
      return "quote-card";
    if (t.includes("stat") || t.includes("data") || t.includes("number") || t.includes("percent") || t.includes("roi") || t.includes("case study") || t.includes("result"))
      return "stats-story";
    if (t.includes("how to") || t.includes("step") || t.includes("tutorial") || t.includes("guide") || t.includes("setup") || t.includes("workflow"))
      return "tutorial";
    if (t.includes("top") || t.includes("list") || t.includes("reason") || t.includes("way") || t.includes("tip") || t.includes("educational") || t.includes("principle"))
      return "listicle";
    return "cinematic";
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

      // Save video-data.json so the preview player can read it
      const contentDir = path.resolve("public", "content", productSlug);
      fs.mkdirSync(contentDir, { recursive: true });
      fs.writeFileSync(
        path.join(contentDir, "video-data.json"),
        JSON.stringify(videoData, null, 2)
      );

      const outputPath = path.join(
        outputDir,
        `${productSlug}.${this.config.app.videoFormat}`
      );

      // ── 1. Bundle (cached after first call) ──────────────
      const serveUrl = await getBundleUrl();

      // ── 2. Select composition ─────────────────────────────
      const { selectComposition } = await import("@remotion/renderer");
      const composition = await selectComposition({
        serveUrl,
        id:          compositionId,
        inputProps:  { data: videoData },
        timeoutInMilliseconds: 30_000,
        // Software GL for containerised Linux (no GPU on Railway/cloud)
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
        jpegQuality: 90,
        // 2 Chrome instances — enough parallelism without starving OffthreadVideo decode on large MP4s
        concurrency: 2,
        // Per-frame timeout — large Pexels videos (24MB+) need extra seek time
        timeoutInMilliseconds: 180_000,
        // Software GL for containerised Linux (no GPU on Railway/cloud)
        chromiumOptions: process.platform === "linux" ? { gl: "swangle" } : undefined,
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
      console.error(`[render] Failed: ${message}`);
      return { success: false, error: message };
    }
  }
}
