/**
 * PIPELINE ORCHESTRATOR V2 — 20s short-form video factory (Advanced tier)
 *
 * Flow:
 *  1. Fetch row from Sheet2
 *  2. Generate/sanitize script (ScriptWriter — ~32 words, 12s spoken)
 *  3. ElevenLabs voiceover → temp/{slug}/voiceover.mp3
 *  4. ImagePromptAgent → 3 scene visual prompts + 3-word captions (Claude Haiku)
 *  5. VeoAgent → Google Veo 2 text-to-video clips (official API, primary)
 *     └─ Imagen3Agent → static portrait images (fallback)
 *  6. MusicAgent → Pixabay background track
 *  7. RenderAgent → v2-ugc Remotion (20s, 600f, clips loop via <Video loop>)
 *  8. FFmpegAgent → mix voiceover + music
 *  9. Telegram → [✅ Approve] [❌ Reject] [🔄 Retry]
 * 10. On approve → Postgres done + Sheet2 Done
 */

import * as path from "path";
import * as fs   from "fs";
import { SheetsClient }        from "../sheets/client";
import { RenderAgent }         from "../render/render-agent";
import { TelegramApprovalBot } from "../approval/telegram-bot";
import { SeoGenerator }        from "../seo/seo-generator";
import { ScriptWriterAgent, sanitizeScript } from "../scriptwriter/scriptwriter-agent";
import { FFmpegAgent }         from "../ffmpeg/ffmpeg-agent";
import { MusicAgent }          from "../music/music-agent";
import { VoiceoverAgent }      from "../voiceover/voiceover-agent";
import { ImagePromptAgent }    from "../image-prompt/image-prompt-agent";
import { Imagen3Agent }        from "../imagen/imagen-agent";
import { VeoAgent }            from "../veo/veo-agent";
import { LipsyncAgent }        from "../lipsync/lipsync-agent";
import { PexelsClient }        from "../pexels/pexels-client";
import { getConfig }           from "../config/config";
import { slugify }             from "../../lib/slug-utils";
import { setStatus, emitLog }  from "../../lib/pipeline-store";
import { uploadVideoToDrive }  from "../../lib/google-drive";
import { updateJobStatus }     from "../../lib/db";
import type { PipelineResult } from "./orchestrator";
import type { V2UGCData }      from "../../remotion/v2-ugc/types";
import type { DesignSpec }     from "../design/design-agent";

const SHEET_NAME = "Sheet2";

// Generates a ~32-word script from a topic without any AI API.
// Used when ScriptWriter fails (no ANTHROPIC_API_KEY) and no script is in the sheet.
// Targets 12s spoken at ~160 wpm inside a 20s video.
function templateScript(topic: string): string {
  const t = topic.trim();
  return `Most people get ${t} wrong. Here's the real secret. It's simpler than you think. Try this today.`;
}

export class PipelineOrchestratorV2 {
  private sheets       = new SheetsClient(SHEET_NAME);
  private renderAgent  = new RenderAgent();
  private approvalBot  = new TelegramApprovalBot();
  private seoGen       = new SeoGenerator();
  private scriptWriter = new ScriptWriterAgent();
  private ffmpeg       = new FFmpegAgent();
  private music        = new MusicAgent();
  private voiceover    = new VoiceoverAgent();
  private imagePrompt  = new ImagePromptAgent();
  private imagen3      = new Imagen3Agent();
  private veo          = new VeoAgent();
  private lipsync      = new LipsyncAgent();
  private pexels       = new PexelsClient();
  private config       = getConfig();

