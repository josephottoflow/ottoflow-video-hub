/**
 * PIPELINE ORCHESTRATOR — Master Controller (No-AI Mode)
 */

import { SheetsClient, ProductRow } from "../sheets/client";
import { ImageProcessor } from "../ingestion/image-processor";
import { RenderAgent } from "../render/render-agent";
import { TelegramApprovalBot } from "../approval/telegram-bot";
import { Exporter } from "../export/exporter";
import { getConfig } from "../config/config";
import * as path from "path";
import * as fs from "fs";
import type { ProductVideoData } from "../../remotion/types";

export interface PipelineResult {
  productName: string;
  productSlug: string;
  success: boolean;
  videoUrl?: string;
  outputDir?: string;
  error?: string;
  timing: {
    startedAt: string;
    completedAt: string;
    durationMs: number;
  };
}

export class PipelineOrchestrator {
  private sheets: SheetsClient;
  private imageProcessor: ImageProcessor;
  private renderAgent: RenderAgent;
  private approvalBot: TelegramApprovalBot;
  private exporter: Exporter;
  private config = getConfig();

  constructor() {
    this.sheets = new SheetsClient();
    this.imageProcessor = new ImageProcessor();
    this.renderAgent = new RenderAgent();
    this.approvalBot = new TelegramApprovalBot();
    this.exporter = new Exporter();
  }

