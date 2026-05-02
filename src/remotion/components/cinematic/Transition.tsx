/**
 * TRANSITION — Inter-scene transition overlay
 * Renders as an overlay at the end of a scene / start of the next.
 *
 * Types:
 *   cut       → no overlay rendered
 *   blurFade  → gaussian blur + fade to black + back
 *   whip      → fast horizontal motion blur
 *   zoomBlur  → zoom + radial blur
 *
 * Usage: placed as an overlay within a Sequence at the tail end of a scene.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { TransitionConfig } from "../../engine/types";

interface TransitionProps {
  config: TransitionConfig;
  /** Theme accent color for flash tint */
  accentColor?: string;
}

export const Transition: React.FC<TransitionProps> = ({ config, accentColor = "#ffffff" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Transitions render only in the last N frames of the scene
  const dur = config.durationFrames;
  const transitionStart = durationInFrames - dur;

  // Don't render until transition zone
  if (frame < transitionStart || config.type === "cut") {
    return null;
  }

  // Progress 0→1 within the transition zone
  const progress = interpolate(frame, [transitionStart, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (config.type === "blurFade") {
    // Smooth blur ramp: 0 → peak → slight ease
    const blur = interpolate(progress, [0, 0.6, 1.0], [0, config.blurPeak, config.blurPeak * 0.7]);
    const fadeOpacity = interpolate(progress, [0, 0.5, 1.0], [0, 0.35 * config.intensity, 0.45 * config.intensity]);
    const zoom = interpolate(progress, [0, 1], [1.0, config.zoomPeak]);

    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {/* Blur layer */}
        <AbsoluteFill style={{
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
          transform: `scale(${zoom})`,
        }} />
        {/* Dark fade overlay */}
        <AbsoluteFill style={{
          backgroundColor: "#000000",
          opacity: fadeOpacity,
        }} />
      </AbsoluteFill>
    );
  }

  if (config.type === "whip") {
    // Fast horizontal motion blur
    const whipX = interpolate(
      progress,
      [0, 0.4, 0.8, 1.0],
      [0, -config.whipDistance * 0.3, -config.whipDistance, -config.whipDistance * 1.1],
    );
    const motionBlur = interpolate(progress, [0, 0.3, 0.7, 1.0], [0, config.blurPeak * 0.5, config.blurPeak, config.blurPeak * 0.8]);
    const fadeOpacity = interpolate(progress, [0, 0.6, 1.0], [0, 0.25 * config.intensity, 0.45 * config.intensity]);

    // Accent flash at peak
    const flashOpacity = interpolate(progress, [0.3, 0.5, 0.7], [0, 0.15, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        {/* Motion blur via CSS filter on overlay */}
        <AbsoluteFill style={{
          backdropFilter: `blur(${motionBlur}px)`,
          WebkitBackdropFilter: `blur(${motionBlur}px)`,
          transform: `translateX(${whipX}px)`,
        }} />
        {/* Dark overlay */}
        <AbsoluteFill style={{
          backgroundColor: "#000000",
          opacity: fadeOpacity,
        }} />
        {/* Accent flash */}
        <AbsoluteFill style={{
          backgroundColor: accentColor,
          opacity: flashOpacity,
        }} />
      </AbsoluteFill>
    );
  }

  if (config.type === "zoomBlur") {
    // Zoom in + radial-style blur
    const zoom = interpolate(progress, [0, 0.7, 1.0], [1.0, config.zoomPeak, config.zoomPeak * 1.05]);
    const blur = interpolate(progress, [0, 0.5, 1.0], [0, config.blurPeak * 0.6, config.blurPeak]);
    const fadeOpacity = interpolate(progress, [0, 0.6, 1.0], [0, 0.3 * config.intensity, 0.45 * config.intensity]);

    return (
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <AbsoluteFill style={{
          backdropFilter: `blur(${blur}px)`,
          WebkitBackdropFilter: `blur(${blur}px)`,
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
        }} />
        <AbsoluteFill style={{
          backgroundColor: "#000000",
          opacity: fadeOpacity,
        }} />
      </AbsoluteFill>
    );
  }

  return null;
};
};
