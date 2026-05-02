/**
 * REVIEW AGENT — Automated render quality checker
 *
 * Analyzes rendered video frames for quality issues:
 *  1. Black/blank screen detection
 *  2. Image visibility (not too dark/too bright)
 *  3. Text readability (contrast check)
 *  4. Scene transition smoothness
 *  5. Overall quality scoring (0-100)
 *  6. Per-scene breakdown with actionable feedback
 *
 * Can check:
 *  - Extracted frames from rendered video (ffmpeg screenshots)
 *  - Individual scene images before render
 *  - Full pipeline data quality
 */
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────

export interface FrameAnalysis {
  framePath: string;
  frameNumber: number;
  scene: string;
  timestamp: string;
  metrics: {
    brightness: number;       // 0-255 average
    contrast: number;         // standard deviation of luminance
    blackPixelRatio: number;  // % of near-black pixels
    whitePixelRatio: number;  // % of near-white pixels
    colorVariance: number;    // how diverse colors are
    edgeDensity: number;      // text/detail presence
  };
  issues: QualityIssue[];
  score: number;              // 0-100
}

export interface QualityIssue {
  severity: "critical" | "warning" | "info";
  type: string;
  message: string;
  suggestion: string;
}

export interface ReviewReport {
  videoPath?: string;
  totalFrames: number;
  overallScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  scenes: SceneReport[];
  issues: QualityIssue[];
  summary: string;
}

export interface SceneReport {
  name: string;
  frameRange: string;
  avgBrightness: number;
  avgContrast: number;
  score: number;
  issues: QualityIssue[];
}

// ─── Constants ──────────────────────────────────────────────

const SCENE_MAP = [
  { name: "Hook", startSec: 0, endSec: 2 },
  { name: "Problem", startSec: 2, endSec: 5 },
  { name: "Hero", startSec: 5, endSec: 10 },
  { name: "Features", startSec: 10, endSec: 20 },
  { name: "Proof", startSec: 20, endSec: 25 },
  { name: "CTA", startSec: 25, endSec: 28 },
];

// ─── Frame Analysis ─────────────────────────────────────────

/**
 * Analyze a single video frame for quality metrics.
 */
