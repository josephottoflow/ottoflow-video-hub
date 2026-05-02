/**
 * CAMERA — Cinematic camera motion wrapper
 * Wraps scene elements and applies smooth camera movements:
 *   pushIn, pullOut, panLeft, panRight, drift, heroReveal
 *
 * Uses interpolate() for main trajectory + sin-wave drift for organic feel.
 * Combines with ParallaxLayer for multi-layer depth.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { CameraConfig } from "../../engine/types";

interface CameraProps {
  config: CameraConfig;
  children: React.ReactNode;
}

/**
 * Custom easing: stronger easeStrength = more ease-in-out feel.
 * Maps linear progress [0,1] to eased progress [0,1].
 */
function easeInOut(t: number, strength: number): number {
  if (strength <= 0) return t;
  // Attempt to smooth curves using power-based ease in/out
  const s = 1 + strength * 3; // strength 0.7 → power 3.1
  if (t < 0.5) {
    return Math.pow(2 * t, s) / 2;
  }
  return 1 - Math.pow(2 * (1 - t), s) / 2;
}

export const Camera: React.FC<CameraProps> = ({ config, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Normalized progress 0→1 across the scene
  const rawProgress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Apply easing curve
  const progress = easeInOut(rawProgress, config.easeStrength);

  // ─── Main trajectory ───────────────────────────────────────

  const scale = interpolate(progress, [0, 1], [config.scaleFrom, config.scaleTo]);

  const translateX = interpolate(
    progress,
    [0, 1],
    [config.translateXFrom, config.translateXTo],
  );

  const translateY = interpolate(
    progress,
    [0, 1],
    [config.translateYFrom, config.translateYTo],
  );

  // ─── Organic drift (sin-wave overlay) ──────────────────────
  // Adds subtle floating motion so camera never feels robotic

  const driftX = Math.sin(frame * 0.03 * config.driftSpeed) * config.driftAmplitude;
  const driftY = Math.cos(frame * 0.025 * config.driftSpeed) * config.driftAmplitude * 0.6;

  // ─── Compose final transform ──────────────────────────────
  // Note: scene-level opacity fades are handled by individual scene components
  // (Angle, Hero, Detail, Lifestyle, CtaScene) to avoid double-fading.

  const finalX = translateX + driftX;
  const finalY = translateY + driftY;

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${finalX}px, ${finalY}px) scale(${scale})`,
        willChange: "transform",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
