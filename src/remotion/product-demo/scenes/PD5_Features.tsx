/**
 * PRODUCT DEMO SCENE 5 — FEATURE CALLOUTS (5s / 150 frames)
 * Product image shrinks to top, 3 feature lines slide in.
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BrandColors, FeatureCalloutsScene, FeatureCallout } from "../../types";
import { PD_COLORS, PD_WIDTH, PD_HEIGHT } from "../types";

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

export const PD5_Features: React.FC<Props> = ({ data, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imgScale = spring({ frame, fps, config: { damping: 15, stiffness: 100 }, from: 0.8, to: 0.4 });
  const imgY = spring({ frame, fps, config: { damping: 15, stiffness: 100 }, from: 0, to: -250 });
  const titleOp = interpolate(frame, [12, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [135, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: PD_COLORS.bg, overflow: "hidden", opacity: fadeOut }}>
      {/* Background wash */}
      <div style={{
        position: "absolute", width: PD_WIDTH, height: PD_HEIGHT,
        background: `linear-gradient(180deg, ${colors.primary}08 0%, transparent 40%, ${colors.accent}05 100%)`,
      }} />

      {/* Product image — shrinks to top */}
      <div style={{
        position: "absolute", top: 200, width: "100%", display: "flex", justifyContent: "center",
        transform: `scale(${imgScale}) translateY(${imgY}px)`,
      }}>
        <div style={{
          position: "absolute", width: 300, height: 300, borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.primary}25 0%, transparent 65%)`, filter: "blur(30px)",
        }} />
        <Img
          src={staticFile(data.productImagePath)}
          style={{
            width: 860, maxHeight: 600, objectFit: "contain", borderRadius: 16,
            filter: `drop-shadow(0 8px 30px ${colors.primary}25)`,
          }}
        />
      </div>

      {/* Section title */}
      <div style={{ position: "absolute", top: 830, width: "100%", textAlign: "center", opacity: titleOp }}>
        <span style={{
          fontFamily: "Inter", fontWeight: 300, fontSize: 24, color: `${PD_COLORS.text}50`,
          letterSpacing: 4, textTransform: "uppercase",
        }}>
          Why You'll Love It
        </span>
      </div>

      {/* Feature rows */}
      <div style={{ position: "absolute", top: 920, left: 60, width: 960, display: "flex", flexDirection: "column", gap: 28 }}>
        {data.features.map((feature, i) => {
          const delay = i * 12;
          const slideX = spring({ frame: Math.max(0, frame - 18 - delay), fps, config: { damping: 14, stiffness: 120 }, from: 500, to: 0 });
          const fOp = interpolate(frame, [18 + delay, 30 + delay], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const iconBounce = spring({ frame: Math.max(0, frame - 24 - delay), fps, config: { damping: 8, stiffness: 200 }, from: 0, to: 1 });

          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 22,
              opacity: fOp, transform: `translateX(${slideX}px)`,
            }}>
              <div style={{
                width: 68, height: 68, borderRadius: 18,
                background: `linear-gradient(135deg, ${colors.accent}30, ${colors.primary}20)`,
                border: `1px solid ${colors.accent}20`,
                display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0,
                transform: `scale(${iconBounce})`, boxShadow: `0 4px 16px ${colors.accent}15`,
              }}>
                <span style={{ fontSize: 30, color: colors.accent }}>{ICON_MAP[feature.icon]}</span>
              </div>
              <span style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 38, lineHeight: "48px", color: PD_COLORS.text }}>
                {feature.text}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom fade */}
      <div style={{ position: "absolute", bottom: 0, width: PD_WIDTH, height: 200, background: `linear-gradient(transparent, ${PD_COLORS.bg})` }} />
    </AbsoluteFill>
  );
};