async function analyzeFrame(framePath: string, frameNumber: number): Promise<FrameAnalysis> {
  const issues: QualityIssue[] = [];

  // Determine which scene this frame belongs to
  const timestamp = frameNumber / 30; // 30fps
  const scene = SCENE_MAP.find((s) => timestamp >= s.startSec && timestamp < s.endSec)?.name || "Unknown";

  try {
    // Resize to 200x200 for fast analysis
    const raw = await sharp(framePath)
      .resize(200, 200, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = raw.data;
    const channels = raw.info.channels;
    const totalPixels = raw.info.width * raw.info.height;

    // Calculate metrics
    let sumLum = 0;
    let blackCount = 0;
    let whiteCount = 0;
    const lumValues: number[] = [];

    for (let i = 0; i < pixels.length; i += channels) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      lumValues.push(lum);
      sumLum += lum;
      if (lum < 10) blackCount++;
      if (lum > 245) whiteCount++;
    }

    const brightness = sumLum / totalPixels;
    const blackPixelRatio = blackCount / totalPixels;
    const whitePixelRatio = whiteCount / totalPixels;

    // Contrast = standard deviation of luminance
    const meanLum = brightness;
    const variance = lumValues.reduce((sum, v) => sum + (v - meanLum) ** 2, 0) / lumValues.length;
    const contrast = Math.sqrt(variance);

    // Color variance — quantize and count unique colors
    const colorBuckets = new Set<string>();
    for (let i = 0; i < pixels.length; i += channels) {
      const rQ = Math.floor(pixels[i] / 32);
      const gQ = Math.floor(pixels[i + 1] / 32);
      const bQ = Math.floor(pixels[i + 2] / 32);
      colorBuckets.add(`${rQ}-${gQ}-${bQ}`);
    }
    const colorVariance = colorBuckets.size / 512; // normalize to 0-1 range

    // Edge density for text detection
    const edgeBuffer = await sharp(framePath)
      .greyscale()
      .resize(100, 100, { fit: "fill" })
      .convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
      .raw()
      .toBuffer();

    let edgePixels = 0;
    for (let i = 0; i < edgeBuffer.length; i++) {
      if (edgeBuffer[i] > 50) edgePixels++;
    }
    const edgeDensity = edgePixels / edgeBuffer.length;

    // ─── Issue Detection ──────────────────────────────────────

    // Black screen
    if (blackPixelRatio > 0.85) {
      issues.push({
        severity: "critical",
        type: "black_screen",
        message: `Frame is ${(blackPixelRatio * 100).toFixed(0)}% black — likely blank/invisible`,
        suggestion: "Check overlay opacity, background loading, and image paths",
      });
    } else if (blackPixelRatio > 0.6) {
      issues.push({
        severity: "warning",
        type: "too_dark",
        message: `Frame is very dark (${(blackPixelRatio * 100).toFixed(0)}% black pixels)`,
        suggestion: "Reduce overlay opacity or increase lighting",
      });
    }

    // Too bright / washed out
    if (whitePixelRatio > 0.5) {
      issues.push({
        severity: "warning",
        type: "too_bright",
        message: `Frame is washed out (${(whitePixelRatio * 100).toFixed(0)}% white pixels)`,
        suggestion: "Check if infographic images slipped through the cleaner",
      });
    }

    // Low contrast
    if (contrast < 15) {
      issues.push({
        severity: "warning",
        type: "low_contrast",
        message: `Very low contrast (${contrast.toFixed(1)}) — text may be unreadable`,
        suggestion: "Increase text shadow or add background gradient behind text",
      });
    }

    // No visual content (flat color)
    if (colorVariance < 0.02) {
      issues.push({
        severity: "critical",
        type: "no_content",
        message: "Frame appears to be a flat solid color — no product visible",
        suggestion: "Check image loading and scene rendering",
      });
    }

    // No text/edges in scenes that should have text
    if (edgeDensity < 0.02 && (scene === "Hook" || scene === "CTA")) {
      issues.push({
        severity: "info",
        type: "missing_text",
        message: `Low edge density in ${scene} — text may not be rendering`,
        suggestion: "Verify TextBlock component is receiving textConfig",
      });
    }

    // Scoring
    let score = 100;
    if (blackPixelRatio > 0.85) score -= 40;
    else if (blackPixelRatio > 0.6) score -= 20;
    if (whitePixelRatio > 0.5) score -= 20;
    if (contrast < 15) score -= 15;
    if (colorVariance < 0.02) score -= 30;
    if (brightness < 20) score -= 15;
    if (brightness > 230) score -= 10;

    // Bonus for good cinematic look
    if (brightness >= 40 && brightness <= 140 && contrast >= 40) score += 5;
    score = Math.max(0, Math.min(100, score));

    return {
      framePath,
      frameNumber,
      scene,
      timestamp: `${Math.floor(timestamp)}s`,
      metrics: { brightness, contrast, blackPixelRatio, whitePixelRatio, colorVariance, edgeDensity },
      issues,
      score,
    };
  } catch (error) {
    return {
      framePath,
      frameNumber,
      scene,
      timestamp: `${Math.floor(timestamp / 30)}s`,
      metrics: { brightness: 0, contrast: 0, blackPixelRatio: 1, whitePixelRatio: 0, colorVariance: 0, edgeDensity: 0 },
      issues: [{
        severity: "critical",
        type: "analysis_failed",
        message: `Frame analysis failed: ${error instanceof Error ? error.message : "unknown"}`,
        suggestion: "Check frame file integrity",
      }],
      score: 0,
    };
  }
}

// ─── Video Review ───────────────────────────────────────────

/**
 * Review a directory of extracted video frames.
 * Extract frames first with: ffmpeg -i video.mp4 -vf "fps=2" frames/frame_%04d.png
 */
