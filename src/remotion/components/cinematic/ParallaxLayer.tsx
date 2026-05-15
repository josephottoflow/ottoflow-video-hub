/**
 * PARALLAX DEPTH SYSTEM
 * 4-layer depth compositing:
 *   Layer 0: Background (slow zoom + gradient)
 *   Layer 1: Mid particles (medium speed drift)
 *   Layer 2: Product (main focus, parallax-aware)
 *   Layer 3: Foreground glow + light streaks
 */
import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ThemeConfig, AnimationVariant } from "../../engine/types";
import { generateParticles } from "../../engine/animationVariants";

interface ParallaxLayerProps {
  theme: ThemeConfig;
  variant: AnimationVariant;
  seed: string;
  children: React.ReactNode;
}

export const ParallaxLayer: React.FC<ParallaxLayerProps> = ({ theme, variant, seed, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Layer 0: Background — slow zoom
  const bgZoom = interpolate(frame, [0, durationInFrames], [1.0, 1.05], { extrapolateRight: "clamp" });

  // Layer 1: Particles — medium speed drift
  const particles = generateParticles(seed, variant.particleCount, 1080, 1920);
  const particleDriftY = interpolate(frame, [0, durationInFrames], [0, -120], { extrapolateRight: "clamp" });

  // Layer 3: Foreground glow pulse
  const glowPulse = interpolate(
    frame % 90,
    [0, 45, 90],
    [0.3, 0.6, 0.3],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill>
      {/* Layer 0: Subtle gradient tint (transparent so CinematicBackground video shows through) */}
      <AbsoluteFill style={{
        background: `linear-gradient(165deg, ${theme.bgStart}18 0%, ${theme.bgEnd}18 100%)`,
        transform: `scale(${bgZoom})`,
      }} />

      {/* Layer 1: Floating particles */}
      <AbsoluteFill style={{ overflow: "hidden", opacity: 0.6 }}>
        {particles.map((p, i) => {
          const particleFrame = Math.max(0, frame - p.delay);
          const yOffset = particleFrame * p.speed * 0.5 + particleDriftY * p.speed;
          const xDrift = Math.sin(particleFrame * 0.02 * p.speed) * 15;
          const particleOpacity = interpolate(
            particleFrame,
            [0, 20, durationInFrames - 20, durationInFrames],
            [0, p.opacity, p.opacity, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.x + xDrift,
                top: (p.y + yOffset) % 2100 - 100,
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                backgroundColor: theme.particleColor,
                opacity: particleOpacity,
                boxShadow: `0 0 ${p.size * 3}px ${theme.particleColor}40`,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* Layer 2: Product / Main content (children) */}
      {children}

      {/* Layer 3: Foreground glow overlay */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse at 50% 90%, ${theme.ambientGlow}${Math.round(glowPulse * 20).toString(16).padStart(2, "0")} 0%, transparent 50%)`,
        pointerEvents: "none",
      }} />
    </AbsoluteFill>
  );
};
