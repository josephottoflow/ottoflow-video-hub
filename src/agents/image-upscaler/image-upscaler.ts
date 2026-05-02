/**
 * IMAGE UPSCALER + SMART RESIZE AGENT
 *
 * Handles all image preprocessing for cinematic video:
 *  1. Upscales small images to minimum 1080px width using sharp lanczos3
 *  2. Smart crop/pad to 9:16 portrait aspect ratio
 *  3. Post-upscale sharpening to recover detail
 *  4. Quality scoring to decide strategy (upscale vs crop vs pad)
 *  5. Background fill for non-portrait images (blur-fill technique)
 */
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────

export interface ResizeStrategy {
  action: "upscale" | "downscale" | "crop" | "pad" | "blur-fill" | "none";
  reason: string;
  originalWidth: number;
  originalHeight: number;
  targetWidth: number;
  targetHeight: number;
  scaleFactor: number;
}

export interface ProcessedImage {
  path: string;
  filename: string;
  originalSize: { width: number; height: number };
  finalSize: { width: number; height: number };
  strategy: ResizeStrategy;
  quality: "high" | "medium" | "low";
}

export interface UpscaleResult {
  total: number;
  processed: number;
  upscaled: number;
  cropped: number;
  padded: number;
  images: ProcessedImage[];
  outputDir: string;
}

// ─── Constants ──────────────────────────────────────────────

const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const MIN_ACCEPTABLE_WIDTH = 800;
const MAX_UPSCALE_FACTOR = 4;     // Don't upscale more than 4x
const SHARP_SIGMA = 0.8;          // Post-upscale sharpening

// ─── Strategy Decision ──────────────────────────────────────

/**
 * Decide the best resize strategy for an image based on dimensions.
 */
function decideStrategy(width: number, height: number): ResizeStrategy {
  const aspectRatio = width / height;
  const targetAspect = TARGET_WIDTH / TARGET_HEIGHT; // 0.5625 (9:16)
  const scaleFactor = TARGET_WIDTH / width;

  // Case 1: Already correct size
  if (width >= TARGET_WIDTH * 0.95 && width <= TARGET_WIDTH * 1.05 &&
      Math.abs(aspectRatio - targetAspect) < 0.05) {
    return {
      action: "none",
      reason: "Already correct size and aspect",
      originalWidth: width, originalHeight: height,
      targetWidth: TARGET_WIDTH, targetHeight: TARGET_HEIGHT,
      scaleFactor: 1,
    };
  }

  // Case 2: Too small — needs upscaling
  if (width < MIN_ACCEPTABLE_WIDTH) {
    if (scaleFactor > MAX_UPSCALE_FACTOR) {
      return {
        action: "blur-fill",
        reason: `Too small (${width}px) — upscale ${scaleFactor.toFixed(1)}x exceeds max, using blur-fill`,
        originalWidth: width, originalHeight: height,
        targetWidth: TARGET_WIDTH, targetHeight: TARGET_HEIGHT,
        scaleFactor: Math.min(scaleFactor, MAX_UPSCALE_FACTOR),
      };
    }
    return {
      action: "upscale",
      reason: `Small image (${width}px) — upscaling ${scaleFactor.toFixed(1)}x with lanczos3`,
      originalWidth: width, originalHeight: height,
      targetWidth: TARGET_WIDTH, targetHeight: TARGET_HEIGHT,
      scaleFactor,
    };
  }

  // Case 3: Moderate size but wrong aspect — smart crop or pad
  if (width >= MIN_ACCEPTABLE_WIDTH && width < TARGET_WIDTH) {
    if (aspectRatio > targetAspect * 1.3) {
      // Wide/landscape — crop sides and upscale
      return {
        action: "crop",
        reason: `Landscape (${aspectRatio.toFixed(2)}) — center crop to portrait then upscale`,
        originalWidth: width, originalHeight: height,
        targetWidth: TARGET_WIDTH, targetHeight: TARGET_HEIGHT,
        scaleFactor,
      };
    }
    return {
      action: "upscale",
      reason: `Medium image (${width}px) — upscaling ${scaleFactor.toFixed(1)}x`,
      originalWidth: width, originalHeight: height,
      targetWidth: TARGET_WIDTH, targetHeight: TARGET_HEIGHT,
      scaleFactor,
    };
  }

  // Case 4: Large enough but wrong aspect
  if (width >= TARGET_WIDTH) {
    if (aspectRatio > targetAspect * 1.3) {
      return {
        action: "crop",
        reason: `Large landscape (${width}px, ${aspectRatio.toFixed(2)}) — center crop to portrait`,
        originalWidth: width, originalHeight: height,
        targetWidth: TARGET_WIDTH, targetHeight: TARGET_HEIGHT,
        scaleFactor: 1,
      };
    }
    return {
      action: "downscale",
      reason: `Large image (${width}px) — downscaling to ${TARGET_WIDTH}px`,
      originalWidth: width, originalHeight: height,
      targetWidth: TARGET_WIDTH, targetHeight: TARGET_HEIGHT,
      scaleFactor,
    };
  }

  return {
    action: "upscale",
    reason: "Default — upscale to target",
    originalWidth: width, originalHeight: height,
    targetWidth: TARGET_WIDTH, targetHeight: TARGET_HEIGHT,
    scaleFactor,
  };
}

