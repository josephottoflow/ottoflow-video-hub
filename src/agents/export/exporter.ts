/**
 * EXPORT AGENT — Output Folder Organizer & Thumbnail Extractor
 * Creates organized output folders per content item with all deliverables:
 * video.mp4, caption.txt, hashtags.txt, thumbnail.png, metadata.json
 * Extracts best-frame thumbnails from rendered videos using ffmpeg.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/config";
import { SeoOutput } from "../seo/seo-generator";

// === Types ===

export interface ExportResult {
  success: boolean;
  outputDir: string;
  files: ExportedFile[];
  error?: string;
}

export interface ExportedFile {
  name: string;
  path: string;
  sizeBytes: number;
  type: "video" | "image" | "text" | "json";
}

export interface ExportMetadata {
  topic: string;
  style: string;
  productSlug: string;
  videoFile: string;
  thumbnailFile: string;
  seo: SeoOutput;
  exportedAt: string;
  pipeline: {
    renderedAt: string;
    exportedAt: string;
  };
}

export interface ExportOptions {
  productSlug: string;
  topic: string;
  style: string;
  videoPath: string;
  seo: SeoOutput;
}

// === Exporter ===

export class Exporter {
  private config = getConfig();

  /**
   * Create the organized output folder for a content item.
   */
  async exportProduct(options: ExportOptions): Promise<ExportResult> {
    const { productSlug, topic, style, videoPath, seo } = options;

    try {
      const outputDir = path.join(this.config.app.outputDir, productSlug);
      fs.mkdirSync(outputDir, { recursive: true });

      const files: ExportedFile[] = [];

      // 1. Copy video
      const videoOutputPath = path.join(outputDir, `${productSlug}.${this.config.app.videoFormat}`);
      fs.copyFileSync(videoPath, videoOutputPath);
      files.push(this.fileEntry(videoOutputPath, "video"));

      // 2. Extract thumbnail (best frame from video)
      const thumbnailPath = path.join(outputDir, "thumbnail.png");
      await this.extractBestFrame(videoPath, thumbnailPath);
      if (fs.existsSync(thumbnailPath)) {
        files.push(this.fileEntry(thumbnailPath, "image"));
      }

      // 3. Write caption + hashtags
      const captionPath = path.join(outputDir, "caption.txt");
      const fullCaption = [
        seo.hook,
        "",
        seo.description,
        "",
        seo.cta,
        "",
        seo.hashtags.map((h) => `#${h}`).join(" "),
      ].join("\n");
      fs.writeFileSync(captionPath, fullCaption, "utf-8");
      files.push(this.fileEntry(captionPath, "text"));

      const hashtagsPath = path.join(outputDir, "hashtags.txt");
      fs.writeFileSync(hashtagsPath, seo.hashtags.map((h) => `#${h}`).join(" "), "utf-8");
      files.push(this.fileEntry(hashtagsPath, "text"));

      const titlePath = path.join(outputDir, "title.txt");
      fs.writeFileSync(titlePath, seo.title, "utf-8");
      files.push(this.fileEntry(titlePath, "text"));

      // 4. Write metadata.json
      const metadata: ExportMetadata = {
        topic,
        style,
        productSlug,
        videoFile: `${productSlug}.${this.config.app.videoFormat}`,
        thumbnailFile: "thumbnail.png",
        seo,
        exportedAt: new Date().toISOString(),
        pipeline: {
          renderedAt: new Date().toISOString(),
          exportedAt: new Date().toISOString(),
        },
      };

      const metadataPath = path.join(outputDir, "metadata.json");
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
      files.push(this.fileEntry(metadataPath, "json"));

      return { success: true, outputDir, files };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown export error";
      return { success: false, outputDir: "", files: [], error: message };
    }
  }

  /**
   * Extract the best frame from a video for use as thumbnail.
   */
  async extractBestFrame(videoPath: string, outputPath: string): Promise<void> {
    try {
      const durationStr = execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`,
        { encoding: "utf-8" }
      ).trim();

      const duration = parseFloat(durationStr);
      const seekTime = Math.max(0.5, duration / 3);

      execSync(
        `ffmpeg -y -ss ${seekTime} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`,
        { stdio: "pipe" }
      );
    } catch {
      try {
        execSync(
          `ffmpeg -y -ss 1 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`,
          { stdio: "pipe" }
        );
      } catch {
        console.warn("ffmpeg thumbnail extraction failed — skipping thumbnail");
      }
    }
  }

  /**
   * Clean up temporary files after export.
   */
  async cleanupTemp(productSlug: string): Promise<void> {
    const tempDir = path.join(this.config.app.tempDir, productSlug);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * List all exported content in the output directory.
   */
  listExports(): string[] {
    const outputDir = this.config.app.outputDir;
    if (!fs.existsSync(outputDir)) return [];

    return fs
      .readdirSync(outputDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  private fileEntry(filePath: string, type: ExportedFile["type"]): ExportedFile {
    const stats = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      sizeBytes: stats.size,
      type,
    };
  }
}
