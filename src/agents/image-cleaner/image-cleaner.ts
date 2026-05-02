/**
 * IMAGE CLEANING AGENT — Filters out infographic/collage images
 *
 * Analyzes product images using sharp to detect:
 *  1. Text-heavy infographics (high edge density)
 *  2. Collage/multi-product layouts (multiple distinct regions)
 *  3. White-background annotation images
 *  4. Images with excessive baked-in text overlays
 *
 * Only clean product photos pass through to the cinematic engine.
 */
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

export interface ImageScore {
  path: string;
  filename: string;
  score: number;          // 0-100, higher = cleaner product photo
  clean: boolean;         // passes threshold
  reasons: string[];      // why it was flagged
  metrics: {
    edgeDensity: number;       // 0-1, high = text/annotations
    whiteRatio: number;        // 0-1, high = infographic bg
    colorComplexity: number;   // 0-1, high = collage/multi-product
    aspectDeviation: number;   // deviation from portrait (9:16)
    uniformRegions: number;    // count of large uniform color blocks
  };
}

export interface CleaningResult {
  total: number;
  passed: number;
  rejected: number;
  images: ImageScore[];
  cleanImages: string[];      // paths of images that passed
  rejectedImages: string[];   // paths of images that failed
}

const CLEAN_THRESHOLD = 45;  // minimum score to pass

/**
 * Analyze a single image for "cleanness" — is it a real product photo
 * or a text-heavy infographic/collage?
 */
