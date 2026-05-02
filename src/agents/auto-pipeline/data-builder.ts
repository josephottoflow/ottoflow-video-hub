/**
 * DATA BUILDER — Auto-generates ProductVideoData from folder contents
 * Reads images + optional config.json, produces render-ready data.
 */
import * as fs from "fs";
import * as path from "path";
import { detectImages, generateHeadlines } from "./image-detector";
import { PexelsClient } from "../pexels/pexels-client";
import { cleanImages } from "../image-cleaner/image-cleaner";
import type { ProductVideoData } from "../../remotion/types";

interface FolderConfig {
  productName?: string;
  tagline?: string;
  hookText?: string;
  features?: string[];
  proofNumber?: number;
  proofLabel?: string;
  ctaText?: string;
  hashtags?: string[];
  colors?: { primary?: string; secondary?: string; accent?: string; background?: string; text?: string };
  templates?: string[];
  /** Pexels background style: dark, light, abstract, lifestyle. Default: dark */
  bgStyle?: "dark" | "light" | "abstract" | "lifestyle";
  /** Number of background photos to fetch. Default: 3 */
  bgPhotoCount?: number;
  /** Number of background videos to fetch. Default: 1 */
  bgVideoCount?: number;
  /** Set to false to skip Pexels fetch entirely */
  fetchBackgrounds?: boolean;
}

export interface AutoBuildResult {
  slug: string;
  productName: string;
  videoData: ProductVideoData;
  templates: string[];
  imageCount: number;
  sourcePath: string;
}