// ─── Image Processing Functions ─────────────────────────────

/**
 * Upscale image using lanczos3 with post-sharpening
 */
async function upscaleImage(inputPath: string, outputPath: string, strategy: ResizeStrategy): Promise<void> {
  await sharp(inputPath)
    .resize(strategy.targetWidth, strategy.targetHeight, {
      fit: "contain",
      background: { r: 10, g: 10, b: 15, alpha: 1 }, // Dark bg matching #0B0B0F
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: SHARP_SIGMA, m1: 1.0, m2: 0.7 })
    .png({ quality: 95 })
    .toFile(outputPath);
}

/**
 * Downscale a large image to target
 */
async function downscaleImage(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: "contain",
      background: { r: 10, g: 10, b: 15, alpha: 1 },
      kernel: sharp.kernel.lanczos3,
    })
    .png({ quality: 95 })
    .toFile(outputPath);
}

/**
 * Smart crop: extract center portrait region from landscape
 */
async function cropImage(inputPath: string, outputPath: string, strategy: ResizeStrategy): Promise<void> {
  const { originalWidth, originalHeight } = strategy;
  // Calculate the widest portrait crop we can get
  const cropWidth = Math.floor(originalHeight * (TARGET_WIDTH / TARGET_HEIGHT));
  const cropLeft = Math.floor((originalWidth - cropWidth) / 2);

  await sharp(inputPath)
    .extract({
      left: Math.max(0, cropLeft),
      top: 0,
      width: Math.min(cropWidth, originalWidth),
      height: originalHeight,
    })
    .resize(TARGET_WIDTH, TARGET_HEIGHT, {
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
    })
    .sharpen({ sigma: SHARP_SIGMA })
    .png({ quality: 95 })
    .toFile(outputPath);
}

/**
 * Blur-fill: center the small product image on a blurred+zoomed version of itself
 * Creates a professional "floating product" look even from tiny images
 */
async function blurFillImage(inputPath: string, outputPath: string, strategy: ResizeStrategy): Promise<void> {
  // 1. Create blurred background at full target size
  const bgBuffer = await sharp(inputPath)
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover", kernel: sharp.kernel.lanczos3 })
    .blur(40)
    .modulate({ brightness: 0.3 }) // Darken significantly
    .toBuffer();

  // 2. Upscale the product image (up to MAX_UPSCALE_FACTOR)
  const productWidth = Math.min(
    Math.floor(strategy.originalWidth * MAX_UPSCALE_FACTOR),
    Math.floor(TARGET_WIDTH * 0.75) // Max 75% of frame width
  );
  const productHeight = Math.floor(
    productWidth * (strategy.originalHeight / strategy.originalWidth)
  );

  const productBuffer = await sharp(inputPath)
    .resize(productWidth, productHeight, { fit: "inside", kernel: sharp.kernel.lanczos3 })
    .sharpen({ sigma: 1.0 })
    .toBuffer();

  const productMeta = await sharp(productBuffer).metadata();
  const pW = productMeta.width || productWidth;
  const pH = productMeta.height || productHeight;

  // 3. Composite: product centered on blurred bg
  await sharp(bgBuffer)
    .composite([{
      input: productBuffer,
      left: Math.floor((TARGET_WIDTH - pW) / 2),
      top: Math.floor((TARGET_HEIGHT - pH) / 2) - 100, // Slightly above center
    }])
    .png({ quality: 95 })
    .toFile(outputPath);
}

// ─── Quality Assessment ─────────────────────────────────────

function assessQuality(strategy: ResizeStrategy): "high" | "medium" | "low" {
  if (strategy.action === "none" || strategy.action === "downscale") return "high";
  if (strategy.scaleFactor <= 1.5) return "high";
  if (strategy.scaleFactor <= 2.5) return "medium";
  return "low";
}

