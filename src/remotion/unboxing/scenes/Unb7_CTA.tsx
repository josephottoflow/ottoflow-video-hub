import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import type { BrandColors } from "../../types";
import { PexelsBackground } from "../../components/PexelsBackground";

export const Unb7_CTA: React.FC<{ productName: string; ctaText: string; hashtags?: string[]; colors: BrandColors; backgroundSrc?: string }> = ({ productName, ctaText, hashtags = [], colors, backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s1 = spring({ frame, fps, config: { damping: 12 } });
  const s2 = spring({ frame: frame - 10, fps, config: { damping: 14 } });
  const shine = interpolate(frame, [20, 55], [-100, 500], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {backgroundSrc && <PexelsBackground src={backgroundSrc} overlay={0.6} gradient="bottom" />}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
      <div style={{ textAlign: "center" }}>
        {/* Product name */}
        <div style={{ fontSize: 52, fontWeight: 800, color: colors.text, marginBottom: 28, transform: `scale(${s1})`, fontFamily: "'Inter', sans-serif" }}>
          {productName}
        </div>

        {/* CTA pill */}
        <div style={{
          display: "inline-block", padding: "18px 48px", borderRadius: 50,
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent || colors.primary})`,
          fontSize: 28, fontWeight: 700, color: "#fff",
          transform: `scale(${s2})`, overflow: "hidden", position: "relative",
          fontFamily: "'Inter', sans-serif",
          boxShadow: `0 8px 32px ${colors.primary}66`,
        }}>
          {ctaText}
          <div style={{ position: "absolute", top: 0, left: shine, width: 80, height: "100%", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)", transform: "skewX(-20deg)" }} />
        </div>

        {/* Hashtags */}
        {hashtags.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            {hashtags.map((tag, i) => {
              const tagS = spring({ frame: frame - 20 - i * 4, fps, config: { damping: 12 } });
              return (
                <div key={i} style={{
                  padding: "6px 16px", borderRadius: 20,
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                  fontSize: 16, fontWeight: 600, color: colors.primary,
                  transform: `scale(${tagS})`, opacity: tagS,
                  fontFamily: "'Inter', sans-serif",
                }}>#{tag}</div>
              );
            })}
          </div>
        )}
      </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
