/**
 * PRODUCT DEMO SCENE 3 — PRODUCT REVEAL (5s / 150 frames)
 * Big product name + hero image slides/scales in dramatically.
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
import type { BrandColors, ProductIntroScene } from "../../types";
import { PD_COLORS, PD_WIDTH, PD_HEIGHT } from "../types";

interface Props {
  data: ProductIntroScene;
  heroImagePath: string;
  colors: BrandColors;
}

export const PD3_ProductReveal: React.FC<Props> = ({ data, heroImagePath, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [135, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // "Introducing" label
  const labelOp = interpolate(frame, [5, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Product name slam
  const nameScale = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 10, stiffness: 150 }, from: 2, to: 1 });
  const nameOp = interpolate(frame, [10, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Tagline
  const tagOp = interpolate(frame, [25, 38], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tagY = spring({ frame: Math.max(0, frame - 25), fps, config: { damping: 12, stiffness: 100 }, from: 30, to: 0 });

  // Hero image
  const imgScale = spring({ frame: Math.max(0, frame - 30), fps, config: { damping: 14, stiffness: 80 }, from: 0.7, to: 1 });
  const imgOp = interpolate(frame, [30, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Slow Ken Burns
  const kenBurns = interpolate(frame, [30, 150], [1, 1.06], { extrapolateRight: "clamp" });

  // Glow behind image
  const glowIntensity = interpolate(frame, [30, 60, 120], [0, 1, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: PD_COLORS.bg, justifyContent: "center", alignItems: "center", opacity: fadeIn * fadeOut }}>
      {/* Background gradient */}
      <div style={{
        position: "absolute", width: PD_WIDTH, height: PD_HEIGHT,
        background: `radial-gradient(ellipse at 50% 60%, ${colors.primary}15 0%, transparent 50%)`,
      }} />

      {/* Text section - top */}
      <div style={{ position: "absolute", top: 250, width: PD_WIDTH, textAlign: "center", padding: "0 60px" }}>
        {/* Label */}
        <div style={{ fontFamily: "Inter", fontSize: 20, fontWeight: 500, color: PD_COLORS.textMuted, letterSpacing: 4, textTransform: "uppercase", marginBottom: 20, opacity: labelOp }}>
          Introducing
        </div>
        {/* Product name */}
        <div style={{
          fontFamily: "Inter", fontSize: 72, fontWeight: 800, color: PD_COLORS.text, lineHeight: "82px",
          opacity: nameOp, transform: `scale(${nameScale})`,
          textShadow: `0 0 40px ${colors.primary}30`,
        }}>
          {data.productName}
        </div>
        {/* Tagline */}
        <div style={{
          fontFamily: "Inter", fontSize: 32, fontWeight: 400, color: PD_COLORS.textMuted, lineHeight: "42px",
          marginTop: 16, opacity: tagOp, transform: `translateY(${tagY}px)`,
        }}>
          {data.tagline}
        </div>
      </div>

      {/* Hero image - center/bottom */}
      <div style={{
        position: "absolute", top: 700, width: PD_WIDTH, display: "flex", justifyContent: "center",
        opacity: imgOp,
      }}>
        {/* Glow */}
        <div style={{
          position: "absolute", width: 600, height: 400, borderRadius: "50%",
          background: `radial-gradient(circle, ${colors.primary}${Math.round(glowIntensity * 30).toString(16).padStart(2, "0")} 0%, transparent 60%)`,
          filter: "blur(40px)", top: 100,
        }} />
        <Img
          src={staticFile(heroImagePath)}
          style={{
            width: 800, maxHeight: 800, objectFit: "contain", borderRadius: 24,
            transform: `scale(${imgScale * kenBurns})`,
            filter: `drop-shadow(0 20px 60px ${PD_COLORS.bg}cc) drop-shadow(0 0 30px ${colors.primary}25)`,
          }}
        />
      </div>

      {/* Decorative line */}
      <div style={{
        position: "absolute", bottom: 200, left: "50%", transform: "translateX(-50%)",
        width: interpolate(frame, [50, 80], [0, 300], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        height: 3, borderRadius: 2,
        background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
      }} />
    </AbsoluteFill>
  );
};
