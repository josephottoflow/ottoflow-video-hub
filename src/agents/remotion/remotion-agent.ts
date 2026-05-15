/**
 * REMOTION AGENT — Composition manager + task queue for Remotion renders
 *
 * Sits above RenderAgent. Knows all available compositions,
 * manages a persistent task queue, tracks progress, and provides
 * helpers for studio + validation.
 *
 * Available compositions:
 *   cinematic       — 6-scene Apple-style (25s) — PRIMARY
 *   product-video   — 6-scene product template
 *   product-demo    — 7-scene demo/walkthrough
 *   unboxing        — 7-scene unboxing flow
 *   before-after    — 6-scene comparison
 *   demo-video      — 7-scene SaaS demo
 */

import { execSync, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import type { ProductVideoData } from "../../remotion/types";

// ─── Types ───────────────────────────────────────────────────

export type CompositionId =
  | "cinematic"
  | "product-video"
  | "product-demo"
  | "unboxing"
  | "before-after"
  | "demo-video";

export type TaskStatus = "queued" | "rendering" | "done" | "error" | "cancelled";

export interface RemotionTask {
  id:            string;
  slug:          string;
  compositionId: CompositionId;
  status:        TaskStatus;
  priority:      number;        // lower = higher priority
  videoDataPath: string;
  outputPath:    string;
  progress:      number;        // 0-100
  error?:        string;
  queuedAt:      string;
  startedAt?:    string;
  completedAt?:  string;
  durationMs?:   number;
  fileSizeBytes?: number;
}

export interface CompositionInfo {
  id:          CompositionId;
  description: string;
  durationSec: number;
  scenes:      number;
  inputSchema: string;   // type name
  active:      boolean;  // is this the primary composition?
}

export interface RenderOptions {
  codec?:        "h264" | "h265" | "vp8" | "vp9";
  jpegQuality?:  number;
  width?:        number;
  height?:       number;
  port?:         number;
  logLevel?:     "verbose" | "info" | "warn" | "error";
}

// ─── Composition Registry ─────────────────────────────────────

export const COMPOSITIONS: CompositionInfo[] = [
  {
    id: "cinematic", description: "Apple-style 6-scene content video", durationSec: 25,
    scenes: 6, inputSchema: "ProductVideoData", active: true,
  },
  {
    id: "product-video", description: "Standard 6-scene product showcase", durationSec: 25,
    scenes: 6, inputSchema: "ProductVideoData", active: false,
  },
  {
    id: "product-demo", description: "7-scene product demo with walkthrough", durationSec: 28,
    scenes: 7, inputSchema: "ProductVideoData", active: false,
  },
  {
    id: "unboxing", description: "7-scene unboxing experience", durationSec: 28,
    scenes: 7, inputSchema: "ProductVideoData", active: false,
  },
  {
    id: "before-after", description: "6-scene before/after comparison", durationSec: 25,
    scenes: 6, inputSchema: "ProductVideoData", active: false,
  },
  {
    id: "demo-video", description: "7-scene SaaS/app demo", durationSec: 28,
    scenes: 7, inputSchema: "ProductVideoData", active: false,
  },
];

// ─── Remotion Agent ───────────────────────────────────────────

export class RemotionAgent {
  private tasks: RemotionTask[] = [];
  private studioProcess: ReturnType<typeof exec> | null = null;
  private defaultOptions: Required<RenderOptions> = {
    codec:       "h264",
    jpegQuality: 90,
    width:       1080,
    height:      1920,
    port:        3100,
    logLevel:    "verbose",
  };

  // ─── Composition Queries ──────────────────────────────────

  listCompositions(): CompositionInfo[] {
    return [...COMPOSITIONS];
  }

  getComposition(id: CompositionId): CompositionInfo | undefined {
    return COMPOSITIONS.find((c) => c.id === id);
  }

  getActiveComposition(): CompositionInfo {
    return COMPOSITIONS.find((c) => c.active) || COMPOSITIONS[0];
  }

  // ─── Task Management ──────────────────────────────────────

  addTask(options: {
    slug:          string;
    compositionId?: CompositionId;
    videoData:     ProductVideoData;
    outputDir:     string;
    priority?:     number;
  }): RemotionTask {
    const { slug, videoData, outputDir } = options;
    const compositionId = options.compositionId || this.getActiveComposition().id;
    const priority      = options.priority ?? 5;

    const contentDir = path.resolve("public", "content", slug);
    fs.mkdirSync(contentDir, { recursive: true });
    fs.mkdirSync(outputDir,  { recursive: true });

    const videoDataPath = path.join(contentDir, "video-data.json");
    fs.writeFileSync(videoDataPath, JSON.stringify(videoData, null, 2));

    const outputPath = path.join(outputDir, `${slug}.mp4`);

    const task: RemotionTask = {
      id:            `render-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      slug,
      compositionId,
      status:        "queued",
      priority,
      videoDataPath,
      outputPath,
      progress:      0,
      queuedAt:      new Date().toISOString(),
    };

    this.tasks.push(task);
    return task;
  }

  getTasks(filter?: { status?: TaskStatus; slug?: string }): RemotionTask[] {
    let list = [...this.tasks];
    if (filter?.status) list = list.filter((t) => t.status === filter.status);
    if (filter?.slug)   list = list.filter((t) => t.slug === filter.slug);
    return list;
  }

  getTask(id: string): RemotionTask | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  cancelTask(id: string): boolean {
    const task = this.tasks.find((t) => t.id === id);
    if (!task || task.status !== "queued") return false;
    task.status = "cancelled";
    return true;
  }

  clearTasks(status?: TaskStatus): void {
    if (status) {
      this.tasks = this.tasks.filter((t) => t.status !== status);
    } else {
      this.tasks = this.tasks.filter((t) => t.status === "queued" || t.status === "rendering");
    }
  }

  getQueueStats(): { queued: number; rendering: number; done: number; error: number; cancelled: number } {
    return {
      queued:    this.tasks.filter((t) => t.status === "queued").length,
      rendering: this.tasks.filter((t) => t.status === "rendering").length,
      done:      this.tasks.filter((t) => t.status === "done").length,
      error:     this.tasks.filter((t) => t.status === "error").length,
      cancelled: this.tasks.filter((t) => t.status === "cancelled").length,
    };
  }

  // ─── Render ───────────────────────────────────────────────

  async renderTask(task: RemotionTask, opts?: RenderOptions): Promise<RemotionTask> {
    const options = { ...this.defaultOptions, ...opts };
    const startTime = Date.now();

    task.status    = "rendering";
    task.startedAt = new Date().toISOString();
    task.progress  = 0;

    try {
      const videoData = JSON.parse(fs.readFileSync(task.videoDataPath, "utf-8")) as ProductVideoData;
      const propsPath = task.videoDataPath.replace("video-data.json", "render-props.json");
      fs.writeFileSync(propsPath, JSON.stringify({ data: videoData }));

      const cmd = [
        "npx remotion render",
        "src/remotion/index.ts",
        task.compositionId,
        `"${task.outputPath}"`,
        `--props="${propsPath}"`,
        `--codec=${options.codec}`,
        "--image-format=jpeg",
        `--jpeg-quality=${options.jpegQuality}`,
        `--width=${options.width}`,
        `--height=${options.height}`,
        `--port=${options.port}`,
        `--log=${options.logLevel}`,
      ].join(" ");

      console.log(`[remotion] Rendering: ${task.slug} (${task.compositionId})`);
      execSync(cmd, { stdio: "inherit", timeout: 300000, cwd: path.resolve(".") });

      if (!fs.existsSync(task.outputPath)) {
        throw new Error("Render completed but output file not found");
      }

      const stats = fs.statSync(task.outputPath);
      task.progress      = 100;
      task.status        = "done";
      task.completedAt   = new Date().toISOString();
      task.durationMs    = Date.now() - startTime;
      task.fileSizeBytes = stats.size;

      console.log(`[remotion] Done: ${task.slug} — ${Math.round(task.durationMs / 1000)}s, ${(stats.size / 1024 / 1024).toFixed(1)}MB`);
    } catch (err) {
      task.status      = "error";
      task.error       = err instanceof Error ? err.message : "Unknown render error";
      task.completedAt = new Date().toISOString();
      task.durationMs  = Date.now() - startTime;
      console.error(`[remotion] Error: ${task.slug} — ${task.error}`);
    }

    return task;
  }

  async processQueue(opts?: RenderOptions): Promise<RemotionTask[]> {
    const queued = this.tasks
      .filter((t) => t.status === "queued")
      .sort((a, b) => a.priority - b.priority);

    const completed: RemotionTask[] = [];
    for (const task of queued) {
      await this.renderTask(task, opts);
      completed.push(task);
    }
    return completed;
  }

  // ─── Studio ───────────────────────────────────────────────

  launchStudio(port = 3001): void {
    if (this.studioProcess) {
      console.log("[remotion] Studio already running");
      return;
    }
    console.log(`[remotion] Launching Remotion Studio on port ${port}...`);
    this.studioProcess = exec(`npx remotion studio src/remotion/index.ts --port=${port}`);
    console.log(`[remotion] Studio starting at http://localhost:${port}`);
  }

  stopStudio(): void {
    if (this.studioProcess) {
      this.studioProcess.kill();
      this.studioProcess = null;
      console.log("[remotion] Studio stopped");
    }
  }

  // ─── Validation ───────────────────────────────────────────

  validateVideoData(data: ProductVideoData): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!data.productSlug)                              issues.push("Missing productSlug");
    if (!data.hook?.painPointQuestion)                  issues.push("Missing hook.painPointQuestion");
    if (!data.productIntro?.productName)                issues.push("Missing productIntro.productName");
    if (!data.productIntro?.tagline)                    issues.push("Missing productIntro.tagline");
    if (!data.featureCallouts?.features?.length)        issues.push("Missing featureCallouts.features");
    if (!data.imageShowcase?.images?.length)            issues.push("Missing imageShowcase.images");
    if (!data.socialProofCta?.ctaUrl)                   issues.push("Missing socialProofCta.ctaUrl");
    if (!data.brandColors?.primary)                     issues.push("Missing brandColors.primary");

    const bgCount = (data.backgrounds?.photos?.length ?? 0) + (data.backgrounds?.videos?.length ?? 0);
    if (bgCount === 0) issues.push("No Pexels backgrounds — scenes will use flat dark background");

    return { valid: issues.length === 0, issues };
  }
}
