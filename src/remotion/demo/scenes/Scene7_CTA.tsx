/**
 * SCENE 7 — CTA TEXT ANIMATION (3.5s / 105 frames)
 * "Make Claude Design Animations → Get MP4 using ClaudeVideoExport.com"
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, DEMO_WIDTH, DEMO_HEIGHT } from "../types";

export const Scene7_CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [90, 105], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Line 1: "Make Claude Design Animations"
  const line1Scale = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 12, stiffness: 150 },
    from: 0.5,
    to: 1,
  });
  const line1Opacity = interpolate(frame, [5, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Arrow
  const arrowOpacity = interpolate(frame, [20, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowX = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 10, stiffness: 100 },
    from: -40,
    to: 0,
  });

  // Line 2: "Get MP4 using"
  const line2Opacity = interpolate(frame, [30, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const line2Y = spring({
    frame: Math.max(0, frame - 30),
    fps,
    config: { damping: 12, stiffness: 120 },
    from: 30,
    to: 0,
  });

  // Domain: "ClaudeVideoExport.com"
  const domainScale = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: { damping: 8, stiffness: 150 },
    from: 1.5,
    to: 1,
  });
  const domainOpacity = interpolate(frame, [40, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Domain glow pulse
  const domainGlow = interpolate(frame, [50, 70, 90], [0, 30, 15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Underline
  const underlineWidth = interpolate(frame, [50, 70], [0, 600], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bg,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn * fadeOut,
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: DEMO_WIDTH,
          height: DEMO_HEIGHT,
          background: `radial-gradient(ellipse at 50% 50%, ${BRAND.green}12 0%, transparent 50%)`,
        }}
      />

      <div
        style={{
          width: 920,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          padding: "0 40px",
        }}
      >
        {/* Line 1 */}
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 52,
            fontWeight: 600,
            color: BRAND.text,
            textAlign: "center",
            lineHeight: "64px",
            opacity: line1Opacity,
            transform: `scale(${line1Scale})`,
          }}
        >
          Make Claude Design Animations
        </div>

        {/* Arrow */}
        <div
          style={{
            fontSize: 56,
            color: BRAND.green,
            opacity: arrowOpacity,
            transform: `translateX(${arrowX}px)`,
            textShadow: `0 0 20px ${BRAND.green}40`,
          }}
        >
          ↓
        </div>

        {/* Line 2 */}
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 42,
            fontWeight: 400,
            color: BRAND.textMuted,
            textAlign: "center",
            opacity: line2Opacity,
            transform: `translateY(${line2Y}px)`,
          }}
        >
          Get MP4 using
        </div>

        {/* Domain - the hero */}
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 64,
            fontWeight: 800,
            color: BRAND.green,
            textAlign: "center",
            opacity: domainOpacity,
            transform: `scale(${domainScale})`,
            textShadow: `0 0 ${domainGlow}px ${BRAND.green}60, 0 4px 20px ${BRAND.bg}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span>ClaudeVideoExport.com</span>
          {/* Underline */}
          <div
            style={{
              width: underlineWidth,
              height: 4,
              borderRadius: 2,
              background: `linear-gradient(90deg, transparent, ${BRAND.green}, transparent)`,
              marginTop: 12,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
