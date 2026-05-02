/**
 * PROBLEM SCENE — Pain point / supporting text (Scene 2)
 *
 * Bridges the Hook grab to the Hero reveal.
 * Shows supporting text that identifies the viewer's problem.
 * Dark cinematic style with subtle drift animation.
 *
 * Animation: text fades up with typewriter-style reveal
 * Visual: dark overlay with subtle particle/glow effect
 */
import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationVariant, LightingConfig, ThemeConfig, SceneTextConfig } from "../../engine/types";
import { LightingOverlay } from "./LightingOverlay";
import { TextBlock } from "./TextBlock";

interface ProblemProps {
  /** Problem/pain point text */
  text: string;
  /** Optional secondary supporting text */
  subtext?: string;
  variant: AnimationVariant;
  lighting: LightingConfig;
  theme: ThemeConfig;
  /** Text Engine config */
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

  // Scene fade in/out
  const opacity = interpolate(
    frame,
    [0, 10, durationInFrames - 8, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Text entry springs
  const textEntry = spring({ frame: frame - 6, fps, config: { damping: 14, stiffness: 120 } });
  const subEntry = spring({ frame: frame - 22, fps, config: { damping: 16, stiffness: 100 } });

  // Subtle ambient glow pulse
  const glowPulse = interpolate(frame % 60, [0, 30, 60], [0.3, 0.5, 0.3], { extrapolateRight: "clamp" });
  const glowSize = interpolate(frame, [0, durationInFrames], [400, 600], { extrapolateRight: "clamp" });

  // Question mark emphasis animation (if text ends with ?)
  const isQuestion = text.trim().endsWith("?");
  const emphasisScale = isQuestion
    ? interpolate(frame, [15, 25, 35], [1, 1.08, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;

  return (
    <AbsoluteFill style={{ opacity }}>
      <LightingOverlay config={lighting} />

      {/* Central glow */}
      <div style={{
        position: "absolute",
        top: "45%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: glowSize,
        height: glowSize,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${theme.color}${Math.round(glowPulse * 20).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
        filter: "blur(40px)",
      }} />

      {/* Thin horizontal accent line */}
      <div style={{
        position: "absolute",
        top: "38%",
        left: "50%",
        transform: "translateX(-50%)",
        width: interpolate(frame, [10, 40], [0, 300], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        height: 2,
        borderRadius: 1,
        background: `linear-gradient(90deg, transparent, ${theme.color}60, transparent)`,
        opacity: 0.6,
      }} />

      {/* Problem text — centered */}
      <div style={{
        position: "absolute",
        top: "40%",
        left: 0,
        right: 0,
        textAlign: "center",
        padding: `0 ${textConfig?.layout.paddingX ?? 80}px`,
        transform: `translateY(-50%) scale(${emphasisScale})`,
      }}>
        {textConfig ? (
          <>
            <TextBlock text={text} style={textConfig.headline} anim={textConfig.headlineAnim} />
            {subtext && (
              <div style={{ marginTop: 20 }}>
                <TextBlock text={subtext} style={textConfig.subheadline} anim={textConfig.subheadlineAnim} />
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{
              fontSize: 44,
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: "'Inter', sans-serif",
              lineHeight: "54px",
              opacity: textEntry,
              transform: `translateY(${(1 - textEntry) * 30}px)`,
              textShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 60px ${theme.color}15`,
            }}>
              {text}
            </div>
            {subtext && (
              <div style={{
                fontSize: 22,
                fontWeight: 400,
                color: "rgba(255,255,255,0.6)",
                fontFamily: "'Inter', sans-serif",
                marginTop: 20,
                opacity: subEntry,
                transform: `translateY(${(1 - subEntry) * 20}px)`,
              }}>
                {subtext}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom accent line */}
      <div style={{
        position: "absolute",
        top: "58%",
        left: "50%",
        transform: "translateX(-50%)",
        width: interpolate(frame, [30, 60], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        height: 2,
        borderRadius: 1,
        background: `linear-gradient(90deg, transparent, ${theme.color}40, transparent)`,
        opacity: 0.4,
      }} />
    </AbsoluteFill>
  );
};
