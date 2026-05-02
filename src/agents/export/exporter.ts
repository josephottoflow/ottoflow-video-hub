/**
 * EXPORT AGENT — Output Folder Organizer & Thumbnail Extractor
 * Creates organized output folders per product with all deliverables:
 * video.mp4, title.txt, description.txt, hashtags.txt, thumbnail.png, metadata.json
 * Extracts best-frame thumbnails from rendered videos using ffmpeg.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/config";
import { SeoOutput } from "../seo/seo-generator";
import { ImageManifest } from "../ingestion/image-processor";

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
  productName: string;
  productSlug: string;
  sourceUrl: string;
  videoFile: string;
  thumbnailFile: string;
  seo: SeoOutput;
  imageCount: number;
  exportedAt: string;
  pipeline: {
    scrapedAt: string;
    processedAt: string;
    renderedAt: string;
    exportedAt: string;
  };
}

// === Exporter ===

export class Exporter {
  private config = getConfig();

  /**
   * Create the organized output folder for a product.
   */
  async exportProduct(options: {
    productSlug: string;
    productName: string;
    sourceUrl: string;
    videoPath: string;
    seo: SeoOutput;
    manifest: ImageManifest;
  }): Promise<ExportResult> {
    const { productSlug, productName, sourceUrl, videoPath, seo, manifest } =
      options;

    try {
      // Create output directory
      const outputDir = path.join(
        this.config.app.outputDir,
        productSlug
      );
      fs.mkdirSync(outputDir, { recursive: true });

      const files: ExportedFile[] = [];

      // 1. Copy video
      const videoOutputPath = path.join(
        outputDir,
        `${productSlug}.${this.config.app.videoFormat}`
      );
      fs.copyFileSync(videoPath, videoOutputPath);
      files.push(this.fileEntry(videoOutputPath, "video"));

      // 2. Extract thumbnail (best frame from video)
      const thumbnailPath = path.join(outputDir, "thumbnail.png");
      await this.extractBestFrame(videoPath, thumbnailPath);
      files.push(this.fileEntry(thumbnailPath, "image"));

      // 3. Write SEO files
      const titlePath = path.join(outputDir, "title.txt");
      fs.writeFileSync(titlePath, seo.title, "utf-8");
      files.push(this.fileEntry(titlePath, "text"));

      const descPath = path.join(outputDir, "description.txt");
      const fullDescription = [
        seo.hook,
        "",
        seo.description,
        "",
        seo.cta,
        "",
        seo.hashtags.map((h) => `#${h}`).join(" "),
      ].join("\n");
      fs.writeFileSync(descPath, fullDescription, "utf-8");
      files.push(this.fileEntry(descPath, "text"));

      const hashtagsPath = path.join(outputDir, "hashtags.txt");
      fs.writeFileSync(
        hashtagsPath,
        seo.hashtags.map((h) => `#${h}`).join(" "),
        "utf-8"
      );
      files.push(this.fileEntry(hashtagsPath, "text"));

      // 4. Write metadata.json
      const metadata: ExportMetadata = {
        productName,
        productSlug,
        sourceUrl,
        videoFile: `${productSlug}.${this.config.app.videoFormat}`,
        thumbnailFile: "thumbnail.png",
        seo,
        imageCount: manifest.totalImages,
        exportedAt: new Date().toISOString(),
        pipeline: {
          scrapedAt: manifest.scrapedAt,
          processedAt: manifest.processedAt,
          renderedAt: new Date().toISOString(),
          exportedAt: new Date().toISOString(),
        },
      };

      const metadataPath = path.join(outputDir, "metadata.json");
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        "utf-8"
      );
      files.push(this.fileEntry(metadataPath, "json"));

      return { success: true, outputDir, files };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown export error";
      return { success: false, outputDir: "", files: [], error: message };
    }
  }

  /**
   * Extract the best frame from a video for use as thumbnail.
   * Uses ffmpeg to grab a frame from 1/3 into the video (usually a good product shot).
   */
  async extractBestFrame(
    videoPath: string,
    outputPath: string
  ): Promise<void> {
    try {
      // Get video duration
      const durationStr = execSync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`,
        { encoding: "utf-8" }
      ).trim();

      const duration = parseFloat(durationStr);
      // Grab frame at 1/3 through the video (usually a key product shot)
      const seekTime = Math.max(0.5, duration / 3);

      execSync(
        `ffmpeg -y -ss ${seekTime} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`,
        { stdio: "pipe" }
      );
    } catch {
      // Fallback: grab frame at 1 second
      try {
        execSync(
          `ffmpeg -y -ss 1 -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`,
          { stdio: "pipe" }
        );
      } catch {
        // If ffmpeg fails entirely, create a placeholder
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
   * List all exported products in the output directory.
   */
  listExports(): string[] {
    const outputDir = this.config.app.outputDir;
    if (!fs.existsSync(outputDir)) return [];

    return fs
      .readdirSync(outputDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  }

  // === Helpers ===

  private fileEntry(
    filePath: string,
    type: ExportedFile["type"]
  ): ExportedFile {
    const stats = fs.statSync(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      sizeBytes: stats.size,
      type,
    };
  }
}
