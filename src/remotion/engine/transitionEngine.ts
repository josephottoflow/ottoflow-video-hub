/**
 * TRANSITION ENGINE — Inter-scene transitions
 * Generates transition configs for the cinematic pipeline.
 *
 * Transition types:
 *   cut       — instant cut (no overlay needed)
 *   blurFade  — gaussian blur + opacity fade
 *   whip      — fast horizontal motion blur (whip pan)
 *   zoomBlur  — zoom + radial blur
 *
 * Scene mapping:
 *   Hook exit  → cut (fast, keeps energy)
 *   Hero exit  → blurFade (smooth premium feel)
 *   Features   → whip (high energy, dynamic)
 *   Proof exit → blurFade (smooth to CTA)
 *   CTA exit   → cut (clean end)
 */
import type { TransitionConfig, TransitionType, SceneType } from "./types";
import { SCENE_TRANSITION_MAP } from "./types";

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

// ─── Base transition configs ───────────────────────────────

const TRANSITION_BASES: Record<TransitionType, Omit<TransitionConfig, "type">> = {
  cut: {
    durationFrames: 1,
    blurPeak: 0,
    whipDistance: 0,
    zoomPeak: 1.0,
    intensity: 1.0,
  },
  blurFade: {
    durationFrames: 12,
    blurPeak: 20,
    whipDistance: 0,
    zoomPeak: 1.02,
    intensity: 0.85,
  },
  whip: {
    durationFrames: 10,
    blurPeak: 35,
    whipDistance: 400,
    zoomPeak: 1.0,
    intensity: 0.95,
  },
  zoomBlur: {
    durationFrames: 14,
    blurPeak: 15,
    whipDistance: 0,
    zoomPeak: 1.25,
    intensity: 0.9,
  },
};

/**
 * Generate a transition config for a scene exit.
 * Uses deterministic seed for slight per-product variation.
 */
export function generateTransitionConfig(
  seed: string,
  scene: SceneType,
  overrideType?: TransitionType,
): TransitionConfig {
  const type = overrideType ?? SCENE_TRANSITION_MAP[scene];
  const base = TRANSITION_BASES[type];
  const rand = seededRandom(seed + "transition" + type);

  // Cuts get no variation
  if (type === "cut") {
    return { type, ...base };
  }

  return {
    type,
    durationFrames: Math.round(lerp(base.durationFrames * 0.8, base.durationFrames * 1.2, rand())),
    blurPeak: base.blurPeak * lerp(0.85, 1.15, rand()),
    whipDistance: base.whipDistance * lerp(0.8, 1.2, rand()),
    zoomPeak: base.zoomPeak * lerp(0.97, 1.03, rand()),
    intensity: Math.min(1, base.intensity * lerp(0.9, 1.1, rand())),
  };
}

/**
 * Generate transition configs for all scene exits.
 */
export function generateAllTransitionConfigs(seed: string): Record<SceneType, TransitionConfig> {
  return {
    hook: generateTransitionConfig(seed + "hook", "hook"),
    problem: generateTransitionConfig(seed + "problem", "problem"),
    hero: generateTransitionConfig(seed + "hero", "hero"),
    features: generateTransitionConfig(seed + "features", "features"),
    proof: generateTransitionConfig(seed + "proof", "proof"),
    cta: generateTransitionConfig(seed + "cta", "cta"),
  };
}

/**
 * Debug: log transition configs
 */
export function logTransitionConfigs(configs: Record<SceneType, TransitionConfig>): void {
  for (const [scene, config] of Object.entries(configs)) {
    if (config.type === "cut") {
      console.log(`[transition] ${scene}: cut`);
    } else {
      console.log(
        `[transition] ${scene}: ${config.type} | ${config.durationFrames}f | ` +
        `blur ${config.blurPeak.toFixed(0)}px | ` +
        (config.whipDistance > 0 ? `whip ${config.whipDistance.toFixed(0)}px | ` : "") +
        `intensity ${config.intensity.toFixed(2)}`
      );
    }
  }
}
`intensity ${config.intensity.toFixed(2)}`
      );
    }
  }
}
}

