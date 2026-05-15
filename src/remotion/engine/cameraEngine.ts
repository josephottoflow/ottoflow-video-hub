/**
 * CAMERA ENGINE — Cinematic camera movements for each scene
 * Generates per-scene camera configs with deterministic randomness.
 *
 * Movement types:
 *   pushIn     — zoom toward subject (Hook)
 *   pullOut    — zoom away, reveal full frame (CTA)
 *   panLeft    — slow horizontal slide left
 *   panRight   — slow horizontal slide right (Features)
 *   drift      — subtle floating/organic motion (Proof)
 *   heroReveal — zoom + upward lift (Hero)
 */
import type { CameraConfig, CameraMovement, SceneType } from "./types";
import { SCENE_CAMERA_MAP } from "./types";

// ─── Seeded random (same algo as animationVariants) ────────

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

// ─── Base camera configs per movement type ─────────────────

const MOVEMENT_BASES: Record<CameraMovement, Omit<CameraConfig, "movement">> = {
  pushIn: {
    scaleFrom: 1.0,
    scaleTo: 1.12,
    translateXFrom: 0,
    translateXTo: 0,
    translateYFrom: 0,
    translateYTo: 0,
    easeStrength: 0.6,
    driftAmplitude: 3,
    driftSpeed: 0.8,
  },
  pullOut: {
    scaleFrom: 1.1,
    scaleTo: 1.0,
    translateXFrom: 0,
    translateXTo: 0,
    translateYFrom: 0,
    translateYTo: 0,
    easeStrength: 0.5,
    driftAmplitude: 2,
    driftSpeed: 0.6,
  },
  panLeft: {
    scaleFrom: 1.04,
    scaleTo: 1.04,
    translateXFrom: 30,
    translateXTo: -30,
    translateYFrom: 0,
    translateYTo: 0,
    easeStrength: 0.3,
    driftAmplitude: 2,
    driftSpeed: 0.5,
  },
  panRight: {
    scaleFrom: 1.04,
    scaleTo: 1.04,
    translateXFrom: -30,
    translateXTo: 30,
    translateYFrom: 0,
    translateYTo: 0,
    easeStrength: 0.3,
    driftAmplitude: 2,
    driftSpeed: 0.5,
  },
  drift: {
    scaleFrom: 1.02,
    scaleTo: 1.04,
    translateXFrom: -8,
    translateXTo: 8,
    translateYFrom: -5,
    translateYTo: 5,
    easeStrength: 0.2,
    driftAmplitude: 6,
    driftSpeed: 1.0,
  },
  heroReveal: {
    scaleFrom: 1.15,
    scaleTo: 1.0,
    translateXFrom: 0,
    translateXTo: 0,
    translateYFrom: 40,
    translateYTo: 0,
    easeStrength: 0.7,
    driftAmplitude: 4,
    driftSpeed: 0.7,
  },
};

// ─── Generate camera config with seeded variation ──────────

/**
 * Generate a camera config for a specific scene.
 * Uses deterministic seed so the same product always gets the same camera motion,
 * but each product looks different.
 *
 * @param seed   - Deterministic seed string (e.g., first image path + scene name)
 * @param scene  - Scene type to determine default movement
 * @param overrideMovement - Optional override of the default movement
 */
export function generateCameraConfig(
  seed: string,
  scene: SceneType,
  overrideMovement?: CameraMovement,
): CameraConfig {
  const movement = overrideMovement ?? SCENE_CAMERA_MAP[scene];
  const base = MOVEMENT_BASES[movement];
  const rand = seededRandom(seed + "camera" + movement);

  // Apply ±15-25% randomness to all numeric values
  const jitterScale = (v: number, range: number = 0.2) =>
    v * lerp(1 - range, 1 + range, rand());

  const jitterPx = (v: number, maxDelta: number = 8) =>
    v + lerp(-maxDelta, maxDelta, rand());

  return {
    movement,
    scaleFrom: jitterScale(base.scaleFrom, 0.02),
    scaleTo: jitterScale(base.scaleTo, 0.03),
    translateXFrom: jitterPx(base.translateXFrom, 6),
    translateXTo: jitterPx(base.translateXTo, 6),
    translateYFrom: jitterPx(base.translateYFrom, 5),
    translateYTo: jitterPx(base.translateYTo, 5),
    easeStrength: lerp(base.easeStrength * 0.8, base.easeStrength * 1.2, rand()),
    driftAmplitude: jitterScale(base.driftAmplitude, 0.3),
    driftSpeed: jitterScale(base.driftSpeed, 0.25),
  };
}

/**
 * Generate camera configs for all 6 scenes in one call.
 * Convenience method for SceneRenderer.
 */
export function generateAllCameraConfigs(seed: string): Record<SceneType, CameraConfig> {
  return {
    hook: generateCameraConfig(seed + "hook", "hook"),
    problem: generateCameraConfig(seed + "problem", "problem"),
    hero: generateCameraConfig(seed + "hero", "hero"),
    features: generateCameraConfig(seed + "features", "features"),
    proof: generateCameraConfig(seed + "proof", "proof"),
    cta: generateCameraConfig(seed + "cta", "cta"),
  };
}

/**
 * Debug: log camera configs for a product
 */
export function logCameraConfigs(configs: Record<SceneType, CameraConfig>): void {
  for (const [scene, config] of Object.entries(configs)) {
    console.log(
      `[camera] ${scene}: ${config.movement} | scale ${config.scaleFrom.toFixed(3)}→${config.scaleTo.toFixed(3)} | ` +
      `tx ${config.translateXFrom.toFixed(1)}→${config.translateXTo.toFixed(1)} | ` +
      `ty ${config.translateYFrom.toFixed(1)}→${config.translateYTo.toFixed(1)} | ` +
      `drift ±${config.driftAmplitude.toFixed(1)}px @ ${config.driftSpeed.toFixed(2)}x`
    );
  }
}
