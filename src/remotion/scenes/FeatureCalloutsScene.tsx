/**
 * SCENE 5 — FEATURE CALLOUTS (3s / 90 frames)
 * Product image scales to 40% at top.
 * 3 feature lines with icons slide in from right, staggered.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import type { BrandColors, FeatureCalloutsScene, FeatureCallout } from "../types";
import { SAFE_ZONE, CONTENT_WIDTH, VIDEO_WIDTH, VIDEO_HEIGHT } from "../types";

interface Props {
  data: FeatureCalloutsScene;
  colors: BrandColors;
}

const ICON_MAP: Record<FeatureCallout["icon"], string> = {
  check: "✓",
  lightning: "⚡",
  star: "★",
  shield: "🛡",
  zap: "⚡",
  heart: "♥",
};

export const FeatureCalloutsSceneComponent: React.FC<Props> = ({
  data,
  colors,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imageScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 1,
    to: 0.4,
  });

  const imageY = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 100 },
    from: 0,
    to: -300,
  });

  const titleOpacity = interpolate(frame, [10, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        overflow: "hidden",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          background: `linear-gradient(180deg, ${colors.primary}08 0%, transparent 40%, ${colors.accent}05 100%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: SAFE_ZONE.top + 100,
          width: "100%",
          display: "flex",
          justifyContent: "center",
          transform: `scale(${imageScale}) translateY(${imageY}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${colors.primary}30 0%, transparent 70%)`,
            filter: "blur(30px)",
          }}
        />
        <Img
          src={staticFile(data.productImagePath)}
          style={{
            width: CONTENT_WIDTH,
            maxHeight: 600,
            objectFit: "contain",
            borderRadius: 16,
            filter: `drop-shadow(0 8px 30px ${colors.primary}30)`,
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: 830,
          width: "100%",
          textAlign: "center",
          opacity: titleOpacity,
        }}
      >
        <span
          style={{
            fontFamily: "Inter",
            fontWeight: 300,
            fontSize: 30,
            color: `${colors.text}60`,
            letterSpacing: "3px",
            textTransform: "uppercase",
          }}
        >
          Why You'll Love It
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 910,
          left: SAFE_ZONE.left,
          width: CONTENT_WIDTH,
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {data.features.map((feature, i) => {
          const staggerDelay = i * 10;

          const slideX = spring({
            frame: Math.max(0, frame - 15 - staggerDelay),
            fps,
            config: { damping: 14, stiffness: 120 },
            from: 500,
            to: 0,
          });

          const featureOpacity = interpolate(
            frame,
            [15 + staggerDelay, 28 + staggerDelay],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          const iconScale = spring({
            frame: Math.max(0, frame - 20 - staggerDelay),
            fps,
            config: { damping: 8, stiffness: 200 },
            from: 0,
            to: 1,
          });

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: featureOpacity,
                transform: `translateX(${slideX}px)`,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${colors.accent}30, ${colors.primary}20)`,
                  border: `1px solid ${colors.accent}25`,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  flexShrink: 0,
                  transform: `scale(${iconScale})`,
                  boxShadow: `0 4px 16px ${colors.accent}15`,
                }}
              >
                <span style={{ fontSize: 28, color: colors.accent }}>
                  {ICON_MAP[feature.icon]}
                </span>
              </div>

              <span
                style={{
                  fontFamily: "Inter",
                  fontWeight: 500,
                  fontSize: 38,
                  lineHeight: "48px",
                  color: colors.text,
                }}
              >
                {feature.text}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          width: VIDEO_WIDTH,
          height: 200,
          background: `linear-gradient(transparent, ${colors.background})`,
        }}
      />
    </AbsoluteFill>
  );
};
