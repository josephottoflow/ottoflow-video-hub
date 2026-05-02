/**
 * HOOK TEXT — Scroll-stopping text animation for the first 2 seconds
 * Fast punch scale + slight shake + glow pulse.
 * Designed to maximize attention in the first frames of a video.
 */
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { HookConfig } from "../../engine/types";

interface HookTextProps {
  config: HookConfig;
}

export const HookText: React.FC<HookTextProps> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ─── Fast punch scale (0.3 → 1.0 in ~8 frames) ────────────
  const punchScale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 280, mass: 0.6 },
  });

  const scale = interpolate(
    punchScale,
    [0, 1],
    [config.scaleFrom, config.scaleTo],
  );

  // ─── Micro shake (high freq, low amplitude) ────────────────
  // Only active during first ~20 frames for energy
  const shakeActive = interpolate(frame, [0, 5, 20, 30], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shakeX = Math.sin(frame * 2.5 * config.shakeSpeed) * config.shakeAmplitude * shakeActive;
  const shakeY = Math.cos(frame * 3.1 * config.shakeSpeed) * config.shakeAmplitude * 0.4 * shakeActive;

  // ─── Glow pulse behind text ────────────────────────────────
  const glowOpacity = interpolate(
    frame,
    [0, 8, 20, 50],
    [0, 0.5, 0.3, 0.15],
    { extrapolateRight: "clamp" },
  );

  const glowSize = interpolate(
    frame,
    [0, 8, 50],
    [100, 600, 800],
    { extrapolateRight: "clamp" },
  );

  // ─── Text opacity: fast in, hold, then subtle ──────────────
  const textOpacity = interpolate(
    frame,
    [0, 3, 8],
    [0, 0.5, 1.0],
    { extrapolateRight: "clamp" },
  );

  // ─── Slight rotation for extra energy ──────────────────────
  const rotateZ = interpolate(
    frame,
    [0, 4, 10, 20],
    [-2, 1.5, -0.5, 0],
    { extrapolateRight: "clamp" },
  );

  return (
    <>
      {/* Glow burst behind text */}
      <div style={{
        position: "absolute",
        top: "42%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: glowSize,
        height: glowSize * 0.5,
        borderRadius: "50%",
        background: `radial-gradient(ellipse, ${config.glowColor}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
        filter: "blur(30px)",
        pointerEvents: "none",
      }} />

      {/* Hook text */}
      <div style={{
        position: "absolute",
        top: "38%",
        left: 0,
        right: 0,
        textAlign: "center",
        padding: "0 50px",
        transform: `translate(${shakeX}px, ${shakeY}px) scale(${scale}) rotate(${rotateZ}deg)`,
        opacity: textOpacity,
      }}>
        <div style={{
          fontSize: 72,
          fontWeight: 900,
          color: "#ffffff",
          fontFamily: "'Inter', sans-serif",
          lineHeight: "80px",
          letterSpacing: "-1px",
          textTransform: "uppercase",
          textShadow: `
            0 4px 30px rgba(0,0,0,0.6),
            0 0 80px ${config.glowColor}30,
            0 0 120px ${config.glowColor}15
          `,
        }}>
          {config.hookText}
        </div>
      </div>
    </>
  );
};
