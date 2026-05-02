/**
 * IMAGE SELECTION ENGINE
 * Selects the best 3–4 images from a product folder for cinematic video.
 *
 * Strategy:
 *   1. Classify all images
 *   2. Score each by: category match, filename quality signals, position
 *   3. Select optimal set: [hero, best detail, best detail, lifestyle]
 *   4. Fallback gracefully when fewer images available
 *
 * Quality signals (filename-based):
 *   high-res indicators: "hd", "hq", "large", "2x", "4k"
 *   clean indicators: "clean", "white", "studio", "pro", "final"
 *   low-quality indicators: "thumb", "small", "icon", "draft", "temp"
 */
import type { ClassifiedImage, ImageCategory, ImageSelection } from "./types";
import { classifyImages, getByCategory } from "./classifyImage";

// ─── Quality scoring ───────────────────────────────────────

const QUALITY_BOOST_KEYWORDS = ["hd", "hq", "large", "2x", "4k", "hi-res", "hires", "full"];
const CLEAN_BOOST_KEYWORDS = ["clean", "white", "studio", "pro", "final", "edited", "retouched"];
const PENALTY_KEYWORDS = ["thumb", "thumbnail", "small", "icon", "draft", "temp", "old", "backup", "copy"];

function qualityScore(src: string): number {
  const name = src.split("/").pop()?.toLowerCase().replace(/[-_]/g, " ") || "";
  let score = 0;

  // Boost for quality indicators
  if (QUALITY_BOOST_KEYWORDS.some((kw) => name.includes(kw))) score += 0.15;
  if (CLEAN_BOOST_KEYWORDS.some((kw) => name.includes(kw))) score += 0.1;

  // Penalty for low-quality indicators
  if (PENALTY_KEYWORDS.some((kw) => name.includes(kw))) score -= 0.3;

  // Prefer PNG/WebP over JPG (often higher quality)
  if (name.endsWith(".png") || name.endsWith(".webp")) score += 0.05;

  return score;
}

/**
 * Score a classified image for selection priority.
 * Higher = better candidate.
 */
function selectionScore(img: ClassifiedImage, targetCategory: ImageCategory): number {
  let score = img.confidence;

  // Category match bonus
  if (img.category === targetCategory) score += 0.4;

  // Quality signals from filename
  score += qualityScore(img.src);

  // Early index bonus (first images tend to be best)
  if (img.index <= 2) score += 0.1;
  if (img.index <= 5) score += 0.05;

  return score;
}

/**
 * Select the best 3–4 images from a set of paths.
 * Returns: [hero, detail1, detail2, lifestyle] — or fewer if not enough images.
 *
 * @param images - All available image paths
 * @param maxImages - Maximum images to select (default: 4)
 */
export function selectBestImages(images: string[], maxImages: number = 4): ImageSelection {
  if (images.length === 0) {
    return { selected: [], totalConsidered: 0, dropped: [] };
  }

  const classified = classifyImages(images);
  const used = new Set<number>();

  const selected: ClassifiedImage[] = [];

  // ─── Slot 1: Hero (always index 0 or best hero-classified) ──
  const heroes = getByCategory(classified, "hero");
  const hero = heroes[0] || classified[0];
  selected.push(hero);
  used.add(hero.index);

  if (maxImages >= 2) {
    // ─── Slot 2: Best detail shot ──────────────────────────────
    const detailCandidates = classified
      .filter((img) => !used.has(img.index))
      .map((img) => ({ img, score: selectionScore(img, "detail") }))
      .sort((a, b) => b.score - a.score);

    if (detailCandidates.length > 0) {
      selected.push(detailCandidates[0].img);
      used.add(detailCandidates[0].img.index);
    }
  }

  if (maxImages >= 3) {
    // ─── Slot 3: Second detail shot ────────────────────────────
    const detail2Candidates = classified
      .filter((img) => !used.has(img.index))
      .map((img) => ({ img, score: selectionScore(img, "detail") }))
      .sort((a, b) => b.score - a.score);

    if (detail2Candidates.length > 0) {
      selected.push(detail2Candidates[0].img);
      used.add(detail2Candidates[0].img.index);
    }
  }

  if (maxImages >= 4) {
    // ─── Slot 4: Lifestyle / context shot ──────────────────────
    const lifestyleCandidates = classified
      .filter((img) => !used.has(img.index))
      .map((img) => ({ img, score: selectionScore(img, "lifestyle") }))
      .sort((a, b) => b.score - a.score);

    if (lifestyleCandidates.length > 0) {
      selected.push(lifestyleCandidates[0].img);
      used.add(lifestyleCandidates[0].img.index);
    }
  }

  // Dropped images
  const dropped = classified.filter((img) => !used.has(img.index));

  return {
    selected,
    totalConsidered: classified.length,
    dropped,
  };
}

/**
 * Select best images and return just the paths (convenience method)
 */
export function selectBestImagePaths(images: string[], maxImages: number = 4): string[] {
  return selectBestImages(images, maxImages).selected.map((img) => img.src);
}

/**
 * Debug: log image selection results
 */
export function logSelection(selection: ImageSelection): void {
  console.log(`[selector] Selected ${selection.selected.length}/${selection.totalConsidered} images:`);
  selection.selected.forEach((img, i) => {
    const slot = ["hero", "detail-1", "detail-2", "lifestyle"][i] || `extra-${i}`;
    console.log(`  [${slot}] ${img.src.split("/").pop()} (${img.category}, conf: ${img.confidence.toFixed(2)})`);
  });
  if (selection.dropped.length > 0) {
    console.log(`  Dropped: ${selection.dropped.map((d) => d.src.split("/").pop()).join(", ")}`);
  }
}