  async processAll(): Promise<PipelineResult[]> {
    await this.sheets.initializeSheet();
    const pending = await this.sheets.getPendingProducts();

    if (pending.length === 0) {
      console.log("No pending products to process.");
      return [];
    }

    console.log(`Found ${pending.length} pending product(s). Starting pipeline...`);

    const results: PipelineResult[] = [];
    for (const product of pending) {
      const result = await this.processProduct(product);
      results.push(result);
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
    console.log(`\nPipeline complete: ${succeeded} succeeded, ${failed} failed.`);

    return results;
  }

  async processProduct(product: ProductRow): Promise<PipelineResult> {
    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const productSlug = this.slugify(
      product.productName || `product-${product.rowIndex}`
    );

    try {
      await this.sheets.updateStatus(product.rowIndex, "processing");
      console.log(`[${productSlug}] Loading images from: ${product.imageFolder}`);

      const imageFolder = path.resolve(product.imageFolder);
      if (!fs.existsSync(imageFolder)) {
        throw new Error(`Image folder not found: ${imageFolder}`);
      }

      const imageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
      const imageFiles = fs.readdirSync(imageFolder)
        .filter((f) => imageExtensions.includes(path.extname(f).toLowerCase()))
        .sort()
        .map((f) => path.join(imageFolder, f));

      if (imageFiles.length === 0) {
        throw new Error(`No images found in: ${imageFolder}`);
      }

      await this.sheets.updateImageCount(product.rowIndex, imageFiles.length);
      console.log(`[${productSlug}] Found ${imageFiles.length} images.`);

      const tempDir = path.resolve(this.config.app.tempDir, productSlug);
      fs.mkdirSync(path.join(tempDir, "processed"), { recursive: true });

      const processedImages = await Promise.all(
        imageFiles.map(async (imgPath, i) => {
          const destPath = path.join(tempDir, "processed", `frame-${String(i + 1).padStart(2, "0")}.png`);
          fs.copyFileSync(imgPath, destPath);
          return destPath;
        })
      );

      // Copy images to public/ for Remotion's staticFile()
      const publicImagesDir = path.resolve("public", "content", productSlug, "images");
      fs.mkdirSync(publicImagesDir, { recursive: true });
      for (const imgPath of processedImages) {
        const destPath = path.join(publicImagesDir, path.basename(imgPath));
        fs.copyFileSync(imgPath, destPath);
      }
      console.log(`[${productSlug}] Copied ${processedImages.length} images to public/`);

      console.log(`[${productSlug}] Building video data from your info...`);

      const videoData = this.buildVideoData(
        product,
        productSlug,
        processedImages
      );

      const videoDataPath = path.join(tempDir, "video-data.json");
      fs.writeFileSync(videoDataPath, JSON.stringify(videoData, null, 2));

      await this.sheets.updateStatus(product.rowIndex, "rendering");
      console.log(`[${productSlug}] Rendering video (Remotion)...`);

      const renderResult = await this.renderAgent.render(
        productSlug,
        videoData,
        tempDir
      );

      if (!renderResult.success) {
        throw new Error(`Render failed: ${renderResult.error}`);
      }

      console.log(
        `[${productSlug}] Rendered in ${Math.round((renderResult.durationMs || 0) / 1000)}s (${Math.round((renderResult.fileSizeBytes || 0) / 1024 / 1024)}MB)`
      );

      await this.sheets.updateStatus(product.rowIndex, "approval");
      console.log(`[${productSlug}] Sending to Telegram for approval...`);

      const thumbnailPath = path.join(tempDir, "thumbnail-preview.png");
      fs.copyFileSync(processedImages[0], thumbnailPath);

      const seo = {
        title: product.productName,
        description: product.description,
        hashtags: product.hashtags.split(/[,\s]+/).filter(Boolean).map((h) => h.startsWith("#") ? h : `#${h}`),
        hook: product.productName,
        cta: "Link in bio!",
      };

      const approval = await this.approvalBot.requestApproval({
        productSlug,
        productName: product.productName,
        thumbnailPath,
        videoPath: renderResult.videoPath,
        seo,
        imageCount: imageFiles.length,
      });

      if (approval.decision === "rejected") {
        await this.sheets.updateStatus(product.rowIndex, "rejected", "Rejected via Telegram");
        console.log(`[${productSlug}] Rejected. Skipping export.`);
        return {
          productName: product.productName,
          productSlug,
          success: false,
          error: "Rejected via Telegram approval",
          timing: { startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - startTime },
        };
      }

      if (approval.decision === "timeout") {
        await this.sheets.updateStatus(product.rowIndex, "error", "Approval timed out");
        console.log(`[${productSlug}] Approval timed out. Skipping export.`);
        return {
          productName: product.productName,
          productSlug,
          success: false,
          error: "Telegram approval timed out",
          timing: { startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - startTime },
        };
      }

      console.log(`[${productSlug}] Approved! Exporting...`);

      await this.sheets.updateStatus(product.rowIndex, "exporting");

      const outputDir = path.resolve(this.config.app.outputDir, productSlug);
      fs.mkdirSync(outputDir, { recursive: true });

      const finalVideoPath = path.join(outputDir, `${productSlug}.mp4`);
      fs.copyFileSync(renderResult.videoPath!, finalVideoPath);

      fs.writeFileSync(path.join(outputDir, "title.txt"), product.productName, "utf-8");
      fs.writeFileSync(path.join(outputDir, "description.txt"), product.description, "utf-8");
      fs.writeFileSync(path.join(outputDir, "hashtags.txt"), product.hashtags, "utf-8");

      const videoUrl = `outputs/${productSlug}/${productSlug}.mp4`;
      await this.sheets.markComplete(product.rowIndex, videoUrl, imageFiles.length);
      console.log(`[${productSlug}] Pipeline complete!`);

      return {
        productName: product.productName,
        productSlug,
        success: true,
        videoUrl,
        outputDir,
        timing: { startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - startTime },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown pipeline error";
      await this.sheets.updateStatus(product.rowIndex, "error", message);
      console.error(`[${productSlug}] Pipeline failed: ${message}`);
      return {
        productName: product.productName,
        productSlug,
        success: false,
        error: message,
        timing: { startedAt, completedAt: new Date().toISOString(), durationMs: Date.now() - startTime },
      };
    }
  }

  private buildVideoData(
    product: ProductRow,
    productSlug: string,
    imagePaths: string[]
  ): ProductVideoData {
    const hashtagList = product.hashtags
      .split(/[,\s#]+/)
      .filter(Boolean);

    const relativeImagePaths = imagePaths.map(
      (p) => `content/${productSlug}/images/${path.basename(p)}`
    );

    return {
      productSlug,
      brandColors: {
        primary: "#6366f1",
        secondary: "#8b5cf6",
        accent: "#f59e0b",
        background: "#0a0a0a",
        text: "#ffffff",
      },
      hook: {
        painPointQuestion: product.description.split(".")[0] || `Check out ${product.productName}!`,
      },
      productIntro: {
        productName: product.productName,
        tagline: product.description.split(".").slice(0, 1).join(".") || product.productName,
      },
      simulatedDemo: {
        inputPlaceholder: "Search for products...",
        typedText: product.productName,
        buttonText: "Shop Now",
        resultText: `${product.productName} — Available Now!`,
        resultSubtext: hashtagList.slice(0, 3).map((h) => `#${h}`).join(" ") || "Trending on TikTok",
      },
      imageShowcase: {
        images: relativeImagePaths.slice(0, 4).map((p, i) => ({
          path: p,
          headline: i === 0 ? "Premium Quality" : i === 1 ? "Best Seller" : i === 2 ? "Top Rated" : "Must Have",
        })),
      },
      featureCallouts: {
        productImagePath: relativeImagePaths[0],
        features: [
          { icon: "check" as const, text: "Premium quality guaranteed" },
          { icon: "lightning" as const, text: "Fast shipping available" },
          { icon: "star" as const, text: "Trending on TikTok Shop" },
        ],
      },
      socialProofCta: {
        socialProofNumber: 10000,
        socialProofLabel: "happy customers",
        ctaUrl: "Link in bio ↗",
      },
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}