// ─── Main Functions ─────────────────────────────────────────

/**
 * Process a single image — analyze, decide strategy, and resize.
 */
export async function processImage(
  inputPath: string,
  outputDir: string,
  index: number,
): Promise<ProcessedImage> {
  const filename = path.basename(inputPath);
  const metadata = await sharp(inputPath).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  const strategy = decideStrategy(width, height);
  const quality = assessQuality(strategy);

  const outputFilename = `frame-${String(index + 1).padStart(2, "0")}${path.extname(inputPath)}`;
  const outputPath = path.join(outputDir, outputFilename);

  console.log(`[upscaler] ${filename} (${width}x${height}) → ${strategy.action}: ${strategy.reason}`);

  switch (strategy.action) {
    case "upscale":
      await upscaleImage(inputPath, outputPath, strategy);
      break;
    case "downscale":
      await downscaleImage(inputPath, outputPath);
      break;
    case "crop":
      await cropImage(inputPath, outputPath, strategy);
      break;
    case "blur-fill":
      await blurFillImage(inputPath, outputPath, strategy);
      break;
    case "none":
      fs.copyFileSync(inputPath, outputPath);
      break;
    default:
      await upscaleImage(inputPath, outputPath, strategy);
  }

  // Read final dimensions
  const finalMeta = await sharp(outputPath).metadata();

  return {
    path: outputPath,
    filename: outputFilename,
    originalSize: { width, height },
    finalSize: { width: finalMeta.width || TARGET_WIDTH, height: finalMeta.height || TARGET_HEIGHT },
    strategy,
    quality,
  };
}

/**
 * Process all images in a directory — upscale, resize, and output to destination.
 */
export async function upscaleImages(
  sourceDir: string,
  outputDir: string,
): Promise<UpscaleResult> {
  const extensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

  const files = fs.readdirSync(sourceDir)
    .filter((f) => extensions.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => path.join(sourceDir, f));

  if (files.length === 0) {
    return { total: 0, processed: 0, upscaled: 0, cropped: 0, padded: 0, images: [], outputDir };
  }

  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`[upscaler] Processing ${files.length} images → ${outputDir}`);

  const images: ProcessedImage[] = [];
  let upscaled = 0;
  let cropped = 0;
  let padded = 0;

  for (let i = 0; i < files.length; i++) {
    const result = await processImage(files[i], outputDir, i);
    images.push(result);

    if (result.strategy.action === "upscale") upscaled++;
    if (result.strategy.action === "crop") cropped++;
    if (result.strategy.action === "blur-fill") padded++;
  }

  console.log(`[upscaler] Done: ${upscaled} upscaled, ${cropped} cropped, ${padded} blur-filled out of ${files.length}`);

  return {
    total: files.length,
    processed: images.length,
    upscaled,
    cropped,
    padded,
    images,
    outputDir,
  };
}

/**
 * Smart pipeline: clean → upscale → output ready-for-render images.
 * Combines image-cleaner + upscaler in one call.
 */
export async function smartPrepare(
  sourceDir: string,
  outputDir: string,
): Promise<UpscaleResult> {
  // Import cleaner dynamically to avoid circular deps
  const { cleanImages } = await import("../image-cleaner/image-cleaner");

  // Step 1: Clean — remove infographics and text-heavy images
  console.log(`[smart-prepare] Step 1: Cleaning images in ${sourceDir}...`);
  const cleanResult = await cleanImages(sourceDir);
  console.log(`[smart-prepare] Cleaning: ${cleanResult.passed} clean / ${cleanResult.rejected} rejected`);

  // Step 2: Write clean images to temp dir, then upscale
  const tempCleanDir = path.join(outputDir, ".clean-temp");
  fs.mkdirSync(tempCleanDir, { recursive: true });

  // Copy clean images to temp
  for (const cleanPath of cleanResult.cleanImages) {
    const dest = path.join(tempCleanDir, path.basename(cleanPath));
    fs.copyFileSync(cleanPath, dest);
  }

  // Step 3: Upscale cleaned images
  console.log(`[smart-prepare] Step 2: Upscaling ${cleanResult.cleanImages.length} clean images...`);
  const result = await upscaleImages(tempCleanDir, outputDir);

  // Cleanup temp
  try {
    fs.rmSync(tempCleanDir, { recursive: true });
  } catch { /* ignore */ }

  return result;
}
