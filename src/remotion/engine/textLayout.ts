/**
 * TEXT LAYOUT ENGINE — Auto-positioning by scene and image type
 * Places text intelligently to avoid covering the product.
 *
 * Rules:
 *   - Hero: bottom (product centered/top)
 *   - Detail: top or side (close-up fills frame)
 *   - Lifestyle: left or right (context shot)
 *   - Hook: center or bottom (grab attention)
 *   - CTA: center-bottom (clear action)
 *
 * Safe areas:
 *   - 60px horizontal padding
 *   - 80px from top/bottom edges
 *   - Max width 960px (of 1080px frame)
 */
import type {
  SceneType,
  ImageCategory,
  TextPosition,
  TextLayoutConfig,
} from "./types";
import { CIN_WIDTH, CIN_HEIGHT } from "./types";

// ─── Seeded random ─────────────────────────────────────────

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const chr = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) | 0;
    return (hash >>> 0) / 4294967296;
  };
}

// ─── Safe area constants ───────────────────────────────────

export const SAFE_AREA = {
  paddingX: 60,
  paddingTop: 80,
  paddingBottom: 80,
  maxTextWidth: CIN_WIDTH - 120, // 960px
  /** TikTok/Reels safe zone — avoid bottom 200px for UI overlay */
  socialBottomSafe: 200,
} as const;

// ─── Scene → Position mapping ──────────────────────────────

/** Default text positions per scene type */
const SCENE_POSITION_DEFAULTS: Record<SceneType, TextPosition> = {
  hook: "center",
  problem: "center",
  hero: "bottom",
  features: "bottom",
  proof: "bottom",
  cta: "bottom",
};

/** Alternative positions per scene (for variation) */
const SCENE_POSITION_ALTS: Record<SceneType, TextPosition[]> = {
  hook: ["center", "bottom"],
  problem: ["center"],
  hero: ["bottom", "bottomLeft"],
  features: ["top", "bottom", "topLeft"],
  proof: ["bottomLeft", "bottomRight", "bottom"],
  cta: ["bottom", "center"],
};

/** Image category → preferred text position */
const IMAGE_CATEGORY_POSITIONS: Record<ImageCategory, TextPosition[]> = {
  hero: ["bottom", "bottomLeft"],
  detail: ["top", "topLeft", "topRight"],
  lifestyle: ["bottomLeft", "bottomRight", "centerLeft"],
  angle: ["bottom", "top"],
};

// ─── Position → CSS mapping ────────────────────────────────

interface PositionCSS {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  textAlign: "left" | "center" | "right";
  justifyContent?: string;
  alignItems?: string;
}

const POSITION_CSS: Record<TextPosition, PositionCSS> = {
  top: { top: `${SAFE_AREA.paddingTop}px`, left: "0", right: "0", textAlign: "center" },
  bottom: { bottom: `${SAFE_AREA.paddingBottom + SAFE_AREA.socialBottomSafe}px`, left: "0", right: "0", textAlign: "center" },
  center: { top: "50%", left: "0", right: "0", textAlign: "center" },
  topLeft: { top: `${SAFE_AREA.paddingTop}px`, left: `${SAFE_AREA.paddingX}px`, textAlign: "left" },
  topRight: { top: `${SAFE_AREA.paddingTop}px`, right: `${SAFE_AREA.paddingX}px`, textAlign: "right" },
  bottomLeft: { bottom: `${SAFE_AREA.paddingBottom + SAFE_AREA.socialBottomSafe}px`, left: `${SAFE_AREA.paddingX}px`, textAlign: "left" },
  bottomRight: { bottom: `${SAFE_AREA.paddingBottom + SAFE_AREA.socialBottomSafe}px`, right: `${SAFE_AREA.paddingX}px`, textAlign: "right" },
  centerLeft: { top: "50%", left: `${SAFE_AREA.paddingX}px`, textAlign: "left" },
  centerRight: { top: "50%", right: `${SAFE_AREA.paddingX}px`, textAlign: "right" },
};

/**
 * Get CSS positioning for a TextPosition
 */
export function getPositionCSS(position: TextPosition): Record<string, string | number | undefined> {
  const pos = POSITION_CSS[position];
  const style: Record<string, string | number | undefined> = {
    position: "absolute",
    padding: `0 ${SAFE_AREA.paddingX}px`,
    maxWidth: SAFE_AREA.maxTextWidth,
    textAlign: pos.textAlign,
  };

  if (pos.top) style.top = pos.top;
  if (pos.bottom) style.bottom = pos.bottom;
  if (pos.left !== undefined) style.left = pos.left;
  if (pos.right !== undefined) style.right = pos.right;

  // Center vertical position needs transform
  if (pos.top === "50%") {
    style.transform = "translateY(-50%)";
  }

  return style;
}

/**
 * Determine optimal text layout for a scene.
 *
 * @param scene - Current scene type
 * @param imageCategory - Primary image category in this scene
 * @param seed - Deterministic seed for variation
 * @param textLength - Approximate character count (for adaptive sizing)
 */
export function getTextLayout(
  scene: SceneType,
  imageCategory: ImageCategory,
  seed: string,
  textLength: number = 20,
): TextLayoutConfig {
  const rand = seededRandom(seed + "layout" + scene);

  // Start with scene default
  let position = SCENE_POSITION_DEFAULTS[scene];

  // Consider image category — if it suggests a different position, use it sometimes
  const categoryPositions = IMAGE_CATEGORY_POSITIONS[imageCategory];
  if (rand() > 0.6 && categoryPositions.length > 0) {
    position = categoryPositions[Math.floor(rand() * categoryPositions.length)];
  }

  // Adaptive max width based on text length
  let maxWidth = SAFE_AREA.maxTextWidth;
  if (textLength > 40) {
    maxWidth = Math.min(SAFE_AREA.maxTextWidth, 800); // Narrower for long text
  }
  if (textLength < 15) {
    maxWidth = Math.min(SAFE_AREA.maxTextWidth, 700); // Compact for short text
  }

  // Determine text alignment from position
  let textAlign: "left" | "center" | "right" = "center";
  if (position.includes("Left")) textAlign = "left";
  if (position.includes("Right")) textAlign = "right";

  return {
    position,
    paddingX: SAFE_AREA.paddingX,
    offsetY: 0,
    textAlign,
    maxWidth,
  };
}

/**
 * Adapt font size based on text length.
 * Long text gets smaller, short text gets bigger.
 */
export function adaptFontSize(baseFontSize: number, text: string): number {
  const len = text.length;
  if (len <= 8) return Math.round(baseFontSize * 1.15);
  if (len <= 15) return baseFontSize;
  if (len <= 25) return Math.round(baseFontSize * 0.92);
  if (len <= 40) return Math.round(baseFontSize * 0.82);
  return Math.round(baseFontSize * 0.72);
}

/**
 * Check if text will be readable at given size/position.
 * Returns true if safe, false if too small or overlapping danger zone.
 */
export function isReadable(fontSize: number, position: TextPosition): boolean {
  // Minimum readable size
  if (fontSize < 14) return false;

  // Center positions risk overlapping product
  if (position === "center" && fontSize > 60) return true; // Hook-size is fine centered
  if (position === "center" && fontSize < 40) return false; // Small centered text gets lost

  return true;
}
