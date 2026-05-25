/**
 * PIPELINE ORCHESTRATOR — Ottoflow Video Hub
 * Text + Pexels driven. No image folders required.
 * Reads content rows from Google Sheets, fetches Pexels backgrounds,
 * renders video, sends for Telegram approval, exports per platform.
 */

import { SheetsClient, ContentRow } from "../sheets/client";
import { RenderAgent } from "../render/render-agent";
import { TelegramApprovalBot } from "../approval/telegram-bot";
import { PexelsClient } from "../pexels/pexels-client";
import { PromptEngine } from "../prompt-engine/product-prompts";
import { SeoGenerator } from "../seo/seo-generator";
import { DesignAgent } from "../design/design-agent";
import { ScriptWriterAgent } from "../scriptwriter/scriptwriter-agent";
import { sanitizeScript } from "../scriptwriter/scriptwriter-agent";
import type { HookStyle, RenderVariant } from "../scriptwriter/scriptwriter-agent";
// StoryboardAgent is V2-only; V1 uses inline Pexels query logic
import { FFmpegAgent } from "../ffmpeg/ffmpeg-agent";
import { BrandingAgent } from "../branding/branding-agent";
import { MusicAgent } from "../music/music-agent";
import { VoiceoverAgent } from "../voiceover/voiceover-agent";
import { getConfig } from "../config/config";
import { setStatus, emitLog } from "../../lib/pipeline-store";
import { getLastTemplatesForTopic, updateJobStatus } from "../../lib/db";
import { uploadVideoToDrive } from "../../lib/google-drive";
import { slugify } from "../../lib/slug-utils";
import * as path from "path";
import * as fs from "fs";
import type { ProductVideoData } from "../../remotion/types";

export interface PipelineResult {
  topic:         string;
  slug:          string;
  success:       boolean;
  outputLink?:   string;
  outputDir?:    string;
  error?:        string;
  timing: {
    startedAt:   string;
    completedAt: string;
    durationMs:  number;
  };
}

export class PipelineOrchestrator {
  private sheets         = new SheetsClient();
  private renderAgent    = new RenderAgent();
  private approvalBot    = new TelegramApprovalBot();
  private promptEngine   = new PromptEngine();
  private seoGenerator   = new SeoGenerator();
  private designAgent    = new DesignAgent();
  private scriptWriter   = new ScriptWriterAgent();
  private ffmpeg         = new FFmpegAgent();
  private branding       = new BrandingAgent();
  private music          = new MusicAgent();
  private voiceover      = new VoiceoverAgent();
  private config         = getConfig();

  async processSingleByRowIndex(
    rowIndex: number,
    templateOverride?: string,
    renderVariant?: RenderVariant,
    hookStyle?: HookStyle,
    dbJobId?: string,
    musicVibe?: string
  ): Promise<PipelineResult> {
    await this.sheets.initializeSheet();
    const all = await this.sheets.getAllContent();
    const row = all.find((r) => r.rowIndex === rowIndex);
    if (!row) throw new Error(`Row ${rowIndex} not found in sheet`);

    if (!row.script || row.script.trim().length < 10) {
      try {
        const gen = await this.scriptWriter.generateScript(
          row.topic, row.style,
          { a: row.hookA, b: row.hookB, c: row.hookC },
          hookStyle ?? "question",
          renderVariant
        );
        row.script = gen.script;
        if (!row.hookA) row.hookA = gen.hookA;
        if (!row.hookB) row.hookB = gen.hookB;
        if (!row.hookC) row.hookC = gen.hookC;
        await this.sheets.updateScript(rowIndex, row.script, row.hookA, row.hookB, row.hookC);
      } catch {
        const generated = await this.scriptWriter.fillMissingScripts([row]);
        const gen = generated.get(rowIndex);
        if (gen) {
          row.script = gen.script;
          if (!row.hookA) row.hookA = gen.hookA;
          if (!row.hookB) row.hookB = gen.hookB;
          if (!row.hookC) row.hookC = gen.hookC;
          await this.sheets.updateScript(rowIndex, row.script, row.hookA, row.hookB, row.hookC);
        }
      }
    }

    // Emit script to live log and store in DB for UI visibility
    if (row.script) {
      emitLog("Script Writer", `Script: ${row.script}`, "info");
      if (dbJobId) {
        updateJobStatus(dbJobId, "processing", { script_text: row.script }).catch(() => {});
      }
    }

    return this.processContent(row, templateOverride, musicVibe);
  }

