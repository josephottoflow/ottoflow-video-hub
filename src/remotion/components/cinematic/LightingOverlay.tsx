/**
 * LIGHTING OVERLAY — Apple-style rim lights, ambient glow, light sweep, depth shadow
 * Renders as a layer ON TOP of the product image.
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { LightingConfig } from "../../engine/types";

interface LightingOverlayProps {
  config: LightingConfig;
  /** Whether to show the animated light sweep */
  showSweep?: boolean;
  /** Center position of ambient glow (e.g., "50% 45%") */
  glowCenter?: string;
}

export const LightingOverlay: React.FC<LightingOverlayProps> = ({
  config,
  showSweep = true,
  glowCenter = "50% 45%",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Light sweep animation — moves diagonally across the scene
  const sweepX = interpolate(
    frame,
    [durationInFrames * 0.2, durationInFrames * 0.7],
    [-300, 1400],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Glow intensity ramps up and sustains
  const glowRamp = interpolate(
    frame,
    [0, 30, durationInFrames - 15, durationInFrames],
    [0, 1, 1, 0.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Rim light subtle pulse
  const rimPulse = interpolate(
    frame % 60,
    [0, 30, 60],
    [1, 1.15, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* A. Rim Light — Left (warm) */}
      <div style={{
        position: "absolute",
        left: -60,
        top: "15%",
        width: 200,
        height: "70%",
        background: `linear-gradient(to right, ${config.rimWarmColor}${opHex(config.rimWarmOpacity * rimPulse)}, transparent)`,
        filter: "blur(40px)",
      }} />

      {/* A. Rim Light — Right (cool) */}
      <div style={{
        position: "absolute",
        right: -60,
        top: "15%",
        width: 200,
        height: "70%",
        background: `linear-gradient(to left, ${config.rimCoolColor}${opHex(config.rimCoolOpacity * rimPulse)}, transparent)`,
        filter: "blur(40px)",
      }} />

      {/* B. Ambient Glow */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at ${glowCenter}, ${config.ambientGlowColor}${opHex(config.ambientGlowOpacity * glowRamp)} 0%, transparent ${config.ambientGlowRadius}%)`,
      }} />

      {/* D. Light Sweep */}
      {showSweep && (
        <div style={{
          position: "absolute",
          top: 0,
          left: sweepX,
          width: config.sweepWidth,
          height: "100%",
          background: `linear-gradient(90deg, transparent, ${config.sweepColor}12, ${config.sweepColor}08, transparent)`,
          transform: `skewX(${config.sweepAngle}deg)`,
        }} />
      )}

      {/* Top vignette */}
      <AbsoluteFill style={{
        background: "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, transparent 20%)",
      }} />

      {/* Bottom vignette */}
      <AbsoluteFill style={{
        background: "linear-gradient(to top, rgba(0,0,0,0.15) 0%, transparent 25%)",
      }} />
    </AbsoluteFill>
  );
};

/** Convert 0-1 opacity to 2-char hex */
function opHex(opacity: number): string {
  return Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
}
}
