/**
 * INGESTION AGENT — Image Processor & Manifest Builder
 * Takes scraped product photos and prepares them for the
 * video pipeline: resize, optimize, validate, and build
 * a manifest file that the Prompt Engine consumes.
 */

import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { getConfig } from "../config/config";

// === Types ===

export interface ImageManifest {
  productName: string;
  productSlug: string;
  sourceUrl: string;
  scrapedAt: string;
  images: ProcessedImage[];
  totalImages: number;
  processedAt: string;
}

export interface ProcessedImage {
  index: number;
  originalPath: string;
  processedPath: string;
  width: number;
  height: number;
  aspectRatio: number;
  sizeBytes: number;
  format: string;
  dominantColor: string;
}

export interface ProcessingOptions {
  targetWidth?: number;
  targetHeight?: number;
  quality?: number;
  format?: "png" | "jpeg" | "webp";
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

// === Image Processor ===

export class ImageProcessor {
  private config = getConfig();
  private defaultOptions: Required<ProcessingOptions>;

  constructor() {
    this.defaultOptions = {
      targetWidth: this.config.app.videoWidth,
      targetHeight: this.config.app.videoHeight,
      quality: 90,
      format: "png",
      fit: "cover",
    };
  }

  /**
   * Process all images in a product directory and build a manifest.
   */
  async processProductImages(
    imagesDir: string,
    productName: string,
    productSlug: string,
    sourceUrl: string,
    scrapedAt: string,
    options?: ProcessingOptions
  ): Promise<ImageManifest> {
    const opts = { ...this.defaultOptions, ...options };

    // Find all image files in the directory
    const imageFiles = this.findImageFiles(imagesDir);

    if (imageFiles.length === 0) {
      throw new Error(`No image files found in ${imagesDir}`);
    }

    // Create processed output directory
    const processedDir = path.join(path.dirname(imagesDir), "processed");
    fs.mkdirSync(processedDir, { recursive: true });

    // Process each image
    const processedImages: ProcessedImage[] = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const imagePath = imageFiles[i];
      const processed = await this.processImage(
        imagePath,
        processedDir,
        i,
        opts
      );
      processedImages.push(processed);
    }

    // Build manifest
    const manifest: ImageManifest = {
      productName,
      productSlug,
      sourceUrl,
      scrapedAt,
      images: processedImages,
      totalImages: processedImages.length,
      processedAt: new Date().toISOString(),
    };

    // Save manifest to disk
    const manifestPath = path.join(
      path.dirname(imagesDir),
      "manifest.json"
    );
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    return manifest;
  }

  /**
   * Process a single image: resize, optimize, extract metadata.
   */
  private async processImage(
    inputPath: string,
    outputDir: string,
    index: number,
    options: Required<ProcessingOptions>
  ): Promise<ProcessedImage> {
    const filename = `frame-${String(index + 1).padStart(2, "0")}.${options.format}`;
    const outputPath = path.join(outputDir, filename);

    // Read metadata from original
    const metadata = await sharp(inputPath).metadata();

    // Resize and optimize for video
    let pipeline = sharp(inputPath)
      .resize(options.targetWidth, options.targetHeight, {
        fit: options.fit,
        position: "center",
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      });

    // Output format
    switch (options.format) {
      case "png":
        pipeline = pipeline.png({ quality: options.quality });
        break;
      case "jpeg":
        pipeline = pipeline.jpeg({ quality: options.quality });
        break;
      case "webp":
        pipeline = pipeline.webp({ quality: options.quality });
        break;
    }

    await pipeline.toFile(outputPath);

    // Get processed file stats
    const stats = fs.statSync(outputPath);

    // Extract dominant color for background fills
    const dominantColor = await this.extractDominantColor(inputPath);

    return {
      index,
      originalPath: inputPath,
      processedPath: outputPath,
      width: options.targetWidth,
      height: options.targetHeight,
      aspectRatio: options.targetWidth / options.targetHeight,
      sizeBytes: stats.size,
      format: options.format,
      dominantColor,
    };
  }

  /**
   * Extract the dominant color from an image (for background fills).
   */
  private async extractDominantColor(imagePath: string): Promise<string> {
    try {
      const { dominant } = await sharp(imagePath)
        .resize(1, 1, { fit: "cover" })
        .raw()
        .toBuffer({ resolveWithObject: true })
        .then(({ data }) => ({
          dominant: `#${data[0].toString(16).padStart(2, "0")}${data[1].toString(16).padStart(2, "0")}${data[2].toString(16).padStart(2, "0")}`,
        }));
      return dominant;
    } catch {
      return "#000000";
    }
  }

  /**
   * Validate that an image meets minimum requirements for video.
   */
  async validateImage(imagePath: string): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      const metadata = await sharp(imagePath).metadata();

      if (!metadata.width || !metadata.height) {
        return { valid: false, reason: "Cannot read image dimensions" };
      }

      if (metadata.width < 200 || metadata.height < 200) {
        return {
          valid: false,
          reason: `Image too small: ${metadata.width}x${metadata.height} (min 200x200)`,
        };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: "Cannot read image file" };
    }
  }

  /**
   * Find all image files in a directory.
   */
  private findImageFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const extensions = [".jpg", ".jpeg", ".png", ".webp"];
    return fs
      .readdirSync(dir)
      .filter((file) =>
        extensions.includes(path.extname(file).toLowerCase())
      )
      .sort()
      .map((file) => path.join(dir, file));
  }

  /**
   * Create a collage thumbnail from multiple product images.
   */
  async createCollage(
    imagePaths: string[],
    outputPath: string,
    width: number = 1080,
    height: number = 1920
  ): Promise<void> {
    if (imagePaths.length === 0) {
      throw new Error("No images provided for collage");
    }

    // Use the first image as the main image
    const mainImage = imagePaths[0];

    await sharp(mainImage)
      .resize(width, height, { fit: "cover", position: "center" })
      .png({ quality: 90 })
      .toFile(outputPath);
  }
}
