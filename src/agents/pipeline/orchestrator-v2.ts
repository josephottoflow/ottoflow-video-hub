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
import { uploadFileToR2, isR2Available } from "../../lib/r2";
import { updateJobStatus, saveStoryboard } from "../../lib/db";
import type { PipelineResult } from "./orchestrator";
import type { V2UGCData }      from "../../remotion/v2-ugc/types";
import type { DesignSpec }     from "../design/design-agent";

// Veo can only generate 4-8s clips; clamp scene duration to valid range
function clampVeoDuration(seconds: number): number {
  return Math.max(4, Math.min(8, seconds));
}

const SHEET_NAME = "Video Gen — Advance Tier";

// Generates a ~32-word script from a topic without any AI API.
// Used when ScriptWriter fails (no ANTHROPIC_API_KEY) and no script is in the sheet.
// Targets 12s spoken at ~160 wpm inside a 20s video.
function templateScript(topic: string): string {
  const t = topic.trim();
  return `Most people get ${t} wrong. Here's the real secret. It's simpler than you think. Try this today.`;
}

export class PipelineOrchestratorV2 {
  private sheets       = new SheetsClient(SHEET_NAME, "v2-advanced");
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
    dbJobId?:       string,
    musicVibe?:     string
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

    const TRACE = (msg: string) => emitLog("V2-Orchestrator", `[TRACE] ${msg}`, "info");
    const TRACE_ERR = (msg: string) => emitLog("V2-Orchestrator", `[TRACE][ERROR] ${msg}`, "error");

