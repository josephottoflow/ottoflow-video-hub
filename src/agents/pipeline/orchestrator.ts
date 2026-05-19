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
import { StoryboardAgent } from "../storyboard/storyboard-agent";
import { FFmpegAgent } from "../ffmpeg/ffmpeg-agent";
import { BrandingAgent } from "../branding/branding-agent";
import { MusicAgent } from "../music/music-agent";
import { VoiceoverAgent } from "../voiceover/voiceover-agent";
import { getConfig } from "../config/config";
import { setStatus } from "../../lib/pipeline-store";
import { getLastTemplatesForTopic } from "../../lib/db";
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
  private storyboard     = new StoryboardAgent();
  private ffmpeg         = new FFmpegAgent();
  private branding       = new BrandingAgent();
  private music          = new MusicAgent();
  private voiceover      = new VoiceoverAgent();
  private config         = getConfig();

  async processSingleByRowIndex(
    rowIndex: number,
    templateOverride?: string,
    renderVariant?: RenderVariant,
    hookStyle?: HookStyle
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

    return this.processContent(row, templateOverride);
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

  async processContent(row: ContentRow, templateOverride?: string): Promise<PipelineResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const slug      = slugify(row.topic || `content-${row.rowIndex}`);

    // tempDir declared early so voiceover + render can both use it
    const tempDir = path.resolve(this.config.app.tempDir, slug);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      await this.sheets.updateStatus(row.rowIndex, "Processing");
      setStatus("running", row.topic, 5);
      console.log(`\n[${slug}] Starting...`);

      // Strip em-dashes and enforce human voice on pre-written scripts from the sheet
      if (row.script) row.script = sanitizeScript(row.script);
      if (row.hookA)  row.hookA  = sanitizeScript(row.hookA);
      if (row.hookB)  row.hookB  = sanitizeScript(row.hookB);
      if (row.hookC)  row.hookC  = sanitizeScript(row.hookC);

      // ── 1. Generate visual design + apply Ottoflow brand ────
      setStatus("running", row.topic, 10);
      console.log(`[${slug}] Generating design spec...`);
      const rawDesign = await this.designAgent.generateDesign(row);
      const design    = this.branding.applyBrand(rawDesign);
      console.log(`[${slug}] Design: ${design.theme} theme / ${design.mood} mood — ${design.rationale}`);
      console.log(`[${slug}] Branding: Ottoflow palette applied — ${design.brandColors.primary} / CTA: "${this.branding.getCta(row.style)}"`);

      // ── 2. Generate storyboard (shot plan + visual consistency) ─
      setStatus("running", row.topic, 20);
      console.log(`[${slug}] Generating storyboard...`);
      const storyboard = await this.storyboard.generate(row, design);
      console.log(`[${slug}] Storyboard: ${storyboard.narrativeArc}`);

      // ── 3. Select background music ───────────────────────────
      setStatus("running", row.topic, 30);
      console.log(`[${slug}] Selecting background music...`);
      const musicTrack = await this.music.selectTrack(row, design, slug, tempDir);
      if (musicTrack) {
        console.log(`[${slug}] Music: "${musicTrack.name}" by ${musicTrack.artist} (${musicTrack.duration}s)`);
      }

      // ── 4. Generate voiceover narration (ElevenLabs) ─────────────────
      setStatus("running", row.topic, 35);
      let voiceoverPath: string | undefined;
      if (VoiceoverAgent.isAvailable() && row.script) {
        console.log(`[${slug}] Generating voiceover narration...`);
        voiceoverPath = await this.voiceover.generate(row.script, tempDir, row.voice) ?? undefined;
        if (voiceoverPath) console.log(`[${slug}] Voiceover ready`);
      }

      // ── 5. Fetch Pexels backgrounds (guided by storyboard queries) ─
      setStatus("running", row.topic, 40);
      const pexelsQueries = this.storyboard.getPexelsQueries(storyboard);
      const primaryQuery  = pexelsQueries[0] || row.topic;
      const backgrounds   = await this.fetchBackgrounds(primaryQuery, row.style, slug, pexelsQueries);
      console.log(`[${slug}] Backgrounds: ${backgrounds.photos.length} photos, ${backgrounds.videos.length} videos`);

      // ── 6. Build video data (storyboard + design tokens) ─────
      setStatus("running", row.topic, 50);
      console.log(`[${slug}] Generating video structure with Claude...`);
      const storyboardContext = this.storyboard.toPromptContext(storyboard);
      const videoData = await this.promptEngine.generateFromContent(row, slug, backgrounds, storyboardContext);

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

      // ── 7. Render ────────────────────────────────────────────
      setStatus("running", row.topic, 60);
      await this.sheets.updateStatus(row.rowIndex, "Rendering");
      const recentTemplates = await getLastTemplatesForTopic(row.topic);
      const template = templateOverride ?? await RenderAgent.selectTemplate(row.topic, row.style, recentTemplates);
      console.log(`[${slug}] Rendering video (template: ${template})...`);

      const renderResult = await this.renderAgent.render(slug, videoData, tempDir, template);
      if (!renderResult.success) {
        throw new Error(`Render failed: ${renderResult.error}`);
      }
      console.log(`[${slug}] Rendered in ${Math.round((renderResult.durationMs || 0) / 1000)}s`);

      // ── 8. FFmpeg post-process: color grade + fade + music mix ─
      setStatus("running", row.topic, 72);
      let finalVideoPath = renderResult.videoPath!;
      if (FFmpegAgent.isAvailable() && renderResult.videoPath) {
        const audioLabel = voiceoverPath
          ? `voiceover${musicTrack ? ` + music "${musicTrack.name}"` : ""}`
          : musicTrack ? `music "${musicTrack.name}"` : "no audio";
        console.log(`[${slug}] FFmpeg post-processing (${design.theme} grade, ${audioLabel})...`);
        const ffResult = await this.ffmpeg.postProcess(renderResult.videoPath, design.theme, {
          voiceoverPath: voiceoverPath,
          musicPath:     musicTrack?.localPath,
        });
        if (ffResult.success) {
          finalVideoPath = ffResult.outputPath;
          console.log(`[${slug}] FFmpeg done — ${((ffResult.fileSizeBytes || 0) / 1024 / 1024).toFixed(1)}MB`);
        } else {
          console.warn(`[${slug}] FFmpeg failed (${ffResult.error}), using raw render`);
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
      return this.result(row.topic, slug, true, undefined, startedAt, startTime, outputLink, outputDir);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await this.sheets.updateStatus(row.rowIndex, "Error", msg);
      console.error(`[${slug}] Failed: ${msg}`);
      return this.result(row.topic, slug, false, msg, startedAt, startTime);
    }
  }

  // === Fetch Pexels backgrounds based on topic + style ===

  // Remotion's bundle copies publicDir at build time, so relative paths break for
  // files downloaded after bundling. Using absolute localhost URLs lets Chrome fetch
  // directly from the running Next.js server, bypassing the stale bundle copy.
  private bgUrl(rel: string): string {
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
