/**
 * ANIMATION VARIATION ENGINE
 * Generates per-render randomness to make each video feel unique.
 * Uses a deterministic seed so the same product always gets the same variant.
 */
import type { AnimationVariant, ImageCategory, SceneType } from "./types";

// ─── Seeded random for deterministic variation ──────────────

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const chr = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) | 0;
    return ((hash >>> 0) / 4294967296);
  };
}

/**
 * Lerp between two values by t (0-1)
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Base animation configs per image category ──────────────

const CATEGORY_BASES: Record<ImageCategory, Partial<AnimationVariant>> = {
  hero: {
    floatAmplitude: 8,
    floatSpeed: 1.0,
    rotateAmount: 3,
    zoomFrom: 1.0,
    zoomTo: 1.06,
    panDistance: 0,
    glowIntensity: 0.8,
    sweepSpeed: 1.0,
    springDamping: 12,
    springStiffness: 160,
  },
  detail: {
    floatAmplitude: 0,
    floatSpeed: 0,
    rotateAmount: 0,
    zoomFrom: 1.0,
    zoomTo: 1.18,
    panDistance: 30,
    glowIntensity: 0.5,
    sweepSpeed: 0.8,
    springDamping: 14,
    springStiffness: 140,
  },
  lifestyle: {
    floatAmplitude: 0,
    floatSpeed: 0,
    rotateAmount: 0,
    zoomFrom: 1.02,
    zoomTo: 1.08,
    panDistance: 50,
    glowIntensity: 0.3,
    sweepSpeed: 0.6,
    springDamping: 16,
    springStiffness: 120,
  },
  angle: {
    floatAmplitude: 4,
    floatSpeed: 0.7,
    rotateAmount: 2,
    zoomFrom: 0.95,
    zoomTo: 1.0,
    panDistance: 20,
    glowIntensity: 0.6,
    sweepSpeed: 0.9,
    springDamping: 12,
    springStiffness: 150,
  },
};

/**
 * Generate a unique animation variant for a given seed + category
 */
export function generateVariant(seed: string, category: ImageCategory): AnimationVariant {
  const rand = seededRandom(seed + category);
  const base = CATEGORY_BASES[category];

  return {
    floatAmplitude: base.floatAmplitude! * lerp(0.8, 1.3, rand()),
    floatSpeed: base.floatSpeed! * lerp(0.7, 1.4, rand()),
    rotateAmount: base.rotateAmount! * lerp(0.6, 1.5, rand()),
    zoomFrom: base.zoomFrom! * lerp(0.98, 1.02, rand()),
    zoomTo: base.zoomTo! * lerp(0.97, 1.04, rand()),
    panDistance: base.panDistance! * lerp(0.7, 1.4, rand()),
    glowIntensity: base.glowIntensity! * lerp(0.8, 1.2, rand()),
    sweepSpeed: base.sweepSpeed! * lerp(0.7, 1.3, rand()),
    particleCount: Math.floor(lerp(15, 40, rand())),
    springDamping: base.springDamping! * lerp(0.85, 1.15, rand()),
    springStiffness: base.springStiffness! * lerp(0.9, 1.1, rand()),
  };
}

/**
 * Get scene-specific animation timing offsets
 */
export function getSceneTiming(sceneType: SceneType): {
  entryDelay: number;
  textDelay: number;
  imageDelay: number;
  exitStart: number;
} {
  switch (sceneType) {
    case "hook":
      return { entryDelay: 0, textDelay: 5, imageDelay: 15, exitStart: 100 };
    case "hero":
      return { entryDelay: 0, textDelay: 20, imageDelay: 8, exitStart: 155 };
    case "features":
      return { entryDelay: 0, textDelay: 10, imageDelay: 5, exitStart: 185 };
    case "proof":
      return { entryDelay: 0, textDelay: 12, imageDelay: 8, exitStart: 155 };
    case "cta":
      return { entryDelay: 0, textDelay: 8, imageDelay: 5, exitStart: 95 };
    default:
      return { entryDelay: 0, textDelay: 10, imageDelay: 8, exitStart: 100 };
  }
}

/**
 * Generate particle positions for a scene (deterministic)
 */
export function generateParticles(
  seed: string,
  count: number,
  width: number,
  height: number
): { x: number; y: number; size: number; speed: number; delay: number; opacity: number }[] {
  const rand = seededRandom(seed + "particles");
  const particles = [];

  for (let i = 0; i < count; i++) {
    particles.push({
      x: rand() * width,
      y: rand() * height,
      size: lerp(1.5, 5, rand()),
      speed: lerp(0.3, 1.2, rand()),
      delay: rand() * 60,
      opacity: lerp(0.1, 0.5, rand()),
    });
  }

  return particles;
}
