/**
 * PRODUCT DEMO SCENE 7 — CTA (3.5s / 105 frames)
 * Product name + hashtags + "Link in bio"
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BrandColors, SocialProofCtaScene } from "../../types";
import { PD_COLORS, PD_WIDTH, PD_HEIGHT } from "../types";
import { PexelsBackground } from "../../components/PexelsBackground";

interface Props {
  data: SocialProofCtaScene;
  productName: string;
  hashtags: string[];
  colors: BrandColors;
  backgroundSrc?: string;
}

export const PD7_CTA: React.FC<Props> = ({ data, productName, hashtags, colors, backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [90, 105], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Product name
  const nameScale = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 10, stiffness: 150 }, from: 1.5, to: 1 });
  const nameOp = interpolate(frame, [5, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // CTA pill
  const ctaScale = spring({ frame: Math.max(0, frame - 20), fps, config: { damping: 12, stiffness: 120 }, from: 0.5, to: 1 });
  const ctaOp = interpolate(frame, [20, 32], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Hashtags
  const hashOp = interpolate(frame, [35, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hashY = spring({ frame: Math.max(0, frame - 35), fps, config: { damping: 12, stiffness: 100 }, from: 20, to: 0 });

  // CTA pulse
  const pulse = interpolate(frame % 30, [0, 15, 30], [1, 1.03, 1], { extrapolateRight: "clamp" });

  // Shine sweep on CTA
  const shineX = interpolate(frame, [40, 70], [-200, 500], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Glow
  const glow = interpolate(frame, [20, 50, 90], [0, 30, 15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: PD_COLORS.bg, opacity: fadeIn * fadeOut }}>
      {backgroundSrc && <PexelsBackground src={backgroundSrc} overlay={0.6} gradient="both" />}
      {/* Background glow */}
      <div style={{
        position: "absolute", width: PD_WIDTH, height: PD_HEIGHT,
        background: `radial-gradient(ellipse at 50% 50%, ${colors.primary}12 0%, transparent 50%)`,
      }} />

      <div style={{ width: 920, display: "flex", flexDirection: "column", alignItems: "center", gap: 30, padding: "0 40px" }}>
        {/* Product name */}
        <div style={{
          fontFamily: "Inter", fontSize: 68, fontWeight: 800, color: PD_COLORS.text, textAlign: "center",
          lineHeight: "80px", opacity: nameOp, transform: `scale(${nameScale})`,
          textShadow: `0 0 ${glow}px ${colors.primary}40`,
        }}>
          {productName}
        </div>

        {/* CTA pill */}
        <div style={{
          display: "inline-block", position: "relative", padding: "18px 56px", borderRadius: 40,
          backgroundColor: `${colors.primary}20`, border: `2px solid ${colors.primary}50`,
          opacity: ctaOp, transform: `scale(${ctaScale * pulse})`, overflow: "hidden",
          boxShadow: `0 0 ${glow}px ${colors.primary}30`,
        }}>
          {/* Shine */}
          <div style={{
            position: "absolute", top: 0, left: shineX, width: 60, height: "100%",
            background: `linear-gradient(90deg, transparent, ${PD_COLORS.text}12, transparent)`,
            transform: "skewX(-15deg)",
          }} />
          <span style={{
            fontFamily: "Inter", fontWeight: 600, fontSize: 36, color: colors.primary,
            textShadow: `0 0 20px ${colors.primary}30`, position: "relative", zIndex: 1,
          }}>
            {data.ctaUrl || "Link in bio ↗"}
          </span>
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 12px",
            opacity: hashOp, transform: `translateY(${hashY}px)`, maxWidth: 800,
          }}>
            {hashtags.slice(0, 6).map((tag, i) => (
              <span key={i} style={{
                fontFamily: "Inter", fontSize: 22, fontWeight: 500, color: colors.accent,
                padding: "6px 16px", borderRadius: 20, backgroundColor: `${colors.accent}12`,
                border: `1px solid ${colors.accent}20`,
              }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
