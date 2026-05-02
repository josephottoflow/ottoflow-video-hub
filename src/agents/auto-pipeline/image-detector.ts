/**
 * IMAGE DETECTOR — Smart image sorting and classification
 * Scans a product folder and organizes images by role.
 */
import * as fs from "fs";
import * as path from "path";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

export interface DetectedImages {
  hero: string;              // First/best image — used for reveals
  gallery: string[];         // All images in order — used for galleries
  packageShot: string;       // First image (assumed packaging)
  productDetails: string[];  // Remaining images — close-ups, details
  total: number;
}

export function detectImages(folderPath: string): DetectedImages {
  if (!fs.existsSync(folderPath)) {
    return { hero: "", gallery: [], packageShot: "", productDetails: [], total: 0 };
  }

  const files = fs.readdirSync(folderPath)
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (files.length === 0) {
    return { hero: "", gallery: [], packageShot: "", productDetails: [], total: 0 };
  }

  const fullPaths = files.map((f) => path.join(folderPath, f));

  // First image = hero/package shot
  // Remaining = product details
  return {
    hero: fullPaths[0],
    gallery: fullPaths,
    packageShot: fullPaths[0],
    productDetails: fullPaths.slice(1),
    total: fullPaths.length,
  };
}

/**
 * Generate smart headlines for images based on position and count
 */
export function generateHeadlines(imageCount: number, productName: string): string[] {
  if (imageCount <= 0) return [];

  const templates = [
    `${productName}`,
    "Premium Quality",
    "Every Detail Matters",
    "Built to Last",
    "See the Difference",
    "Crafted with Care",
    "Unmatched Quality",
    "The Real Deal",
  ];

  return Array.from({ length: imageCount }, (_, i) =>
    templates[i % templates.length]
  );
}
