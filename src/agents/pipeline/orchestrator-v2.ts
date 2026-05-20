/**
 * PIPELINE ORCHESTRATOR V2 — Dynamic AI Storyboard Video Factory (Advanced tier)
 *
 * Flow:
 *  1. Fetch row from "Video Gen" sheet
 *  2. StoryboardAgent (Gemini) → full JSON storyboard (3-5 scenes, dynamic pacing)
 *  3. ElevenLabs → voiceover from storyboard.fullScript
 *  4. VeoAgent → one clip per storyboard scene from scene.visualPrompt
 *     └─ Imagen3Agent → static image fallback per scene
 *  5. MusicAgent → Pixabay track (mood from storyboard.musicMood)
 *  6. RenderAgent → v2-ugc Remotion with storyboard data (dynamic duration)
 *  7. FFmpegAgent → post-process grade + audio mix
 *  8. Telegram → [✅ Approve] [❌ Reject] [🔄 Retry]
 *  9. On approve → Postgres done + Video Gen Done
 */

import * as path from "path";
import * as fs   from "fs";
import { SheetsClient }        from "../sheets/client";
import { RenderAgent }         from "../render/render-agent";
import { TelegramApprovalBot } from "../approval/telegram-bot";
import { SeoGenerator }        from "../seo/seo-generator";
import { ScriptWriterAgent, sanitizeScript } from "../scriptwriter/scriptwriter-agent";
import type { HookStyle, RenderVariant } from "../scriptwriter/scriptwriter-agent";
import { StoryboardAgent }     from "../storyboard/storyboard-agent";
import type { Storyboard }    from "../storyboard/storyboard-agent";
import { FFmpegAgent }         from "../ffmpeg/ffmpeg-agent";
import { MusicAgent }          from "../music/music-agent";
import { VoiceoverAgent }      from "../voiceover/voiceover-agent";
import { Imagen3Agent }        from "../imagen/imagen-agent";
import { VeoAgent }            from "../veo/veo-agent";
import { LipsyncAgent }        from "../lipsync/lipsync-agent";
import { getConfig }           from "../config/config";
import { slugify }             from "../../lib/slug-utils";
import { setStatus, emitLog }  from "../../lib/pipeline-store";
import { uploadVideoToDrive }  from "../../lib/google-drive";
import { updateJobStatus }     from "../../lib/db";
import type { PipelineResult } from "./orchestrator";
import type { V2UGCData }      from "../../remotion/v2-ugc/types";
import type { DesignSpec }     from "../design/design-agent";

// Veo can only generate 4-8s clips; clamp scene duration to valid range
function clampVeoDuration(seconds: number): number {
  return Math.max(4, Math.min(8, seconds));
}