  async processSingleByRowIndex(rowIndex: number): Promise<PipelineResult> {
    await this.sheets.initializeSheet();
    const all = await this.sheets.getAllContent();
    const row = all.find((r) => r.rowIndex === rowIndex);
    if (!row) throw new Error(`V2 Row ${rowIndex} not found in ${SHEET_NAME}`);

    // Fill script if missing — try ScriptWriter (Anthropic), fall back to template
    if (!row.script || row.script.trim().length < 10) {
      const generated = await this.scriptWriter.fillMissingScripts([row]);
      const gen = generated.get(rowIndex);
      if (gen) {
        row.script = gen.script;
        row.hookA  = row.hookA || gen.hookA;
        row.hookB  = row.hookB || gen.hookB;
        row.hookC  = row.hookC || gen.hookC;
        await this.sheets.updateScript(rowIndex, row.script, row.hookA, row.hookB, row.hookC);
      } else if (!row.script || row.script.trim().length < 10) {
        row.script = templateScript(row.topic);
        console.log("[v2] Using template script (no ANTHROPIC_API_KEY)");
      }
    }

    row.script = sanitizeScript(row.script);
    row.hookA  = sanitizeScript(row.hookA);
    row.hookB  = sanitizeScript(row.hookB);
    row.hookC  = sanitizeScript(row.hookC);

    const slug      = slugify(row.topic || `content-${rowIndex}`);
    const tempDir   = path.resolve(this.config.app.tempDir, slug);
    const outDir    = path.resolve(this.config.app.outputDir, slug);
    const startedAt = new Date().toISOString();

    fs.mkdirSync(tempDir, { recursive: true });
    fs.mkdirSync(outDir,  { recursive: true });

    try {
      await this.sheets.updateStatus(rowIndex, "Processing");
      setStatus("running", row.topic, 5);

      emitLog("V2-Orchestrator", "Generating voiceover...", "info");
      const voicePath = await this.voiceover.generate(row.script, tempDir, row.voice) ?? undefined;
      if (voicePath) emitLog("V2-Orchestrator", "Voiceover ready", "success");
      setStatus("running", row.topic, 20);

      // public/content/{slug}/ — shared by voiceover + scene images (Remotion needs HTTP access)
      const publicContent = path.resolve("public", "content", slug);
      fs.mkdirSync(publicContent, { recursive: true });

      if (voicePath) {
        try {
          fs.copyFileSync(voicePath, path.join(publicContent, "voiceover.mp3"));
        } catch { /* voiceover file unavailable */ }
      }

      emitLog("V2-Orchestrator", "Generating scene prompts...", "info");
      const scenePrompts = await this.imagePrompt.generateScenePrompts(row.topic, row.script, row.style);
      setStatus("running", row.topic, 35);

      // ── Tier 1: VeoAgent — Google Veo 2 text-to-video (official API, GOOGLE_API_KEY) ──
      const clipUrlMap: Record<string, string> = {};
      const sceneMap:   Record<string, { url: string; tempPath: string }> = {};
      const sceneTextPrompts = {
        hook:    scenePrompts.hook.imagePrompt,
        insight: scenePrompts.insight.imagePrompt,
        cta:     scenePrompts.cta.imagePrompt,
      };

      if (VeoAgent.isAvailable()) {
        emitLog("V2-Orchestrator", "Generating clips via Google Veo 2 (official API)...", "info");
        try {
          const veoClips = await this.veo.generateScenesFromText(sceneTextPrompts, slug, tempDir);
          for (const clip of veoClips) {
            const destFile = `clip-${clip.beat}.mp4`;
            fs.copyFileSync(clip.clipPath, path.join(publicContent, destFile));
            clipUrlMap[clip.beat] = `/content/${slug}/${destFile}`;
          }
          emitLog("V2-Orchestrator", `Veo: ${veoClips.length}/3 clips`, veoClips.length === 3 ? "success" : "warning");
        } catch (err) {
          emitLog("V2-Orchestrator", `Veo failed: ${err instanceof Error ? err.message : err} — using Imagen 3 fallback`, "warning");
        }
      }

      // ── Tier 2: Imagen 3 static images — fallback for any missing beats ──
      const stillMissing = (["hook", "insight", "cta"] as const).filter(b => !clipUrlMap[b]);
      if (stillMissing.length > 0) {
        emitLog("V2-Orchestrator", `Imagen 3 fallback for: ${stillMissing.join(", ")}`, "info");
        const sceneImages = await this.imagen3.generateSceneImages(
          { hook: sceneTextPrompts.hook, insight: sceneTextPrompts.insight, cta: sceneTextPrompts.cta },
          slug, tempDir
        ).catch(() => []);

        for (const si of sceneImages) {
          if (clipUrlMap[si.beat]) continue;
          const destFile = `scene-${si.beat}.jpg`;
          try { fs.copyFileSync(si.imagePath, path.join(publicContent, destFile)); } catch { /* skip */ }
          sceneMap[si.beat] = { url: `/content/${slug}/${destFile}`, tempPath: si.imagePath };
        }
        if (sceneImages.length > 0) emitLog("V2-Orchestrator", `Imagen 3: ${sceneImages.length} static fallbacks`, "info");
      }

      setStatus("running", row.topic, 50);

      // D-ID lipsync: talking head for insight scene — only when avatar URL is explicitly set in sheet
      if (LipsyncAgent.isAvailable() && voicePath && !clipUrlMap["insight"] && row.avatarUrl?.trim()) {
        emitLog("V2-Orchestrator", "Downloading avatar for D-ID lipsync...", "info");
        try {
          const avatarDest = path.join(tempDir, "avatar.jpg");
          await this.pexels.downloadUrl(row.avatarUrl.trim(), avatarDest);
          if (fs.existsSync(avatarDest)) {
            const lipsyncClip = await this.lipsync.generateTalkingHead(avatarDest, voicePath, tempDir);
            if (lipsyncClip) {
              const destFile = "lipsync-insight.mp4";
              try { fs.copyFileSync(lipsyncClip, path.join(publicContent, destFile)); } catch { /* ignore */ }
              clipUrlMap["insight"] = `/content/${slug}/${destFile}`;
              emitLog("V2-Orchestrator", "Talking head ready for insight scene", "success");
            }
          }
        } catch (err) {
          console.warn("[v2] Lipsync failed:", err instanceof Error ? err.message : err);
        }
      }
      setStatus("running", row.topic, 62);

      emitLog("V2-Orchestrator", "Selecting background music...", "info");
      const designStub: DesignSpec = {
        theme: "minimal", mood: "professional", overlayStyle: "gradient", overlayOpacity: 0.5,
        fontWeight: "bold", textEffect: "shadow", rationale: "V2 default",
        brandColors: { primary: "#ffffff", secondary: "#cccccc", accent: "#FFE500", background: "#000000", text: "#ffffff" },
      };
      const musicTrack = await this.music.selectTrack(row, designStub, slug, tempDir).catch(() => null);
      setStatus("running", row.topic, 62);

      const voiceoverUrl = voicePath ? `/content/${slug}/voiceover.mp3` : undefined;

      const videoData: V2UGCData = {
        topic: row.topic,
        scenes: {
          hook:    { imagePath: sceneMap["hook"]?.url    || "", videoClipPath: clipUrlMap["hook"],    caption: scenePrompts.hook.caption,    keyWord: scenePrompts.hook.keyWord    },
          insight: { imagePath: sceneMap["insight"]?.url || "", videoClipPath: clipUrlMap["insight"], caption: scenePrompts.insight.caption, keyWord: scenePrompts.insight.keyWord },
          cta:     { imagePath: sceneMap["cta"]?.url     || "", videoClipPath: clipUrlMap["cta"],     caption: scenePrompts.cta.caption,     keyWord: scenePrompts.cta.keyWord     },
        },
        voiceoverUrl,
      };

      emitLog("V2-Orchestrator", "Rendering V2 composition...", "info");
      await this.sheets.updateStatus(rowIndex, "Rendering");
      setStatus("running", row.topic, 65);

      const renderResult = await this.renderAgent.render(slug, videoData, tempDir, "v2-ugc");
      if (!renderResult.success || !renderResult.videoPath) {
        throw new Error(renderResult.error || "Render failed");
      }
      emitLog("V2-Orchestrator", `Rendered — ${((renderResult.fileSizeBytes || 0) / 1024 / 1024).toFixed(1)}MB`, "success");
      setStatus("running", row.topic, 78);

      const audioLabel = voicePath
        ? `voiceover${musicTrack ? ` + music "${musicTrack.name}"` : ""}`
        : musicTrack ? `music "${musicTrack.name}"` : "no audio";
      emitLog("V2-Orchestrator", `FFmpeg post-processing (minimal grade, ${audioLabel})...`, "info");

      const ffResult = await this.ffmpeg.postProcess(renderResult.videoPath, "minimal", {
        voiceoverPath: voicePath,
        musicPath:     musicTrack?.localPath,
      });

      let finalVideoPath = renderResult.videoPath;
      if (ffResult.success) {
        finalVideoPath = ffResult.outputPath;
        emitLog("V2-Orchestrator", `FFmpeg done — ${((ffResult.fileSizeBytes || 0) / 1024 / 1024).toFixed(1)}MB`, "success");
      }

      const finalVideo = path.join(outDir, `${slug}.mp4`);
      fs.copyFileSync(finalVideoPath, finalVideo);

      // Upload to Google Drive for cloud access (Vercel + Telegram)
      const driveLink = await uploadVideoToDrive(finalVideo, `${slug}.mp4`).catch((err) => {
        emitLog("V2-Orchestrator", `Drive upload failed: ${err instanceof Error ? err.message : err}`, "warning");
        return null;
      });
      if (driveLink) emitLog("V2-Orchestrator", `Uploaded to Drive: ${driveLink}`, "success");

      setStatus("running", row.topic, 85);

      emitLog("V2-Orchestrator", "Generating SEO...", "info");
      await this.sheets.updateStatus(rowIndex, "Exporting");
      this.seoGen.generateAndSave(row.topic, row.style, { a: row.hookA, b: row.hookB, c: row.hookC }, outDir);
      setStatus("running", row.topic, 90);

      emitLog("V2-Orchestrator", "Sending to Telegram for approval...", "info");
      const approval = await this.approvalBot.sendVideoForApproval(finalVideo, row.topic, slug);

      if (approval.decision === "approved") {
        await this.sheets.markComplete(rowIndex, finalVideo);
        setStatus("done", row.topic, 100);
        emitLog("V2-Orchestrator", `Approved and saved: ${row.topic}`, "success");
      } else if (approval.decision === "rejected") {
        await this.sheets.updateStatus(rowIndex, "Rejected");
        setStatus("error");
        emitLog("V2-Orchestrator", `Rejected: ${row.topic}`, "warning");
      } else {
        await this.sheets.updateStatus(rowIndex, "Approval");
        emitLog("V2-Orchestrator", `Approval timed out: ${row.topic} — review manually`, "warning");
      }

      return {
        topic:      row.topic,
        slug,
        success:    approval.decision === "approved",
        outputDir:  outDir,
        outputLink: driveLink ?? finalVideo,
        timing: {
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(startedAt).getTime(),
        },
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await this.sheets.updateStatus(rowIndex, "Error", message);
      setStatus("error");
      emitLog("V2-Orchestrator", `Fatal: ${message}`, "error");
      return {
        topic:   row.topic,
        slug,
        success: false,
        error:   message,
        timing: {
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(startedAt).getTime(),
        },
      };
    }
  }
}