// Convert folder name to display name
function folderToName(folder: string): string {
  return folder
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// Convert folder name to slug
function folderToSlug(folder: string): string {
  return folder
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Default color palettes that rotate per product
const COLOR_PALETTES = [
  { primary: "#d97706", secondary: "#92400e", accent: "#f59e0b" },
  { primary: "#6366f1", secondary: "#4f46e5", accent: "#818cf8" },
  { primary: "#dc2626", secondary: "#991b1b", accent: "#f87171" },
  { primary: "#059669", secondary: "#047857", accent: "#34d399" },
  { primary: "#7c3aed", secondary: "#6d28d9", accent: "#a78bfa" },
  { primary: "#0891b2", secondary: "#0e7490", accent: "#22d3ee" },
];

// Default feature sets
const DEFAULT_FEATURES = [
  { icon: "check" as const, text: "Premium quality guaranteed" },
  { icon: "lightning" as const, text: "Fast shipping available" },
  { icon: "star" as const, text: "Top rated by customers" },
];

// Available templates
const ALL_TEMPLATES = ["product-demo", "unboxing", "before-after", "cinematic"];

export async function buildFromFolder(folderPath: string): Promise<AutoBuildResult> {
  const folderName = path.basename(folderPath);
  const slug = folderToSlug(folderName);

  // Read optional config
  let config: FolderConfig = {};
  const configPath = path.join(folderPath, "config.json");
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      console.log(`[auto] Found config.json for ${folderName}`);
    } catch {
      console.warn(`[auto] Invalid config.json in ${folderName}, using defaults`);
    }
  }

  // Detect images
  const rawImages = detectImages(folderPath);

  // ── Image Cleaning: filter out infographics and text-heavy images ──
  let cleanGallery: string[];
  try {
    const cleanResult = await cleanImages(folderPath);
    cleanGallery = cleanResult.cleanImages;
    console.log(`[auto] Image cleaner: ${cleanResult.passed} clean / ${cleanResult.rejected} rejected`);
  } catch (err) {
    console.warn(`[auto] Image cleaner failed, using all images:`, err instanceof Error ? err.message : err);
    cleanGallery = rawImages.gallery;
  }

  // Use cleaned images (or fall back to all if cleaner failed)
  const images = {
    ...rawImages,
    gallery: cleanGallery.length > 0 ? cleanGallery : rawImages.gallery,
    hero: cleanGallery.length > 0 ? cleanGallery[0] : rawImages.hero,
    total: cleanGallery.length > 0 ? cleanGallery.length : rawImages.total,
  };

  // Build product name
  const productName = config.productName || folderToName(folderName);

  // Pick color palette (deterministic based on slug)
  const paletteIndex = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COLOR_PALETTES.length;
  const palette = COLOR_PALETTES[paletteIndex];

  // Copy clean images to public directory for Remotion
  const publicDir = path.resolve("public", "content", slug, "images");
  fs.mkdirSync(publicDir, { recursive: true });

  const publicImages: { path: string; headline: string }[] = [];
  const headlines = generateHeadlines(images.total, productName);

  images.gallery.forEach((srcPath, i) => {
    const fileName = `${String(i + 1).padStart(2, "0")}-${path.basename(srcPath)}`;
    const destPath = path.join(publicDir, fileName);
    fs.copyFileSync(srcPath, destPath);
    publicImages.push({
      path: `content/${slug}/images/${fileName}`,
      headline: headlines[i],
    });
  });

  const heroPath = publicImages.length > 0 ? publicImages[0].path : "";

  // Build features
  const features = config.features
    ? config.features.map((text, i) => ({
        icon: (["check", "lightning", "star", "shield", "zap"] as const)[i % 5],
        text,
      }))
    : DEFAULT_FEATURES;

  // Build hashtags
  const hashtags = config.hashtags || [
    slug.replace(/-/g, ""),
    "trending",
    "musthave",
    "viral",
  ];

  // --- Fetch Pexels backgrounds ---
  let backgrounds: { photos: string[]; videos: string[] } = { photos: [], videos: [] };
  const shouldFetch = config.fetchBackgrounds !== false && !!process.env.PEXELS_API_KEY;

  if (shouldFetch) {
    try {
      const pexels = new PexelsClient();
      const result = await pexels.fetchProductBackgrounds(productName, slug, {
        photoCount: config.bgPhotoCount ?? 3,
        videoCount: config.bgVideoCount ?? 1,
        style: config.bgStyle ?? "dark",
      });
      // Convert absolute paths to public-relative paths for Remotion
      backgrounds = {
        photos: result.photos.map((p) => {
          const rel = path.relative(path.resolve("public"), p).replace(/\\/g, "/");
          return rel;
        }),
        videos: result.videos.map((p) => {
          const rel = path.relative(path.resolve("public"), p).replace(/\\/g, "/");
          return rel;
        }),
      };
    } catch (err) {
      console.warn(`[auto] Pexels fetch failed for ${productName}:`, err instanceof Error ? err.message : err);
    }
  } else if (!process.env.PEXELS_API_KEY) {
    console.log(`[auto] Skipping Pexels (no API key)`);
  }

  // Build video data
  const videoData: ProductVideoData = {
    productSlug: slug,
    brandColors: {
      primary: config.colors?.primary || palette.primary,
      secondary: config.colors?.secondary || palette.secondary,
      accent: config.colors?.accent || palette.accent,
      background: config.colors?.background || "#0a0a0a",
      text: config.colors?.text || "#ffffff",
    },
    hook: {
      painPointQuestion: config.hookText || `Still searching for the perfect ${productName.toLowerCase()}?`,
    },
    productIntro: {
      productName,
      tagline: config.tagline || `Premium ${productName.toLowerCase()} you'll love`,
    },
    simulatedDemo: {
      inputPlaceholder: "Search...",
      typedText: productName,
      buttonText: "Shop Now",
      resultText: `${productName} — Available Now!`,
      resultSubtext: hashtags.map((h) => `#${h}`).join(" "),
    },
    imageShowcase: { images: publicImages },
    featureCallouts: {
      productImagePath: heroPath,
      features,
    },
    socialProofCta: {
      socialProofNumber: config.proofNumber || 10000,
      socialProofLabel: config.proofLabel || "happy customers",
      ctaUrl: config.ctaText || "Link in bio",
    },
    backgrounds: backgrounds.photos.length > 0 || backgrounds.videos.length > 0 ? backgrounds : undefined,
  };

  // Save video data
  const dataDir = path.resolve("public", "content", slug);
  fs.writeFileSync(path.join(dataDir, "video-data.json"), JSON.stringify(videoData, null, 2));

  // Determine templates
  const templates = config.templates || ALL_TEMPLATES;

  return {
    slug,
    productName,
    videoData,
    templates,
    imageCount: images.total,
    sourcePath: folderPath,
  };
}

/**
 * Scan the entire input directory and build data for all products
 */
export async function scanInputFolder(inputDir: string): Promise<AutoBuildResult[]> {
  if (!fs.existsSync(inputDir)) {
    console.log(`[auto] Input directory not found: ${inputDir}`);
    return [];
  }

  const entries = fs.readdirSync(inputDir, { withFileTypes: true });
  const results: AutoBuildResult[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const folderPath = path.join(inputDir, entry.name);

    // Skip if no images
    const images = detectImages(folderPath);
    if (images.total === 0) {
      console.log(`[auto] Skipping ${entry.name} — no images found`);
      continue;
    }

    console.log(`[auto] Processing ${entry.name} (${images.total} images)...`);
    const result = await buildFromFolder(folderPath);
    results.push(result);
    console.log(`[auto] Built: ${result.productName} -> ${result.templates.length} templates`);
  }

  return results;
}
