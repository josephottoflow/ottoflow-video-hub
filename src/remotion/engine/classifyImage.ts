/**
 * IMAGE CLASSIFICATION ENGINE
 * Automatically detects and classifies product images by:
 *  1. Index position (first = hero)
 *  2. Filename keywords (detail, close, life, use, angle, hero)
 *  3. Fallback to "angle" category
 */
import type { ImageCategory, ClassifiedImage } from "./types";

// ─── Keyword → Category mapping ─────────────────────────────

const KEYWORD_RULES: { keywords: string[]; category: ImageCategory; confidence: number }[] = [
  { keywords: ["hero", "main", "front", "cover", "primary"], category: "hero", confidence: 0.9 },
  { keywords: ["detail", "close", "closeup", "macro", "zoom", "texture"], category: "detail", confidence: 0.85 },
  { keywords: ["life", "lifestyle", "use", "usage", "scene", "context", "action", "model"], category: "lifestyle", confidence: 0.85 },
  { keywords: ["angle", "side", "back", "top", "bottom", "profile", "360", "rotate"], category: "angle", confidence: 0.7 },
];

/**
 * Classify a single image by filename
 */
function classifyByFilename(src: string): { category: ImageCategory; confidence: number } {
  const filename = src.split("/").pop()?.toLowerCase() || "";
  const nameWithoutExt = filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => nameWithoutExt.includes(kw))) {
      return { category: rule.category, confidence: rule.confidence };
    }
  }

  return { category: "angle", confidence: 0.3 };
}

/**
 * Classify all images with smart index-aware rules
 */
export function classifyImages(images: string[]): ClassifiedImage[] {
  if (images.length === 0) return [];

  return images.map((src, index) => {
    // Rule 1: Index 0 is always hero (highest confidence)
    if (index === 0) {
      return { src, category: "hero" as ImageCategory, index, confidence: 1.0 };
    }

    // Rule 2: Check filename keywords
    const { category, confidence } = classifyByFilename(src);

    // Rule 3: Position-based hints
    // Images 1-3 tend to be detail/feature shots
    let positionBoost = 0;
    if (index >= 1 && index <= 3 && category === "angle") {
      return { src, category: "detail" as ImageCategory, index, confidence: 0.5 };
    }
    // Later images tend to be lifestyle/context
    if (index >= 4 && category === "angle") {
      return { src, category: "lifestyle" as ImageCategory, index, confidence: 0.4 };
    }

    return { src, category, index, confidence: confidence + positionBoost };
  });
}

/**
 * Get images by category, sorted by confidence
 */
export function getByCategory(classified: ClassifiedImage[], category: ImageCategory): ClassifiedImage[] {
  return classified
    .filter((img) => img.category === category)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get a summary of classified images
 */
export function classificationSummary(classified: ClassifiedImage[]): Record<ImageCategory, number> {
  return {
    hero: classified.filter((i) => i.category === "hero").length,
    detail: classified.filter((i) => i.category === "detail").length,
    lifestyle: classified.filter((i) => i.category === "lifestyle").length,
    angle: classified.filter((i) => i.category === "angle").length,
  };
}
