/**
 * SCENE-AWARE SEQUENCING ENGINE
 * Intelligently distributes classified images across 6 cinematic scenes:
 *   1. Hook    — attention grab (secondary or striking image)
 *   2. Problem — pain point text (no product image needed)
 *   3. Hero    — main product showcase (hero image)
 *   4. Features — detail shots cycling
 *   5. Proof   — angles + lifestyle (social proof/real-world)
 *   6. CTA     — conversion close (hero callback)
 */
import type { ClassifiedImage, SceneAssignment } from "./types";
import { classifyImages, getByCategory } from "./classifyImage";

/**
 * Assign raw image paths to scenes via classification
 */
export function assignImagesToScenes(images: string[]): SceneAssignment {
  const classified = classifyImages(images);

  const heroes = getByCategory(classified, "hero");
  const details = getByCategory(classified, "detail");
  const lifestyles = getByCategory(classified, "lifestyle");
  const angles = getByCategory(classified, "angle");

  // Fallback pool: all images sorted by index
  const all = classified.sort((a, b) => a.index - b.index);

  // ─── Hero: always index 0 ──────────────────────────────────
  const hero = heroes[0] || all[0];

  // ─── Hook: eye-catching non-hero image ─────────────────────
  // Prefer lifestyle (atmospheric) > last image > angles > details
  // Hook should feel DIFFERENT from hero, not just the next frame
  const hookCandidates = [
    ...lifestyles,
    ...angles.filter((a) => a.index !== hero.index),
    ...details.filter((d) => d.index !== hero.index),
  ];
  // Prefer the LAST candidate (most visually different from hero at index 0)
  const hook = hookCandidates.length > 0
    ? hookCandidates[hookCandidates.length - 1]
    : all[all.length - 1] || hero;

  // ─── Features: detail shots, excluding hook & hero ─────────
  const featurePool = [
    ...details.filter((d) => d.index !== hook.index && d.index !== hero.index),
    ...angles.filter((a) => a.index !== hook.index && a.index !== hero.index),
  ];
  const features = featurePool.length >= 3
    ? featurePool.slice(0, 3)
    : padArray(featurePool, 3, all.filter((i) => i.index !== hero.index && i.index !== hook.index));

  // ─── Proof: lifestyle + remaining unused images ────────────
  const usedIndices = new Set([hero.index, hook.index, ...features.map((f) => f.index)]);
  const proofPool = [...lifestyles, ...angles].filter((i) => !usedIndices.has(i.index));
  let proof: ClassifiedImage[];
  if (proofPool.length >= 3) {
    proof = proofPool.slice(0, 3);
  } else {
    // Try padding from unused images first
    const unusedFallback = all.filter((i) => !usedIndices.has(i.index));
    proof = padArray(proofPool, 3, unusedFallback);
    // If still empty (all images consumed by prior scenes), reuse from all images
    if (proof.length === 0) {
      proof = padArray([], 3, all);
    }
  }

  // ─── CTA: callback to hero ─────────────────────────────────
  const cta = hero;

  return { hook, hero, features, proof, cta };
}

/**
 * Pad an array to a target length by cycling through fallbacks
 */
function padArray(arr: ClassifiedImage[], targetLength: number, fallback: ClassifiedImage[]): ClassifiedImage[] {
  const result = [...arr];
  const pool = [...fallback];
  let poolIdx = 0;

  // First pass: add unique images from fallback pool
  while (result.length < targetLength && pool.length > 0) {
    const candidate = pool[poolIdx % pool.length];
    if (!result.some((r) => r.index === candidate.index)) {
      result.push(candidate);
    }
    poolIdx++;
    // Safety valve
    if (poolIdx > pool.length * 2) break;
  }

  // Second pass: if still short and we have nothing, allow duplicates from pool
  if (result.length === 0 && pool.length > 0) {
    result.push(pool[0]);
  }

  // Third pass: cycle through what we have to fill remaining slots
  const baseLen = result.length;
  while (result.length < targetLength && baseLen > 0) {
    result.push(result[result.length % baseLen]);
  }

  return result.slice(0, targetLength);
}

/**
 * Debug: log scene assignment
 */
export function logAssignment(assignment: SceneAssignment): void {
  console.log("[scenes] Hook:", assignment.hook.src, `(${assignment.hook.category})`);
  console.log("[scenes] Hero:", assignment.hero.src, `(${assignment.hero.category})`);
  console.log("[scenes] Features:", assignment.features.map((f) => f.src.split("/").pop()).join(", "));
  console.log("[scenes] Proof:", assignment.proof.map((p) => p.src.split("/").pop()).join(", "));
  console.log("[scenes] CTA:", assignment.cta.src, `(${assignment.cta.category})`);
}
