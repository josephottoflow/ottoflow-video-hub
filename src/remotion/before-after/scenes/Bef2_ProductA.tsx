import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import type { BrandColors } from "../../types";

export const Bef2_ProductA: React.FC<{ imagePath: string; title: string; subtitle?: string; colors: BrandColors }> = ({ imagePath, title, subtitle, colors }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 180 } });
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, opacity: fadeOut }}>
      {imagePath && (
        <AbsoluteFill style={{ transform: `scale(${scale})`, opacity: s }}>
          <Img src={staticFile(imagePath)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,0.85))" }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 60px 180px" }}>
        <div style={{ transform: `translateY(${(1 - s) * 60}px)`, opacity: s }}>
          <div style={{ fontSize: 56, fontWeight: 800, color: colors.text, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 24, color: colors.primary, fontWeight: 600 }}>{subtitle}</div>}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