async function analyzeImage(imagePath: string): Promise<ImageScore> {
  const filename = path.basename(imagePath);
  const reasons: string[] = [];

  try {
    const img = sharp(imagePath);
    const metadata = await img.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 800;

    // ── 1. Edge Density (text/annotations create many sharp edges) ──
    // Convert to grayscale, apply Laplacian-like edge detection via sharp
    const edgeBuffer = await sharp(imagePath)
      .greyscale()
      .resize(200, 200, { fit: "fill" })
      .convolve({
        width: 3,
        height: 3,
        kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],  // Laplacian
      })
      .raw()
      .toBuffer();

    // Count pixels with high edge response (strong edges = text/lines)
    let edgePixels = 0;
    for (let i = 0; i < edgeBuffer.length; i++) {
      if (edgeBuffer[i] > 60) edgePixels++;  // threshold for "edge"
    }
    const edgeDensity = edgePixels / edgeBuffer.length;

    // ── 2. White Background Ratio ──
    // Infographic images typically have large white/near-white areas
    const colorBuffer = await sharp(imagePath)
      .resize(100, 100, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let whitePixels = 0;
    let nearWhitePixels = 0;
    const totalPixels = colorBuffer.info.width * colorBuffer.info.height;
    const channels = colorBuffer.info.channels;

    for (let i = 0; i < colorBuffer.data.length; i += channels) {
      const r = colorBuffer.data[i];
      const g = colorBuffer.data[i + 1];
      const b = colorBuffer.data[i + 2];

      // Pure white or near-white
      if (r > 240 && g > 240 && b > 240) whitePixels++;
      if (r > 220 && g > 220 && b > 220) nearWhitePixels++;
    }

    const whiteRatio = nearWhitePixels / totalPixels;

    // ── 3. Color Complexity (collages have many distinct color regions) ──
    // Quantize to 8 colors and count how spread they are
    const quantized = await sharp(imagePath)
      .resize(50, 50, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const colorBuckets = new Map<string, number>();
    const qChannels = quantized.info.channels;

    for (let i = 0; i < quantized.data.length; i += qChannels) {
      // Quantize to 4-bit per channel (16 levels)
      const rQ = Math.floor(quantized.data[i] / 16);
      const gQ = Math.floor(quantized.data[i + 1] / 16);
      const bQ = Math.floor(quantized.data[i + 2] / 16);
      const key = `${rQ}-${gQ}-${bQ}`;
      colorBuckets.set(key, (colorBuckets.get(key) || 0) + 1);
    }

    // Color complexity = how many distinct color regions exist
    const significantColors = Array.from(colorBuckets.values())
      .filter((count) => count > 5);  // at least 5 pixels of this color
    const colorComplexity = Math.min(1, significantColors.length / 40);

    // ── 4. Aspect Ratio Deviation ──
    // Portrait product photos are typically 3:4 to 9:16
    // Collages and infographics are often 1:1 or landscape
    const aspectRatio = width / height;
    const idealPortrait = 0.5625;  // 9:16
    const aspectDeviation = Math.abs(aspectRatio - idealPortrait);

    // ── 5. Uniform Region Count (detect collage grid layouts) ──
    // Split image into 4x4 grid, check variance within each cell
    const gridBuffer = await sharp(imagePath)
      .resize(80, 80, { fit: "fill" })
      .greyscale()
      .raw()
      .toBuffer();

    let uniformRegions = 0;
    const gridSize = 20;  // 80/4 = 20px per cell
    for (let gy = 0; gy < 4; gy++) {
      for (let gx = 0; gx < 4; gx++) {
        let sum = 0;
        let sumSq = 0;
        let count = 0;
        for (let y = gy * gridSize; y < (gy + 1) * gridSize; y++) {
          for (let x = gx * gridSize; x < (gx + 1) * gridSize; x++) {
            const val = gridBuffer[y * 80 + x];
            sum += val;
            sumSq += val * val;
            count++;
          }
        }
        const mean = sum / count;
        const variance = sumSq / count - mean * mean;
        if (variance < 200) uniformRegions++;  // very uniform = solid color block
      }
    }

    // ── SCORING ──
    let score = 100;

    // High edge density = text/annotations (major penalty)
    if (edgeDensity > 0.25) {
      score -= 30;
      reasons.push(`High edge density (${(edgeDensity * 100).toFixed(0)}%) — likely text overlays`);
    } else if (edgeDensity > 0.15) {
      score -= 15;
      reasons.push(`Moderate edge density (${(edgeDensity * 100).toFixed(0)}%)`);
    }

    // High white ratio = infographic background (major penalty)
    if (whiteRatio > 0.5) {
      score -= 30;
      reasons.push(`White bg ratio ${(whiteRatio * 100).toFixed(0)}% — likely infographic`);
    } else if (whiteRatio > 0.3) {
      score -= 15;
      reasons.push(`Moderate white background (${(whiteRatio * 100).toFixed(0)}%)`);
    }

    // High color complexity = collage (moderate penalty)
    if (colorComplexity > 0.7) {
      score -= 20;
      reasons.push(`High color complexity (${significantColors.length} regions) — likely collage`);
    } else if (colorComplexity > 0.5) {
      score -= 10;
      reasons.push(`Moderate color complexity (${significantColors.length} regions)`);
    }

    // Many uniform regions = grid/collage layout
    if (uniformRegions > 8) {
      score -= 15;
      reasons.push(`${uniformRegions} uniform grid regions — possible collage layout`);
    }

    // Non-portrait aspect = less cinematic
    if (aspectDeviation > 0.4) {
      score -= 10;
      reasons.push(`Wide/square aspect (${aspectRatio.toFixed(2)}) — not portrait`);
    }

    // Bonus: good portrait product photo characteristics
    if (whiteRatio < 0.15 && edgeDensity < 0.12) {
      score += 10;  // dark/lifestyle bg with clean product
    }

    score = Math.max(0, Math.min(100, score));

    return {
      path: imagePath,
      filename,
      score,
      clean: score >= CLEAN_THRESHOLD,
      reasons: reasons.length > 0 ? reasons : ["Clean product photo"],
      metrics: {
        edgeDensity,
        whiteRatio,
        colorComplexity,
        aspectDeviation,
        uniformRegions,
      },
    };
  } catch (error) {
    return {
      path: imagePath,
      filename,
      score: 0,
      clean: false,
      reasons: [`Analysis failed: ${error instanceof Error ? error.message : "unknown"}`],
      metrics: { edgeDensity: 0, whiteRatio: 0, colorComplexity: 0, aspectDeviation: 0, uniformRegions: 0 },
    };
  }
}

/**
 * Analyze and filter all images in a directory.
 * Returns only clean product photos suitable for cinematic video.
 */
export async function cleanImages(imageDir: string): Promise<CleaningResult> {
  const extensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

  const files = fs.readdirSync(imageDir)
    .filter((f) => extensions.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => path.join(imageDir, f));

  if (files.length === 0) {
    return { total: 0, passed: 0, rejected: 0, images: [], cleanImages: [], rejectedImages: [] };
  }

  console.log(`[image-cleaner] Analyzing ${files.length} images...`);

  const results: ImageScore[] = [];
  for (const file of files) {
    const result = await analyzeImage(file);
    results.push(result);

    const status = result.clean ? "✓ CLEAN" : "✗ REJECT";
    console.log(`[image-cleaner] ${status} (${result.score}/100) ${result.filename}`);
    if (!result.clean) {
      for (const reason of result.reasons) {
        console.log(`  └─ ${reason}`);
      }
    }
  }

  const cleanImages = results.filter((r) => r.clean).map((r) => r.path);
  const rejectedImages = results.filter((r) => !r.clean).map((r) => r.path);

  // If ALL images are rejected, keep the top-scoring ones anyway
  if (cleanImages.length === 0 && results.length > 0) {
    console.log(`[image-cleaner] All images rejected — keeping top ${Math.min(2, results.length)} by score`);
    const sorted = [...results].sort((a, b) => b.score - a.score);
    const rescued = sorted.slice(0, Math.min(2, sorted.length));
    for (const r of rescued) {
      r.clean = true;
      r.reasons.push("Rescued (best available)");
      cleanImages.push(r.path);
    }
  }

  console.log(`[image-cleaner] Result: ${cleanImages.length} clean / ${rejectedImages.length} rejected out of ${files.length}`);

  return {
    total: files.length,
    passed: cleanImages.length,
    rejected: rejectedImages.length,
    images: results,
    cleanImages,
    rejectedImages,
  };
}

/**
 * Clean images and copy only clean ones to a destination directory.
 * Returns the paths of copied clean images.
 */
export async function cleanAndCopy(
  sourceDir: string,
  destDir: string
): Promise<{ cleanPaths: string[]; report: CleaningResult }> {
  const report = await cleanImages(sourceDir);

  fs.mkdirSync(destDir, { recursive: true });

  const cleanPaths: string[] = [];
  for (let i = 0; i < report.cleanImages.length; i++) {
    const src = report.cleanImages[i];
    const destFilename = `frame-${String(i + 1).padStart(2, "0")}${path.extname(src)}`;
    const destPath = path.join(destDir, destFilename);
    fs.copyFileSync(src, destPath);
    cleanPaths.push(destPath);
  }

  console.log(`[image-cleaner] Copied ${cleanPaths.length} clean images to ${destDir}`);
  return { cleanPaths, report };
}