const SHEET_NAME = "Video Gen";

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
  private storyboard   = new StoryboardAgent();
  private ffmpeg       = new FFmpegAgent();
  private music        = new MusicAgent();
  private voiceover    = new VoiceoverAgent();
  private imagen3      = new Imagen3Agent();
  private veo          = new VeoAgent();
  private lipsync      = new LipsyncAgent();
  private config       = getConfig();

  async processSingleByRowIndex(
    rowIndex:      number,
    renderVariant?: RenderVariant,
    hookStyle?:     HookStyle,
    dbJobId?:       string
  ): Promise<PipelineResult> {
    await this.sheets.initializeSheet();
    const all = await this.sheets.getAllContent();
    const row = all.find((r) => r.rowIndex === rowIndex);
    if (!row) throw new Error(`V2 Row ${rowIndex} not found in ${SHEET_NAME}`);

    // Fill script if missing — try ScriptWriter with variant, fall back to template
    if (!row.script || row.script.trim().length < 10) {
      try {
        const gen = await this.scriptWriter.generateScript(
          row.topic, row.style,
          { a: row.hookA, b: row.hookB, c: row.hookC },
          hookStyle ?? "question",
          renderVariant
        );
        row.script = gen.script;
        row.hookA  = row.hookA || gen.hookA;
        row.hookB  = row.hookB || gen.hookB;
        row.hookC  = row.hookC || gen.hookC;
        await this.sheets.updateScript(rowIndex, row.script, row.hookA, row.hookB, row.hookC);
        console.log(`[v2] Script generated — variant: ${renderVariant ?? "default"}, hook: ${hookStyle ?? "question"}`);
      } catch (err) {
        if (!row.script || row.script.trim().length < 10) {
          row.script = templateScript(row.topic);
          console.log("[v2] Using template script (ScriptWriter unavailable)");
        }
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

      // ── Step 1: Generate dynamic storyboard (Gemini creative director) ──────
      emitLog("V2-Orchestrator", `Building storyboard (variant: ${renderVariant ?? "problem-first"}, hook: ${hookStyle ?? "shock"})...`, "agent");
      const sb: Storyboard = await this.storyboard.generate(
        row.topic, row.style,
        renderVariant ?? "problem-first",
        hookStyle     ?? "shock"
      );
      emitLog("V2-Orchestrator", `Storyboard: ${sb.scenes.length} scenes, ${(sb.totalFrames / 30).toFixed(1)}s, style=${sb.visualStyle}`, "success");
      setStatus("running", row.topic, 15);

      // Write script back to sheet for record-keeping
      const sheetScript = sb.fullScript;
      const hookLines   = sb.scenes.filter(s => s.beat === "hook").map(s => s.caption);
      await this.sheets.updateScript(rowIndex, sheetScript, hookLines[0] ?? "", hookLines[1] ?? "", hookLines[2] ?? "")
        .catch(() => {}); // non-fatal

      // ── Step 2: ElevenLabs voiceover from fullScript ──────────────────────
      const publicContent = path.resolve("public", "content", slug);
      fs.mkdirSync(publicContent, { recursive: true });

      emitLog("V2-Orchestrator", "Generating voiceover...", "info");
      const voicePath = await this.voiceover.generate(sb.fullScript, tempDir, row.voice) ?? undefined;
      if (voicePath) {
        emitLog("V2-Orchestrator", "Voiceover ready", "success");
        try { fs.copyFileSync(voicePath, path.join(publicContent, "voiceover.mp3")); } catch { /* skip */ }
      } else {
        emitLog("V2-Orchestrator", "⚠️ Voiceover skipped — check ELEVENLABS_API_KEY. Video will be silent.", "warning");
      }
      setStatus("running", row.topic, 28);

      // ── Step 3: Veo clips — one per storyboard scene ──────────────────────
      const clipUrlMap: Record<string, string> = {};
      const imageUrlMap: Record<string, string> = {};

      if (VeoAgent.isAvailable()) {
        emitLog("V2-Orchestrator", `Generating ${sb.scenes.length} Veo clips...`, "info");
        await Promise.all(sb.scenes.map(async (scene, i) => {
          const outFile = `clip-${scene.id}.mp4`;
          const outPath = path.join(tempDir, outFile);
          const veoDur  = clampVeoDuration(scene.seconds);
          const clipPath = await this.veo.generateSingleClip(scene.visualPrompt, outPath, veoDur);
          if (clipPath) {
            try { fs.copyFileSync(clipPath, path.join(publicContent, outFile)); } catch { /* skip */ }
            clipUrlMap[scene.id] = `/content/${slug}/${outFile}`;
            emitLog("V2-Orchestrator", `Veo clip ${i + 1}/${sb.scenes.length} — ${scene.beat} (${veoDur}s)`, "success");
          } else {
            emitLog("V2-Orchestrator", `Veo scene ${scene.id} failed — will use Imagen3`, "warning");
          }
        }));
      }

      // ── Step 4: Imagen3 static fallback for scenes missing a clip ─────────
      const missingScenes = sb.scenes.filter(s => !clipUrlMap[s.id]);
      if (missingScenes.length > 0) {
        emitLog("V2-Orchestrator", `Imagen3 fallback for ${missingScenes.length} scene(s)...`, "info");
        await Promise.all(missingScenes.map(async (scene) => {
          try {
            const destFile = `scene-${scene.id}.jpg`;
            const outPath  = path.join(tempDir, destFile);
            const imgPath  = await this.imagen3.generateSingleImage(scene.visualPrompt, outPath);
            if (imgPath) {
              try { fs.copyFileSync(imgPath, path.join(publicContent, destFile)); } catch { /* skip */ }
              imageUrlMap[scene.id] = `/content/${slug}/${destFile}`;
            }
          } catch (err) {
            emitLog("V2-Orchestrator", `⚠️ Imagen3 failed for ${scene.id} — scene will use gradient background`, "warning");
          }
        }));
      }
      setStatus("running", row.topic, 55);

      // D-ID lipsync on first insight scene — only when avatar URL set in sheet
      const insightScene = sb.scenes.find(s => s.beat === "insight");
      if (LipsyncAgent.isAvailable() && voicePath && insightScene && !clipUrlMap[insightScene.id] && row.avatarUrl?.trim()) {
        emitLog("V2-Orchestrator", "Downloading avatar for D-ID lipsync...", "info");
        try {
          const avatarDest = path.join(tempDir, "avatar.jpg");
          const avatarRes  = await fetch(row.avatarUrl.trim());
          if (avatarRes.ok) fs.writeFileSync(avatarDest, Buffer.from(await avatarRes.arrayBuffer()));
          if (fs.existsSync(avatarDest)) {
            const lipsyncClip = await this.lipsync.generateTalkingHead(avatarDest, voicePath, tempDir);
            if (lipsyncClip) {
              const destFile = `lipsync-${insightScene.id}.mp4`;
              try { fs.copyFileSync(lipsyncClip, path.join(publicContent, destFile)); } catch { /* ignore */ }
              clipUrlMap[insightScene.id] = `/content/${slug}/${destFile}`;
              emitLog("V2-Orchestrator", "Talking head ready", "success");
            }
          }
        } catch (err) {
          console.warn("[v2] Lipsync failed:", err instanceof Error ? err.message : err);
        }
      }

      // ── Step 5: Music ─────────────────────────────────────────────────────
      emitLog("V2-Orchestrator", `Selecting ${sb.musicMood} music...`, "info");
      const moodMap: Record<string, string> = { tense: "dramatic", uplifting: "energetic", mysterious: "mysterious", energetic: "energetic", calm: "calm" };
      const designStub: DesignSpec = {
        theme: "minimal", mood: (moodMap[sb.musicMood] ?? "professional") as import("../design/design-agent").Mood, overlayStyle: "gradient", overlayOpacity: 0.5,
        fontWeight: "bold", textEffect: "shadow", rationale: `V2 ${sb.visualStyle}`,
        brandColors: { primary: "#ffffff", secondary: "#cccccc", accent: "#FFE500", background: "#000000", text: "#ffffff" },
      };
      const musicTrack = await this.music.selectTrack(row, designStub, slug, tempDir).catch(() => null);
      setStatus("running", row.topic, 62);

      const voiceoverUrl = voicePath ? `/content/${slug}/voiceover.mp3` : undefined;

      // ── Step 6: Assemble storyboard data for Remotion ─────────────────────
      const storyboardData = {
        ...sb,
        scenes: sb.scenes.map(scene => ({
          ...scene,
          videoClipPath: clipUrlMap[scene.id],
          imagePath:     imageUrlMap[scene.id] ?? "",
        })),
      };

      const videoData: V2UGCData = {
        topic:       row.topic,
        storyboard:  storyboardData,
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
      // Use short job key for Telegram callback (avoids 64-byte limit on long slugs)
      const cbKey = dbJobId ? dbJobId.slice(0, 16) : slug.slice(0, 55);
      const approval = await this.approvalBot.sendVideoForApproval(finalVideo, row.topic, cbKey);

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
