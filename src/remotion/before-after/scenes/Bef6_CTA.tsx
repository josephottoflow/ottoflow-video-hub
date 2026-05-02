import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import type { BrandColors } from "../../types";
import { PexelsBackground } from "../../components/PexelsBackground";

export const Bef6_CTA: React.FC<{ productName: string; ctaText: string; colors: BrandColors; backgroundSrc?: string }> = ({ productName, ctaText, colors, backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s1 = spring({ frame, fps, config: { damping: 12 } });
  const s2 = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const shine = interpolate(frame, [20, 50], [-100, 400], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {backgroundSrc && <PexelsBackground src={backgroundSrc} overlay={0.6} gradient="bottom" />}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 52, fontWeight: 800, color: colors.text, marginBottom: 24, transform: `scale(${s1})`, fontFamily: "'Inter', sans-serif", textShadow: backgroundSrc ? "0 2px 12px rgba(0,0,0,0.5)" : "none" }}>
            {productName}
          </div>
          <div style={{
            display: "inline-block", padding: "16px 40px", borderRadius: 50,
            background: colors.primary, fontSize: 26, fontWeight: 700, color: "#fff",
            transform: `scale(${s2})`, overflow: "hidden", position: "relative", fontFamily: "'Inter', sans-serif",
          }}>
            {ctaText}
            <div style={{ position: "absolute", top: 0, left: shine, width: 60, height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)", transform: "skewX(-20deg)" }} />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
