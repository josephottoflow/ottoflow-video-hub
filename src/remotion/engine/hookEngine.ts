/**
 * HOOK OPTIMIZATION ENGINE
 * Generates scroll-stopping hook text for the first 2 seconds.
 *
 * Rules:
 *   - Short: 3–6 words max
 *   - Emotional or problem-based
 *   - Uses product name context
 *   - Deterministic per product (seeded)
 *
 * Hook patterns:
 *   "Stop [bad thing]"
 *   "This Changes Everything"
 *   "You Need This [Product]"
 *   "Wait For It..."
 *   "[Product] Just Dropped"
 *   "POV: You Found [Product]"
 */
import type { HookConfig, ThemeConfig } from "./types";

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Hook templates ────────────────────────────────────────

interface HookTemplate {
  /** Template with {product} placeholder */
  template: string;
  /** Emotional intensity 0-1 */
  intensity: number;
  /** Works well for product categories */
  bestFor: string[];
}

const HOOK_TEMPLATES: HookTemplate[] = [
  // Problem-based (highest engagement)
  { template: "Stop Settling For Less", intensity: 0.95, bestFor: ["generic"] },
  { template: "This Changes Everything", intensity: 0.9, bestFor: ["generic", "tech"] },
  { template: "You NEED This", intensity: 0.85, bestFor: ["generic"] },
  { template: "Wait For It...", intensity: 0.8, bestFor: ["generic"] },
  { template: "Your {product} Upgrade", intensity: 0.85, bestFor: ["generic", "tech"] },

  // POV / trend hooks
  { template: "POV: You Found {product}", intensity: 0.8, bestFor: ["lifestyle", "fashion"] },
  { template: "{product} Just Dropped", intensity: 0.85, bestFor: ["generic", "fashion"] },
  { template: "The {product} Everyone Wants", intensity: 0.8, bestFor: ["generic"] },

  // Urgency hooks
  { template: "Don't Sleep On This", intensity: 0.9, bestFor: ["generic"] },
  { template: "Before It Sells Out", intensity: 0.85, bestFor: ["generic", "fashion"] },
  { template: "Game Changer Alert", intensity: 0.88, bestFor: ["tech", "fitness"] },

  // Social proof hooks
  { template: "Why Everyone's Obsessed", intensity: 0.82, bestFor: ["generic", "beauty"] },
  { template: "Millions Can't Be Wrong", intensity: 0.78, bestFor: ["generic"] },
  { template: "Finally. The One.", intensity: 0.9, bestFor: ["generic", "luxury"] },

  // Direct emotional
  { template: "You Deserve Better", intensity: 0.92, bestFor: ["generic", "lifestyle"] },
  { template: "Stop Wasting Money", intensity: 0.88, bestFor: ["generic", "tech"] },
];

/**
 * Shorten a product name for hook use.
 * "Premium Wireless Headphones" → "Headphones"
 * "Smart Watch Pro" → "Smart Watch"
 */
function shortenProductName(name: string): string {
  const words = name.split(/\s+/);
  // Remove filler adjectives
  const fillers = ["premium", "pro", "ultra", "plus", "super", "best", "new", "the", "a", "an"];
  const cleaned = words.filter((w) => !fillers.includes(w.toLowerCase()));

  // Keep last 1-2 words (the core product name)
  if (cleaned.length <= 2) return cleaned.join(" ");
  return cleaned.slice(-2).join(" ");
}

/**
 * Generate an optimized hook config for a product.
 *
 * @param productName - Full product name
 * @param seed - Deterministic seed
 * @param themeColor - Theme accent for glow
 * @param customHook - Override with custom hook text
 */
export function generateHookConfig(
  productName: string,
  seed: string,
  themeColor: string,
  customHook?: string,
): HookConfig {
  const rand = seededRandom(seed + "hook-optimize");

  // If custom hook provided, use it directly
  if (customHook && customHook.length > 0) {
    return {
      hookText: customHook,
      scaleFrom: 0.3,
      scaleTo: 1.0,
      shakeAmplitude: lerp(2, 5, rand()),
      shakeSpeed: lerp(0.8, 1.4, rand()),
      glowColor: themeColor,
    };
  }

  // Pick a template deterministically
  const templateIndex = Math.floor(rand() * HOOK_TEMPLATES.length);
  const template = HOOK_TEMPLATES[templateIndex];

  // Fill in product name
  const shortName = shortenProductName(productName);
  const hookText = template.template.replace("{product}", shortName);

  // Animation intensity scales with hook intensity
  const intensity = template.intensity;

  return {
    hookText,
    scaleFrom: lerp(0.2, 0.4, 1 - intensity),
    scaleTo: 1.0,
    shakeAmplitude: lerp(2, 6, intensity) * lerp(0.8, 1.2, rand()),
    shakeSpeed: lerp(0.7, 1.5, intensity) * lerp(0.85, 1.15, rand()),
    glowColor: themeColor,
  };
}

/**
 * Generate multiple hook options for A/B testing.
 */
export function generateHookOptions(
  productName: string,
  seed: string,
  themeColor: string,
  count: number = 3,
): HookConfig[] {
  const options: HookConfig[] = [];
  const rand = seededRandom(seed + "hook-options");

  // Shuffle templates and pick `count` unique ones
  const indices = Array.from({ length: HOOK_TEMPLATES.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  for (let i = 0; i < Math.min(count, indices.length); i++) {
    const template = HOOK_TEMPLATES[indices[i]];
    const shortName = shortenProductName(productName);
    const hookText = template.template.replace("{product}", shortName);

    options.push({
      hookText,
      scaleFrom: lerp(0.2, 0.4, 1 - template.intensity),
      scaleTo: 1.0,
      shakeAmplitude: lerp(2, 6, template.intensity) * lerp(0.8, 1.2, rand()),
      shakeSpeed: lerp(0.7, 1.5, template.intensity) * lerp(0.85, 1.15, rand()),
      glowColor: themeColor,
    });
  }

  return options;
}
