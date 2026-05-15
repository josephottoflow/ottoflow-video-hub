/**
 * PROBLEM SCENE — Pain point with kinetic word-by-word reveal (Scene 2)
 *
 * Words spring in one-by-one. Numbers and ALL-CAPS terms glow with accent color.
 * Horizontal accent lines expand from center for visual rhythm.
 */
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationVariant, LightingConfig, ThemeConfig, SceneTextConfig } from "../../engine/types";
import { LightingOverlay } from "./LightingOverlay";
import { KineticText } from "../KineticText";

interface ProblemProps {
  text: string;
  subtext?: string;
  variant: AnimationVariant;
  lighting: LightingConfig;
  theme: ThemeConfig;
  textConfig?: SceneTextConfig;
}

export const Problem: React.FC<ProblemProps> = ({
  text,
  subtext,
  variant,
  lighting,
  theme,
  textConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const opacity = interpolate(
    frame,
    [0, 8, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Subtext fades in after main text words have mostly appeared
  const words = text.split(/\s+/).filter(Boolean);
  const subtextDelay = 6 + words.length * 4 + 8;
  const subEntry = spring({ frame: frame - subtextDelay, fps, config: { damping: 16, stiffness: 100 } });

  // Pulsing glow
  const glowPulse = interpolate(frame % 90, [0, 45, 90], [0.25, 0.45, 0.25], { extrapolateRight: "clamp" });
  const glowSize  = interpolate(frame, [0, durationInFrames], [320, 520], { extrapolateRight: "clamp" });

  // Accent line grows from center
  const lineW = interpolate(frame, [8, 45], [0, 260], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lineW2 = interpolate(frame, [30, 65], [0, 180], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity }}>
      <LightingOverlay config={lighting} />

      {/* Ambient glow */}
      <div style={{
        position: "absolute",
        top: "44%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: glowSize,
        height: glowSize,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${theme.color}${Math.round(glowPulse * 22).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
        filter: "blur(50px)",
        pointerEvents: "none",
      }} />

      {/* Top accent line */}
      <div style={{
        position: "absolute",
        top: "35%",
        left: "50%",
        transform: "translateX(-50%)",
        width: lineW,
        height: 2,
        borderRadius: 1,
        background: `linear-gradient(90deg, transparent, ${theme.color}80, transparent)`,
      }} />

      {/* Main text block — kinetic word reveal */}
      <div style={{
        position: "absolute",
        top: "38%",
        left: 0,
        right: 0,
        padding: "0 72px",
      }}>
        <KineticText
          text={text}
          startFrame={6}
          wordStagger={6}
          fontSize={textConfig?.headline.fontSize ?? 72}
          fontWeight={textConfig?.headline.fontWeight ?? 800}
          color={textConfig?.colors.primary ?? "#ffffff"}
          accentColor={theme.color}
          lineHeight={1.18}
          textAlign="center"
          textShadow={`0 4px 24px rgba(0,0,0,0.65), 0 0 50px ${theme.color}18`}
          letterSpacing="-0.02em"
        />

        {/* Subtext */}
        {subtext && (
          <div style={{
            marginTop: 24,
            fontSize: 36,
            fontWeight: 600,
            color: "rgba(255,255,255,0.62)",
            fontFamily: "'Inter', sans-serif",
            textAlign: "center",
            letterSpacing: "0.01em",
            lineHeight: 1.5,
            opacity: subEntry,
            transform: `translateY(${(1 - subEntry) * 18}px)`,
            padding: "0 20px",
          }}>
            {subtext}
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div style={{
        position: "absolute",
        top: "68%",
        left: "50%",
        transform: "translateX(-50%)",
        width: lineW2,
        height: 1.5,
        borderRadius: 1,
        background: `linear-gradient(90deg, transparent, ${theme.color}50, transparent)`,
      }} />
    </AbsoluteFill>
  );
};