export async function reviewFrames(framesDir: string): Promise<ReviewReport> {
  const extensions = new Set([".png", ".jpg", ".jpeg"]);
  const frameFiles = fs.readdirSync(framesDir)
    .filter((f) => extensions.has(path.extname(f).toLowerCase()))
    .sort()
    .map((f) => path.join(framesDir, f));

  if (frameFiles.length === 0) {
    return {
      totalFrames: 0,
      overallScore: 0,
      grade: "F",
      scenes: [],
      issues: [{ severity: "critical", type: "no_frames", message: "No frames found", suggestion: "Extract frames with ffmpeg first" }],
      summary: "No frames to review.",
    };
  }

  console.log(`[review] Analyzing ${frameFiles.length} frames...`);

  const analyses: FrameAnalysis[] = [];
  for (let i = 0; i < frameFiles.length; i++) {
    const analysis = await analyzeFrame(frameFiles[i], i * 15); // Assume 2fps extraction = every 15 frames
    analyses.push(analysis);
    const icon = analysis.score >= 70 ? "✓" : analysis.score >= 40 ? "⚠" : "✗";
    console.log(`[review] ${icon} Frame ${i + 1} (${analysis.scene}, ${analysis.timestamp}): ${analysis.score}/100`);
  }

  // Build per-scene reports
  const sceneReports: SceneReport[] = SCENE_MAP.map((sceneInfo) => {
    const sceneFrames = analyses.filter((a) => a.scene === sceneInfo.name);
    if (sceneFrames.length === 0) {
      return {
        name: sceneInfo.name,
        frameRange: `${sceneInfo.startSec}s-${sceneInfo.endSec}s`,
        avgBrightness: 0,
        avgContrast: 0,
        score: 0,
        issues: [{ severity: "info" as const, type: "no_frames", message: "No frames captured for this scene", suggestion: "Increase frame extraction rate" }],
      };
    }

    const avgBrightness = sceneFrames.reduce((s, f) => s + f.metrics.brightness, 0) / sceneFrames.length;
    const avgContrast = sceneFrames.reduce((s, f) => s + f.metrics.contrast, 0) / sceneFrames.length;
    const avgScore = sceneFrames.reduce((s, f) => s + f.score, 0) / sceneFrames.length;
    const allIssues = sceneFrames.flatMap((f) => f.issues);

    // Deduplicate issues by type
    const uniqueIssues = Array.from(
      new Map(allIssues.map((i) => [i.type, i])).values()
    );

    return {
      name: sceneInfo.name,
      frameRange: `${sceneInfo.startSec}s-${sceneInfo.endSec}s`,
      avgBrightness: Math.round(avgBrightness),
      avgContrast: Math.round(avgContrast),
      score: Math.round(avgScore),
      issues: uniqueIssues,
    };
  });

  // Overall metrics
  const overallScore = Math.round(analyses.reduce((s, a) => s + a.score, 0) / analyses.length);
  const allIssues = analyses.flatMap((a) => a.issues);
  const criticalCount = allIssues.filter((i) => i.severity === "critical").length;
  const warningCount = allIssues.filter((i) => i.severity === "warning").length;

  // Grade
  let grade: "A" | "B" | "C" | "D" | "F";
  if (overallScore >= 85 && criticalCount === 0) grade = "A";
  else if (overallScore >= 70 && criticalCount <= 1) grade = "B";
  else if (overallScore >= 50) grade = "C";
  else if (overallScore >= 30) grade = "D";
  else grade = "F";

  // Deduplicate global issues
  const uniqueGlobalIssues = Array.from(
    new Map(allIssues.map((i) => [i.type + i.message, i])).values()
  );

  // Summary
  const summary = [
    `Review complete: ${grade} grade (${overallScore}/100)`,
    `${analyses.length} frames analyzed across ${sceneReports.filter((s) => s.score > 0).length} scenes`,
    criticalCount > 0 ? `⚠ ${criticalCount} critical issues found` : "✓ No critical issues",
    warningCount > 0 ? `${warningCount} warnings` : "",
    ...sceneReports.filter((s) => s.score > 0).map((s) => `  ${s.name}: ${s.score}/100`),
  ].filter(Boolean).join("\n");

  console.log(`\n[review] ${summary}`);

  return {
    totalFrames: analyses.length,
    overallScore,
    grade,
    scenes: sceneReports,
    issues: uniqueGlobalIssues,
    summary,
  };
}

/**
 * Quick pre-render check: validate source images are suitable for video.
 */
export async function preRenderCheck(imageDir: string): Promise<{
  pass: boolean;
  issues: QualityIssue[];
  recommendations: string[];
}> {
  const extensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
  const files = fs.readdirSync(imageDir)
    .filter((f) => extensions.has(path.extname(f).toLowerCase()))
    .map((f) => path.join(imageDir, f));

  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];

  if (files.length === 0) {
    issues.push({ severity: "critical", type: "no_images", message: "No images found", suggestion: "Add product images to the folder" });
    return { pass: false, issues, recommendations };
  }

  if (files.length < 3) {
    issues.push({ severity: "warning", type: "few_images", message: `Only ${files.length} images — need 3+ for feature carousel`, suggestion: "Add more product angles" });
  }

  for (const file of files) {
    const meta = await sharp(file).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;

    if (w < 400 || h < 400) {
      issues.push({
        severity: "critical",
        type: "tiny_image",
        message: `${path.basename(file)} is ${w}x${h} — too small even for upscaling`,
        suggestion: "Replace with higher resolution source image",
      });
    } else if (w < 800) {
      issues.push({
        severity: "warning",
        type: "small_image",
        message: `${path.basename(file)} is ${w}x${h} — will need upscaling`,
        suggestion: "Image upscaler will handle this but quality may suffer",
      });
      recommendations.push(`Run upscaler on ${path.basename(file)} (${w}x${h})`);
    }

    // Check aspect ratio
    const aspect = w / h;
    if (aspect > 1.5) {
      recommendations.push(`${path.basename(file)} is landscape (${aspect.toFixed(2)}) — will be center-cropped`);
    }
  }

  const pass = issues.filter((i) => i.severity === "critical").length === 0;
  return { pass, issues, recommendations };
}