    let pipelineResult: PipelineResult;
    try {
      await this.sheets.updateStatus(rowIndex, "Processing");
      setStatus("running", row.topic, 5);

      // ── Step 1: Generate dynamic storyboard (Gemini creative director) ──────
      let _t = Date.now();
      emitLog("V2-Orchestrator", `Building storyboard (variant: ${renderVariant ?? "problem-first"}, hook: ${hookStyle ?? "shock"}) | tempDir=${tempDir} | staticPort=${process.env.PORT || "3000"} | Veo=${VeoAgent.isAvailable()} | ElevenLabs=${!!process.env.ELEVENLABS_API_KEY} | R2=${isR2Available()}`, "agent");
      TRACE(`Providers: GOOGLE_API_KEY=${!!process.env.GOOGLE_API_KEY} ANTHROPIC=${!!process.env.ANTHROPIC_API_KEY} ELEVENLABS=${!!process.env.ELEVENLABS_API_KEY} JAMENDO=${!!process.env.JAMENDO_CLIENT_ID} R2=${isR2Available()} D_ID=${!!process.env.D_ID_API_KEY}`);
      TRACE(`Sheet row: rowIndex=${rowIndex} topic="${row.topic}" style="${row.style}" voice="${row.voice}" scriptLen=${row.script?.length ?? 0}`);
      const sb: Storyboard = await this.storyboard.generate(
        row.topic, row.style,
        renderVariant ?? "problem-first",
        hookStyle     ?? "shock",
        row.script?.trim() || undefined   // seed Gemini with existing sheet script
      );
      emitLog("V2-Orchestrator", `Storyboard done in ${Date.now()-_t}ms — ${sb.scenes.length} scenes, ${(sb.totalFrames / 30).toFixed(1)}s, style=${sb.visualStyle}`, "success");
      TRACE(`Storyboard scenes: ${sb.scenes.map(s => `${s.id}(${s.beat},${s.seconds}s)`).join(" | ")}`);
      TRACE(`Full script (${sb.fullScript.split(" ").length}w): "${sb.fullScript}"`);
      _t = Date.now();
      setStatus("running", row.topic, 15);

      if (dbJobId) {
        saveStoryboard(dbJobId, {
          topic:       sb.topic,
          visualStyle: sb.visualStyle,
          musicMood:   sb.musicMood,
          totalFrames: sb.totalFrames,
          fullScript:  sb.fullScript,
          scenes:      sb.scenes,
        }).catch(() => {}); // non-fatal
        // Store script text and emit to live log for UI visibility
        updateJobStatus(dbJobId, "processing", { script_text: sb.fullScript }).catch(() => {});
      }
      emitLog("Script Writer", `Script: ${sb.fullScript}`, "info");

      // Write script back to sheet for record-keeping
      const sheetScript = sb.fullScript;
      const hookLines   = sb.scenes.filter(s => s.beat === "hook").map(s => s.caption);
      await this.sheets.updateScript(rowIndex, sheetScript, hookLines[0] ?? "", hookLines[1] ?? "", hookLines[2] ?? "")
        .catch(() => {}); // non-fatal

      // ── Step 2: ElevenLabs voiceover from fullScript ──────────────────────
      const publicContent = path.resolve("public", "content", slug);
      fs.mkdirSync(publicContent, { recursive: true });

      // V2 canonical voice: "bright friendly" (Gigi — creator-native TikTok cadence).
      // Sheet col G overrides if set; otherwise default to bright friendly.
      const v2Voice = row.voice?.trim() || "bright friendly";
      emitLog("V2-Orchestrator", `Generating voiceover (voice: ${v2Voice})...`, "info");
      TRACE(`Voiceover: ElevenLabs available=${!!process.env.ELEVENLABS_API_KEY} voice="${v2Voice}" (sheet="${row.voice ?? ""}") scriptWords=${sb.fullScript.split(" ").length}`);
      _t = Date.now();
      const voicePath = await this.voiceover.generate(sb.fullScript, tempDir, v2Voice) ?? undefined;
      if (voicePath) {
        const voiceSizeKb = Math.round(fs.statSync(voicePath).size / 1024);
        emitLog("V2-Orchestrator", "Voiceover ready", "success");
        TRACE(`Voiceover done in ${Date.now()-_t}ms — ${voiceSizeKb}KB at ${voicePath}`);
      } else {
        emitLog("V2-Orchestrator", "⚠️ Voiceover skipped — check ELEVENLABS_API_KEY. Video will be silent.", "warning");
        TRACE(`Voiceover skipped in ${Date.now()-_t}ms — no file produced`);
      }
      setStatus("running", row.topic, 28);

      // ── Step 3: Veo clips — one per storyboard scene ──────────────────────
      const clipUrlMap: Record<string, string> = {};
      const imageUrlMap: Record<string, string> = {};

      const localPort = process.env.PORT || "3000";
      if (VeoAgent.isAvailable()) {
        this.veo.resetQuota(); // fresh attempt — clears any quota flag from a prior job on this instance
        emitLog("V2-Orchestrator", `Generating ${sb.scenes.length} Veo clips (serialized — avoids burst 429)...`, "info");
        TRACE(`Veo: model=veo-3.1-lite-generate-preview scenes=${sb.scenes.length} GOOGLE_API_KEY=${process.env.GOOGLE_API_KEY ? process.env.GOOGLE_API_KEY.slice(0,8)+"..." : "MISSING"}`);
        _t = Date.now();
        // SERIALIZED — not Promise.all. Concurrent requests burst the rate limit (4 QPM).
        // Sequential with a 5s gap keeps throughput under the quota ceiling.
        for (let i = 0; i < sb.scenes.length; i++) {
          const scene   = sb.scenes[i];
          const outFile = `clip-${scene.id}.mp4`;
          const outPath = path.join(tempDir, outFile);
          const veoDur  = clampVeoDuration(scene.seconds);
          TRACE(`Veo[${i+1}/${sb.scenes.length}] scene=${scene.id} beat=${scene.beat} dur=${veoDur}s prompt="${scene.visualPrompt.slice(0,80)}..."`);
          const clipPath = await this.veo.generateSingleClip(scene.visualPrompt, outPath, veoDur);
          if (clipPath) {
            const clipSizeBytes = fs.statSync(clipPath).size;
            const clipSizeMb    = (clipSizeBytes / 1024 / 1024).toFixed(2);
            let clipUrl: string | undefined;
            if (isR2Available()) {
              try { clipUrl = await uploadFileToR2(`clips/${slug}/${outFile}`, clipPath, "video/mp4"); } catch { /* fall through */ }
            }
            if (!clipUrl) {
              const destPublic = path.join(publicContent, outFile);
              try { fs.copyFileSync(clipPath, destPublic); } catch (copyErr) {
                TRACE_ERR(`Veo[${i+1}] copy to public FAILED: ${copyErr instanceof Error ? copyErr.message : copyErr} — src=${clipPath} dest=${destPublic}`);
              }
              clipUrl = `http://localhost:${localPort}/content/${slug}/${outFile}`;
            }
            clipUrlMap[scene.id] = clipUrl;
            emitLog("V2-Orchestrator", `Veo clip ${i+1}/${sb.scenes.length} ✅ — ${scene.beat} (${veoDur}s, ${clipSizeMb}MB)`, "success");
            TRACE(`Veo[${i+1}] SUCCESS: bytes=${clipSizeBytes} sizeMb=${clipSizeMb} exists=${fs.existsSync(outPath)} url=${clipUrl}`);
          } else {
            emitLog("V2-Orchestrator", `Veo scene ${scene.id} ❌ — will use Imagen3 fallback`, "warning");
            TRACE_ERR(`Veo[${i+1}] FAILED: scene=${scene.id} beat=${scene.beat}`);
          }
          // 5s gap between Veo requests — keeps burst rate under 4 QPM ceiling
          if (i < sb.scenes.length - 1) await new Promise(r => setTimeout(r, 5_000));
        }
        TRACE(`Veo batch done in ${Date.now()-_t}ms — ${Object.keys(clipUrlMap).length}/${sb.scenes.length} clips generated. Missing: ${sb.scenes.filter(s=>!clipUrlMap[s.id]).map(s=>s.id).join(",")||"none"}`);
      } else {
        TRACE(`Veo SKIPPED — GOOGLE_API_KEY not set`);
      }

      // ── Step 4: Imagen3 static fallback for scenes missing a clip ─────────
      const missingScenes = sb.scenes.filter(s => !clipUrlMap[s.id]);
      if (missingScenes.length > 0) {
        emitLog("V2-Orchestrator", `Imagen3 fallback for ${missingScenes.length} scene(s)...`, "info");
        TRACE(`Imagen3: falling back for scenes: ${missingScenes.map(s=>s.id).join(",")} — model=gemini-2.5-flash-image`);
        _t = Date.now();
        await Promise.all(missingScenes.map(async (scene) => {
          try {
            const destFile = `scene-${scene.id}.jpg`;
            const outPath  = path.join(tempDir, destFile);
            TRACE(`Imagen3: generating scene=${scene.id} beat=${scene.beat} prompt="${scene.visualPrompt.slice(0,80)}..."`);
            const imgPath  = await this.imagen3.generateSingleImage(scene.visualPrompt, outPath);
            if (imgPath) {
              const imgSizeKb = Math.round(fs.statSync(imgPath).size / 1024);
              let imgUrl: string | undefined;
              if (isR2Available()) {
                try { imgUrl = await uploadFileToR2(`images/${slug}/${destFile}`, imgPath, "image/jpeg"); } catch { /* fall through */ }
              }
              if (!imgUrl) {
                try { fs.copyFileSync(imgPath, path.join(publicContent, destFile)); } catch { /* skip */ }
                imgUrl = `http://localhost:${localPort}/content/${slug}/${destFile}`;
              }
              imageUrlMap[scene.id] = imgUrl;
              TRACE(`Imagen3: SUCCESS scene=${scene.id} ${imgSizeKb}KB → ${imgUrl}`);
            } else {
              TRACE_ERR(`Imagen3: scene=${scene.id} returned null — scene will render with gradient background only`);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            emitLog("V2-Orchestrator", `⚠️ Imagen3 failed for ${scene.id} — scene will use gradient background`, "warning");
            TRACE_ERR(`Imagen3 EXCEPTION scene=${scene.id}: ${msg}`);
          }
        }));
        TRACE(`Imagen3 batch done in ${Date.now()-_t}ms — ${Object.keys(imageUrlMap).length} images. Missing assets: ${missingScenes.filter(s=>!imageUrlMap[s.id]).map(s=>s.id).join(",")||"none"}`);
      }
      setStatus("running", row.topic, 55);

      // D-ID lipsync on first insight scene — uses sheet avatarUrl or env default
      const DEFAULT_AVATAR_URL = process.env.DEFAULT_AVATAR_URL ?? "";
      const insightScene = sb.scenes.find(s => s.beat === "insight");
      const avatarUrl    = row.avatarUrl?.trim() || DEFAULT_AVATAR_URL;
      if (LipsyncAgent.isAvailable() && voicePath && insightScene && !clipUrlMap[insightScene.id] && avatarUrl) {
        emitLog("V2-Orchestrator", "Downloading avatar for D-ID lipsync...", "info");
        try {
          const avatarDest = path.join(tempDir, "avatar.jpg");
          const avatarRes  = await fetch(avatarUrl);
          if (avatarRes.ok) fs.writeFileSync(avatarDest, Buffer.from(await avatarRes.arrayBuffer()));
          if (fs.existsSync(avatarDest)) {
            const lipsyncClip = await this.lipsync.generateTalkingHead(avatarDest, voicePath, tempDir);
            if (lipsyncClip) {
              const destFile = `lipsync-${insightScene.id}.mp4`;
              let lipsyncUrl: string | undefined;
              if (isR2Available()) {
                try { lipsyncUrl = await uploadFileToR2(`clips/${slug}/${destFile}`, lipsyncClip, "video/mp4"); } catch { /* fall through */ }
              }
              if (!lipsyncUrl) {
                try { fs.copyFileSync(lipsyncClip, path.join(publicContent, destFile)); } catch { /* ignore */ }
                lipsyncUrl = `http://localhost:${localPort}/content/${slug}/${destFile}`;
              }
              clipUrlMap[insightScene.id] = lipsyncUrl;
              emitLog("V2-Orchestrator", "Talking head ready", "success");
            }
          }
        } catch (err) {
          console.warn("[v2] Lipsync failed:", err instanceof Error ? err.message : err);
        }
      } else if (LipsyncAgent.isAvailable() && !avatarUrl) {
        emitLog("V2-Orchestrator", "D-ID lipsync skipped — set DEFAULT_AVATAR_URL env or add avatar URL to sheet col U", "warning");
      }

      // ── Step 5: Music ─────────────────────────────────────────────────────
      emitLog("V2-Orchestrator", `Selecting ${sb.musicMood} music...`, "info");
      const moodMap: Record<string, string> = { tense: "dramatic", uplifting: "energetic", mysterious: "mysterious", energetic: "energetic", calm: "calm" };
      const designStub: DesignSpec = {
        theme: "minimal", mood: (moodMap[sb.musicMood] ?? "professional") as import("../design/design-agent").Mood, overlayStyle: "gradient", overlayOpacity: 0.5,
        fontWeight: "bold", textEffect: "shadow", rationale: `V2 ${sb.visualStyle}`,
        brandColors: { primary: "#ffffff", secondary: "#cccccc", accent: "#FFE500", background: "#000000", text: "#ffffff" },
      };
      const musicTrack = await this.music.selectTrack(row, designStub, slug, tempDir, musicVibe).catch(() => null);
      setStatus("running", row.topic, 62);

      // ── Step 6: Assemble storyboard data for Remotion ─────────────────────
      const storyboardData = {
        ...sb,
        scenes: sb.scenes.map(scene => ({
          ...scene,
          videoClipPath: clipUrlMap[scene.id],
          imagePath:     imageUrlMap[scene.id] ?? "",
        })),
      };

      // Railway-visible asset manifest — confirms each scene's asset source
      console.log(`[v2] asset manifest for job ${slug}:`);
      storyboardData.scenes.forEach((scene, i) => {
        const clip = clipUrlMap[scene.id];
        const img  = imageUrlMap[scene.id];
        const src  = clip ? `VEO:${clip.slice(-40)}` : img ? `IMG:${img.slice(-40)}` : "PROCEDURAL (dark gradient)";
        console.log(`  scene${i+1} [${scene.beat}] → ${src}`);
      });

      const videoData: V2UGCData = {
        topic:      row.topic,
        storyboard: storyboardData,
        // voiceoverUrl omitted — Remotion renders silent visuals; FFmpeg mixes all audio
      };

      emitLog("V2-Orchestrator", "Rendering V2 composition...", "info");
      await this.sheets.updateStatus(rowIndex, "Rendering");
      setStatus("running", row.topic, 65);

      _t = Date.now();
      TRACE(`Pre-render state: clips=${Object.keys(clipUrlMap).length}/${sb.scenes.length} images=${Object.keys(imageUrlMap).length} voiceover=${!!voicePath} music=${!!musicTrack} tempDir=${tempDir}`);
      // ── HARD ASSET MANIFEST — printed to logs for explicit verification ──────
      emitLog("V2-Orchestrator", "═══════════════ SCENE ASSET MANIFEST ═══════════════", "info");
      for (const scene of storyboardData.scenes) {
        const hasClip  = !!scene.videoClipPath;
        const hasImage = !hasClip && !!scene.imagePath;
        const layer    = hasClip ? `VEO CLIP (${scene.videoClipPath?.split("/").pop()})` : hasImage ? `IMAGEN3 IMAGE (${scene.imagePath?.split("/").pop()})` : "PROCEDURAL FALLBACK ⚠️";
        emitLog("V2-Orchestrator", `  ${scene.id} [${scene.beat.toUpperCase().padEnd(7)}] → ${layer}`, hasClip ? "success" : hasImage ? "info" : "warning");
        TRACE(`AssetManifest: scene=${scene.id} beat=${scene.beat} videoClipPath=${scene.videoClipPath || "NONE"} imagePath=${scene.imagePath || "NONE"} layer=${layer}`);
      }
      emitLog("V2-Orchestrator", `  Summary: ${Object.keys(clipUrlMap).length}/${sb.scenes.length} Veo clips | ${Object.keys(imageUrlMap).length} Imagen3 images | ${sb.scenes.length - Object.keys(clipUrlMap).length - Object.keys(imageUrlMap).length} procedural`, "info");
      emitLog("V2-Orchestrator", "═════════════════════════════════════════════════════", "info");
      emitLog("V2-Orchestrator", `Remotion render starting — composition=v2-ugc outputDir=${tempDir} scenes=${storyboardData.scenes.length} clipsReady=${Object.keys(clipUrlMap).length} imagesReady=${Object.keys(imageUrlMap).length}`, "info");
      const renderResult = await this.renderAgent.render(slug, videoData, tempDir, "v2-ugc");
      if (!renderResult.success || !renderResult.videoPath) {
        TRACE_ERR(`Render FAILED: ${renderResult.error}`);
        throw new Error(renderResult.error || "Render failed");
      }
      emitLog("V2-Orchestrator", `Rendered in ${Date.now()-_t}ms — ${((renderResult.fileSizeBytes || 0) / 1024 / 1024).toFixed(1)}MB path=${renderResult.videoPath}`, "success");
      TRACE(`Render output: ${renderResult.videoPath} exists=${fs.existsSync(renderResult.videoPath)} size=${((renderResult.fileSizeBytes||0)/1024/1024).toFixed(1)}MB`);
      _t = Date.now();
      setStatus("running", row.topic, 78);

      const audioLabel = voicePath
        ? `voiceover${musicTrack ? ` + music "${musicTrack.name}"` : ""}`
        : musicTrack ? `music "${musicTrack.name}"` : "no audio";
      emitLog("V2-Orchestrator", `FFmpeg post-processing (minimal grade, ${audioLabel})...`, "info");

      TRACE(`FFmpeg: inputPath=${renderResult.videoPath} voiceover=${voicePath ? "YES" : "NO"} music=${musicTrack?.localPath ? "YES" : "NO"}`);
      const ffResult = await this.ffmpeg.postProcess(renderResult.videoPath, "minimal", {
        voiceoverPath: voicePath,
        musicPath:     musicTrack?.localPath,
      });

      let finalVideoPath = renderResult.videoPath;
      if (ffResult.success) {
        // Delete Remotion's raw MP4 now that FFmpeg has produced the final — frees ~50MB before copy
        if (ffResult.outputPath !== renderResult.videoPath) {
          try { fs.unlinkSync(renderResult.videoPath); } catch { /* non-fatal */ }
        }
        finalVideoPath = ffResult.outputPath;
        emitLog("V2-Orchestrator", `FFmpeg done — ${((ffResult.fileSizeBytes || 0) / 1024 / 1024).toFixed(1)}MB`, "success");
        TRACE(`FFmpeg output: ${ffResult.outputPath} size=${((ffResult.fileSizeBytes||0)/1024/1024).toFixed(1)}MB durationMs=${ffResult.durationMs}`);
      } else {
        TRACE_ERR(`FFmpeg FAILED: ${ffResult.error} — falling back to raw render at ${finalVideoPath}`);
      }

      const finalVideo = path.join(outDir, `${slug}.mp4`);
      TRACE(`Copying ${finalVideoPath} → ${finalVideo}`);
      fs.copyFileSync(finalVideoPath, finalVideo);
      TRACE(`Final video size: ${(fs.statSync(finalVideo).size/1024/1024).toFixed(1)}MB`);

      // Upload final video to R2 for cloud access (Remotion preview + Telegram)
      let outputLink: string = finalVideo;
      if (isR2Available()) {
        TRACE(`R2 upload: ${finalVideo} → videos/${slug}.mp4`);
        try {
          outputLink = await uploadFileToR2(`videos/${slug}.mp4`, finalVideo, "video/mp4");
          emitLog("V2-Orchestrator", `Uploaded to R2: ${outputLink}`, "success");
          TRACE(`R2 upload SUCCESS: ${outputLink}`);
        } catch (err) {
          const r2msg = err instanceof Error ? err.message : String(err);
          emitLog("V2-Orchestrator", `R2 upload failed: ${r2msg}`, "warning");
          TRACE_ERR(`R2 upload FAILED: ${r2msg} — outputLink remains local path`);
        }
      } else {
        TRACE(`R2 skipped — R2_ACCOUNT_ID not set. outputLink=${outputLink}`);
      }

      setStatus("running", row.topic, 85);

      emitLog("V2-Orchestrator", "Generating SEO...", "info");
      await this.sheets.updateStatus(rowIndex, "Exporting");
      this.seoGen.generateAndSave(row.topic, row.style, { a: row.hookA, b: row.hookB, c: row.hookC }, outDir);
      setStatus("running", row.topic, 90);

      emitLog("V2-Orchestrator", "Sending to Telegram for approval...", "info");
      const finalVideoSizeMb = (fs.statSync(finalVideo).size / 1024 / 1024).toFixed(1);
      TRACE(`Telegram upload: ${finalVideo} size=${finalVideoSizeMb}MB TELEGRAM_BOT_TOKEN=${!!process.env.TELEGRAM_BOT_TOKEN}`);
      // Use short job key for Telegram callback (avoids 64-byte limit on long slugs)
      const cbKey = dbJobId ? dbJobId.slice(0, 16) : slug.slice(0, 55);
      const approval = await this.approvalBot.sendVideoForApproval(finalVideo, row.topic, cbKey);
      TRACE(`Telegram approval decision: ${approval.decision} waitMs=${approval.waitTimeMs}`);

      if (approval.decision === "approved" || approval.decision === "timeout") {
        // Auto-approve on timeout — video is already rendered and good to go.
        // Creator can review in Quality Review tab; rejecting requires a separate re-queue.
        await this.sheets.markComplete(rowIndex, outputLink);
        setStatus("done", row.topic, 100);
        if (approval.decision === "timeout") {
          emitLog("V2-Orchestrator", `Telegram timeout — auto-approved: ${row.topic}`, "success");
        } else {
          emitLog("V2-Orchestrator", `Approved: ${row.topic}`, "success");
        }
      } else if (approval.decision === "rejected") {
        await this.sheets.updateStatus(rowIndex, "Rejected");
        setStatus("error");
        emitLog("V2-Orchestrator", `Rejected: ${row.topic}`, "warning");
      }

      pipelineResult = {
        topic:      row.topic,
        slug,
        success:    approval.decision !== "rejected",
        outputDir:  outDir,
        outputLink,
        timing: {
          startedAt,
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - new Date(startedAt).getTime(),
        },
      };

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack   = err instanceof Error ? (err.stack ?? "") : "";
      await this.sheets.updateStatus(rowIndex, "Error", message);
      setStatus("error");
      emitLog("V2-Orchestrator", `FATAL at ${Date.now() - new Date(startedAt).getTime()}ms: ${message}`, "error");
      if (stack) emitLog("V2-Orchestrator", `Stack: ${stack}`, "error");
      pipelineResult = {
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
    } finally {
      // Clean up tempDir + public/content/{slug}/ — Veo/Imagen3 clips copied here accumulate fast
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* non-fatal */ }
      const publicSlugDir = path.resolve("public", "content", slug);
      try { fs.rmSync(publicSlugDir, { recursive: true, force: true }); } catch { /* non-fatal */ }
    }
    return pipelineResult;
  }
}
