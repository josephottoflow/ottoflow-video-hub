/**
 * RENDER AGENT — Remotion Video Renderer
 */

import { execSync, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/config";
import type { ProductVideoData } from "../../remotion/types";

export interface RenderJob {
  productSlug: string;
  videoDataPath: string;
  outputPath: string;
  status: "queued" | "rendering" | "done" | "error";
  progress?: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface RenderResult {
  success: boolean;
  videoPath?: string;
  durationMs?: number;
  fileSizeBytes?: number;
  error?: string;
}

export class RenderAgent {
  private config = getConfig();
  private queue: RenderJob[] = [];

  async render(
    productSlug: string,
    videoData: ProductVideoData,
    outputDir: string
  ): Promise<RenderResult> {
    const startTime = Date.now();

    try {
      fs.mkdirSync(outputDir, { recursive: true });

      const contentDir = path.resolve("public", "content", productSlug);
      fs.mkdirSync(contentDir, { recursive: true });

      const videoDataPath = path.join(contentDir, "video-data.json");
      fs.writeFileSync(videoDataPath, JSON.stringify(videoData, null, 2));

      this.copyImagesToPublic(videoData, contentDir);

      const outputPath = path.join(
        outputDir,
        `${productSlug}.${this.config.app.videoFormat}`
      );

      const propsPath = path.join(outputDir, "render-props.json");
      fs.writeFileSync(propsPath, JSON.stringify({ data: videoData }));

      const renderCmd = [
        "npx remotion render",
        "src/remotion/index.ts",
        "product-demo",
        outputPath,
        `--props="${propsPath}"`,
        "--codec=h264",
        "--image-format=jpeg",
        "--jpeg-quality=90",
        "--width=1080",
        "--height=1920",
        "--port=3100",
        "--log=verbose",
      ].join(" ");

      console.log(`[render] Starting render for ${productSlug}...`);
      execSync(renderCmd, {
        stdio: "inherit",
        timeout: 300000,
        cwd: path.resolve("."),
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error("Render completed but output file not found");
      }

      const stats = fs.statSync(outputPath);

      return {
        success: true,
        videoPath: outputPath,
        durationMs: Date.now() - startTime,
        fileSizeBytes: stats.size,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown render error";
      return { success: false, error: message };
    }
  }

  enqueue(productSlug: string, videoDataPath: string, outputPath: string): RenderJob {
    const job: RenderJob = {
      productSlug,
      videoDataPath,
      outputPath,
      status: "queued",
    };
    this.queue.push(job);
    return job;
  }

  async processQueue(): Promise<RenderResult[]> {
    const results: RenderResult[] = [];

    for (const job of this.queue) {
      if (job.status !== "queued") continue;

      job.status = "rendering";
      job.startedAt = new Date().toISOString();
      console.log(`[render] Processing: ${job.productSlug}`);

      try {
        const videoDataRaw = fs.readFileSync(job.videoDataPath, "utf-8");
        const videoData = JSON.parse(videoDataRaw) as ProductVideoData;

        const outputDir = path.dirname(job.outputPath);
        const result = await this.render(job.productSlug, videoData, outputDir);

        if (result.success) {
          job.status = "done";
        } else {
          job.status = "error";
          job.error = result.error;
        }

        results.push(result);
      } catch (error) {
        job.status = "error";
        job.error = error instanceof Error ? error.message : "Unknown error";
        results.push({ success: false, error: job.error });
      }

      job.completedAt = new Date().toISOString();
    }

    return results;
  }

  getQueueStatus(): {
    total: number;
    queued: number;
    rendering: number;
    done: number;
    errors: number;
  } {
    return {
      total: this.queue.length,
      queued: this.queue.filter((j) => j.status === "queued").length,
      rendering: this.queue.filter((j) => j.status === "rendering").length,
      done: this.queue.filter((j) => j.status === "done").length,
      errors: this.queue.filter((j) => j.status === "error").length,
    };
  }

  private copyImagesToPublic(
    videoData: ProductVideoData,
    contentDir: string
  ): void {
    const imagesDir = path.join(contentDir, "images");
    fs.mkdirSync(imagesDir, { recursive: true });

    const imagePaths = new Set<string>();

    for (const img of videoData.imageShowcase.images) {
      if (img.path) imagePaths.add(img.path);
    }
    if (videoData.featureCallouts.productImagePath) {
      imagePaths.add(videoData.featureCallouts.productImagePath);
    }

    for (const srcPath of imagePaths) {
      if (fs.existsSync(srcPath)) {
        const destPath = path.join(imagesDir, path.basename(srcPath));
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  launchStudio(): void {
    console.log("[render] Launching Remotion Studio...");
    exec("npx remotion studio");
  }
}
motion studio");
  }
}