  async processAll(): Promise<PipelineResult[]> {
    await this.sheets.initializeSheet();
    const pending = await this.sheets.getPendingContent();

    if (pending.length === 0) {
      console.log("No pending content to process.");
      return [];
    }

    console.log(`Found ${pending.length} pending item(s). Starting pipeline...`);

    // Fill missing scripts before rendering
    const missingScripts = pending.filter((r) => !r.script || r.script.trim().length < 10);
    if (missingScripts.length > 0) {
      console.log(`\nScript Writer: filling ${missingScripts.length} missing script(s)...`);
      const generated = await this.scriptWriter.fillMissingScripts(pending);
      for (const [rowIndex, gen] of generated) {
        const row = pending.find((r) => r.rowIndex === rowIndex);
        if (row) {
          row.script = gen.script;
          if (!row.hookA) row.hookA = gen.hookA;
          if (!row.hookB) row.hookB = gen.hookB;
          if (!row.hookC) row.hookC = gen.hookC;
          await this.sheets.updateScript(rowIndex, row.script, row.hookA, row.hookB, row.hookC);
        }
      }
    }

    // Pre-assign one unique random template per topic
    const ALL_TEMPLATES = ["listicle", "stats-story", "tutorial", "myth-buster", "quote-card", "cinematic"];
    const shuffled = [...ALL_TEMPLATES].sort(() => Math.random() - 0.5);
    const templateMap = new Map(pending.map((row, i) => [row.rowIndex, shuffled[i % shuffled.length]]));

    const results: PipelineResult[] = [];
    for (let i = 0; i < pending.length; i++) {
      const template = templateMap.get(pending[i].rowIndex)!;
      results.push(await this.processContent(pending[i], template));
      // Pause between items to stay within Google Sheets write quota (60 req/min)
      if (i < pending.length - 1) await new Promise((r) => setTimeout(r, 2000));
    }

    const ok   = results.filter((r) => r.success).length;
    const fail = results.filter((r) => !r.success).length;
    console.log(`\nPipeline complete: ${ok} succeeded, ${fail} failed.`);
    return results;
  }

  async processContent(row: ContentRow, templateOverride?: string, musicVibe?: string): Promise<PipelineResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const slug      = slugify(row.topic || `content-${row.rowIndex}`);

    // tempDir declared early so voiceover + render can both use it
    const tempDir = path.resolve(this.config.app.tempDir, slug);
    fs.mkdirSync(tempDir, { recursive: true });

    let result: PipelineResult;
    try {
      await this.sheets.updateStatus(row.rowIndex, "Processing");
      setStatus("running", row.topic, 5);
      const port = process.env.PORT || "3000";
      console.log(`\n[${slug}] Starting... | tempDir=${tempDir} | staticPort=${port} | ElevenLabs=${VoiceoverAgent.isAvailable()} | Pexels=${!!process.env.PEXELS_API_KEY}`);

      // Strip em-dashes and enforce human voice on pre-written scripts from the sheet
      if (row.script) row.script = sanitizeScript(row.script);
      if (row.hookA)  row.hookA  = sanitizeScript(row.hookA);
      if (row.hookB)  row.hookB  = sanitizeScript(row.hookB);
      if (row.hookC)  row.hookC  = sanitizeScript(row.hookC);

      // ── 1. Generate visual design + apply Ottoflow brand ────
      let _t = Date.now();
      setStatus("running", row.topic, 10);
      console.log(`[TRACE][${slug}] Stage 1: design started`);
      const rawDesign = await this.designAgent.generateDesign(row);
      const design    = this.branding.applyBrand(rawDesign);
      console.log(`[TRACE][${slug}] Stage 1: design done in ${Date.now()-_t}ms — theme=${design.theme} mood=${design.mood}`);

      // ── 2. Select background music ───────────────────────────
      _t = Date.now();
      setStatus("running", row.topic, 30);
      console.log(`[TRACE][${slug}] Stage 2: music started`);
      const musicTrack = await this.music.selectTrack(row, design, slug, tempDir, musicVibe);
      console.log(`[TRACE][${slug}] Stage 2: music done in ${Date.now()-_t}ms — track=${musicTrack ? `"${musicTrack.name}"` : "none"}`);

      // ── 3. Generate voiceover narration (ElevenLabs) ─────────────────
      _t = Date.now();
      setStatus("running", row.topic, 35);
      let voiceoverPath: string | undefined;
      console.log(`[TRACE][${slug}] Stage 3: voiceover started — available=${VoiceoverAgent.isAvailable()} scriptLen=${row.script?.length ?? 0}`);
      if (VoiceoverAgent.isAvailable() && row.script) {
        voiceoverPath = await this.voiceover.generate(row.script, tempDir, row.voice) ?? undefined;
      }
      console.log(`[TRACE][${slug}] Stage 3: voiceover done in ${Date.now()-_t}ms — path=${voiceoverPath ?? "skipped"}`);

      // ── 4. Fetch Pexels backgrounds ──────────────────────────────────
      _t = Date.now();
      setStatus("running", row.topic, 40);
      console.log(`[TRACE][${slug}] Stage 4: Pexels fetch started — key=${!!process.env.PEXELS_API_KEY}`);
      const backgrounds  = await this.fetchBackgrounds(row.topic, row.style, slug, [row.topic]);
      console.log(`[TRACE][${slug}] Stage 4: Pexels done in ${Date.now()-_t}ms — photos=${backgrounds.photos.length} videos=${backgrounds.videos.length}`);
      if (backgrounds.videos.length > 0) console.log(`[TRACE][${slug}] bg[0]=${backgrounds.videos[0]}`);

      // ── 5. Build video data (design tokens + Claude prompt) ────────────
      _t = Date.now();
      setStatus("running", row.topic, 50);
      console.log(`[TRACE][${slug}] Stage 5: video structure generation started`);
      const videoData = await this.promptEngine.generateFromContent(row, slug, backgrounds, "");
      console.log(`[TRACE][${slug}] Stage 5: video structure done in ${Date.now()-_t}ms`);

      // Override brand colors with Ottoflow brand (via Design Agent → BrandingAgent)
      videoData.brandColors = {
        primary:    design.brandColors.primary,
        secondary:  design.brandColors.secondary,
        accent:     design.brandColors.accent,
        background: design.brandColors.background,
        text:       design.brandColors.text,
      };

      // Apply on-brand CTA — overrides Claude's generic "Follow for daily insights"
      videoData.socialProofCta.ctaUrl = this.branding.getCta(row.style);

      // Save video data to public/ for Remotion
      const contentDir = path.resolve("public", "content", slug);
      fs.mkdirSync(contentDir, { recursive: true });
      fs.writeFileSync(
        path.join(contentDir, "video-data.json"),
        JSON.stringify(videoData, null, 2)
      );

      // ── 6. Render ────────────────────────────────────────────
      _t = Date.now();
      setStatus("running", row.topic, 60);
      await this.sheets.updateStatus(row.rowIndex, "Rendering");
      const recentTemplates = await getLastTemplatesForTopic(row.topic);
      const template = templateOverride ?? await RenderAgent.selectTemplate(row.topic, row.style, recentTemplates);
      console.log(`[TRACE][${slug}] Stage 6: Remotion render started — template=${template} outputDir=${tempDir}`);

      const renderResult = await this.renderAgent.render(slug, videoData, tempDir, template);
      if (!renderResult.success) {
        throw new Error(`Render failed: ${renderResult.error}`);
      }
      console.log(`[TRACE][${slug}] Stage 6: render done in ${Date.now()-_t}ms — size=${((renderResult.fileSizeBytes || 0) / 1024 / 1024).toFixed(1)}MB path=${renderResult.videoPath}`);

      // ── 7. FFmpeg post-process: color grade + fade + music mix ─
      _t = Date.now();
      setStatus("running", row.topic, 72);
      let finalVideoPath = renderResult.videoPath!;
      const ffAvail = FFmpegAgent.isAvailable();
      console.log(`[TRACE][${slug}] Stage 7: FFmpeg started — available=${ffAvail} voiceover=${!!voiceoverPath} music=${!!musicTrack?.localPath}`);
      if (ffAvail && renderResult.videoPath) {
        const ffResult = await this.ffmpeg.postProcess(renderResult.videoPath, design.theme, {
          voiceoverPath: voiceoverPath,
          musicPath:     musicTrack?.localPath,
        });
        if (ffResult.success) {
          finalVideoPath = ffResult.outputPath;
          console.log(`[TRACE][${slug}] Stage 7: FFmpeg done in ${Date.now()-_t}ms — ${((ffResult.fileSizeBytes || 0) / 1024 / 1024).toFixed(1)}MB`);
        } else {
          console.warn(`[TRACE][${slug}] Stage 7: FFmpeg FAILED in ${Date.now()-_t}ms — ${ffResult.error} — falling back to raw render`);
        }
      }

      // ── 9. Export + SEO + deliver to Telegram ────────────────
      setStatus("running", row.topic, 82);
      await this.sheets.updateStatus(row.rowIndex, "Exporting");
      console.log(`[${slug}] Delivering to Telegram...`);

      // Save locally first
      const outputDir  = path.resolve(this.config.app.outputDir, slug);
      fs.mkdirSync(outputDir, { recursive: true });
      const finalVideo = path.join(outputDir, `${slug}.mp4`);
      fs.copyFileSync(finalVideoPath, finalVideo);

      // Upload to Google Drive for cloud access
      const driveLink = await uploadVideoToDrive(finalVideo, `${slug}.mp4`).catch((err) => {
        console.warn(`[${slug}] Drive upload failed:`, err instanceof Error ? err.message : err);
        return null;
      });
      if (driveLink) console.log(`[${slug}] Uploaded to Drive: ${driveLink}`);

      // ── SEO metadata (rule-based, no API key required) ───────
      console.log(`[${slug}] Generating SEO metadata...`);
      const seo = this.seoGenerator.generateAndSave(
        row.topic, row.style,
        { a: row.hookA, b: row.hookB, c: row.hookC },
        outputDir
      );
      console.log(`[${slug}] SEO: "${seo.title}" — ${seo.hashtags.length} hashtags`);

      // Build Ottoflow-branded hashtags for Telegram delivery
      const hashtags = this.branding.getHashtags(row, seo.hashtags);

      // Compress for Telegram delivery if file exceeds 45 MB (bot limit is 50 MB)
      let deliveryPath = finalVideo;
      const finalStats = fs.statSync(finalVideo);
      if (finalStats.size > 45 * 1024 * 1024 && FFmpegAgent.isAvailable()) {
        console.log(`[${slug}] Re-compressing for Telegram (${(finalStats.size / 1024 / 1024).toFixed(1)} MB > 45 MB)...`);
        const tgResult = await this.ffmpeg.postProcess(finalVideo, "minimal", {
          fadeIn: 0, fadeOut: 0, crf: 33, suffix: "-tg",
        });
        if (tgResult.success) {
          deliveryPath = tgResult.outputPath;
          console.log(`[${slug}] Telegram copy: ${((fs.statSync(deliveryPath).size) / 1024 / 1024).toFixed(1)} MB`);
        }
      }

      // ── 9. Deliver to Telegram ────────────────────────────────
      setStatus("running", row.topic, 92);
      await this.approvalBot.deliverVideo(
        deliveryPath,
        row.topic,
        { a: row.hookA, b: row.hookB, c: row.hookC },
        hashtags,
        slug
      );

      // Remove temp delivery copy if it was created separately
      if (deliveryPath !== finalVideo && fs.existsSync(deliveryPath)) {
        fs.unlinkSync(deliveryPath);
      }

      const outputLink = driveLink ?? `outputs/${slug}/${slug}.mp4`;

      // Mark sheet complete + all platforms ready
      await this.sheets.markComplete(row.rowIndex, outputLink);
      await Promise.all([
        this.sheets.updatePlatform(row.rowIndex, "tiktok",    "Uploaded"),
        this.sheets.updatePlatform(row.rowIndex, "youtube",   "Uploaded"),
        this.sheets.updatePlatform(row.rowIndex, "instagram", "Uploaded"),
        this.sheets.updatePlatform(row.rowIndex, "facebook",  "Uploaded"),
      ]);

      console.log(`[${slug}] Delivered to Telegram! Local copy → ${outputLink}`);
      setStatus("done", row.topic, 100);
      result = this.result(row.topic, slug, true, undefined, startedAt, startTime, outputLink, outputDir);

    } catch (err) {
      const msg   = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? (err.stack ?? "") : "";
      await this.sheets.updateStatus(row.rowIndex, "Error", msg);
      console.error(`[${slug}] FAILED at ${Date.now() - startTime}ms: ${msg}`);
      if (stack) console.error(`[${slug}] Stack: ${stack}`);
      result = this.result(row.topic, slug, false, msg, startedAt, startTime);
    } finally {
      // Clean up tempDir + public/content/{slug}/ — Pexels backgrounds (50-200MB each) accumulate fast
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* non-fatal */ }
      const publicSlugDir = path.resolve("public", "content", slug);
      try { fs.rmSync(publicSlugDir, { recursive: true, force: true }); } catch { /* non-fatal */ }
    }
    return result;
  }

  // === Fetch Pexels backgrounds based on topic + style ===

  // Remotion's bundle copies publicDir at build time, so relative paths break for
  // files downloaded after bundling. Using absolute localhost URLs lets Chrome fetch
  // directly from the running Next.js server, bypassing the stale bundle copy.
  private bgUrl(rel: string): string {
    // Must match the port the static file server is actually listening on.
    // render-worker.ts binds to process.env.PORT || "3000"; hardcoding 3000
    // breaks background fetches on Railway where PORT is often 8080.
    const port = process.env.PORT || "3000";
    return `http://localhost:${port}/${rel}`;
  }

  private async fetchBackgrounds(
    topic: string,
    style: string,
    slug: string,
    videoQueries: string[] = []
  ): Promise<{ photos: string[]; videos: string[] }> {
    // Always check for existing cached backgrounds first
    const existing = this.scanExistingBackgrounds(slug);

    if (!process.env.PEXELS_API_KEY) {
      if (existing.videos.length > 0 || existing.photos.length > 0) {
        console.log(`[${slug}] Reusing ${existing.videos.length} cached video(s) + ${existing.photos.length} photo(s)`);
        return existing;
      }
      console.log(`[${slug}] Skipping Pexels (no API key, no cache)`);
      return { photos: [], videos: [] };
    }

    try {
      const pexels     = new PexelsClient();
      const bgStyle    = this.styleToBackground(style);
      const result     = await pexels.fetchProductBackgrounds(topic, slug, {
        photoCount:   6,
        videoCount:   6,
        style:        bgStyle,
        videoQueries: videoQueries.length > 0 ? videoQueries : undefined,
      });

      return {
        photos: result.photos.map((p) =>
          this.bgUrl(path.relative(path.resolve("public"), p).replace(/\\/g, "/"))
        ),
        videos: result.videos.map((v) =>
          this.bgUrl(path.relative(path.resolve("public"), v).replace(/\\/g, "/"))
        ),
      };
    } catch (err) {
      console.warn(`Pexels fetch failed:`, err instanceof Error ? err.message : err);
      // Fall back to cached backgrounds on API error
      if (existing.videos.length > 0 || existing.photos.length > 0) {
        console.log(`[${slug}] Falling back to ${existing.videos.length} cached video(s)`);
        return existing;
      }
      return { photos: [], videos: [] };
    }
  }

  /** Scan public/content/{slug}/backgrounds/ and return absolute localhost URLs */
  private scanExistingBackgrounds(slug: string): { photos: string[]; videos: string[] } {
    const bgDir = path.resolve("public", "content", slug, "backgrounds");
    if (!fs.existsSync(bgDir)) return { photos: [], videos: [] };

    const files = fs.readdirSync(bgDir);
    const photos: string[] = [];
    const videos: string[] = [];

    for (const f of files) {
      const url = this.bgUrl(`content/${slug}/backgrounds/${f}`);
      const lower = f.toLowerCase();
      if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) {
        videos.push(url);
      } else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") || lower.endsWith(".webp")) {
        photos.push(url);
      }
    }

    return { photos, videos };
  }

  // === Map content style to Pexels background style ===

  private styleToBackground(style: string): "dark" | "light" | "abstract" | "lifestyle" {
    const s = style.toLowerCase();
    if (s.includes("lifestyle") || s.includes("startup")) return "lifestyle";
    if (s.includes("luxury"))                               return "light";
    if (s.includes("motivational") || s.includes("bold"))  return "abstract";
    return "dark";
  }

  // === Helpers ===


  private result(
    topic: string, slug: string, success: boolean,
    error: string | undefined, startedAt: string, startTime: number,
    outputLink?: string, outputDir?: string
  ): PipelineResult {
    return {
      topic, slug, success, error, outputLink, outputDir,
      timing: {
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs:  Date.now() - startTime,
      },
    };
  }
}
