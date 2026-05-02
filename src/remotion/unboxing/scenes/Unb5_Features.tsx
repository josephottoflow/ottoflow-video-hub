import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import type { BrandColors } from "../../types";
import { PexelsBackground } from "../../components/PexelsBackground";

interface Feature { icon: string; text: string; }

const ICONS: Record<string, string> = { check: "✓", lightning: "⚡", star: "⭐", shield: "🛡", zap: "⚡", heart: "❤" };

export const Unb5_Features: React.FC<{ features: Feature[]; title?: string; colors: BrandColors; backgroundSrc?: string }> = ({ features, title = "What's Inside", colors, backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const titleS = spring({ frame, fps, config: { damping: 14 } });
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, opacity: fadeOut }}>
      {backgroundSrc && <PexelsBackground src={backgroundSrc} overlay={0.7} gradient="none" />}
      <AbsoluteFill style={{ padding: "140px 60px" }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: colors.primary, marginBottom: 44, transform: `translateY(${(1 - titleS) * 30}px)`, opacity: titleS, fontFamily: "'Inter', sans-serif", textShadow: backgroundSrc ? "0 2px 12px rgba(0,0,0,0.5)" : "none" }}>{title}</div>
        {features.map((f, i) => {
          const s = spring({ frame: frame - 12 - i * 8, fps, config: { damping: 12, stiffness: 180 } });
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 20, marginBottom: 32,
              transform: `translateX(${(1 - s) * 100}px)`, opacity: s,
            }}>
              <div style={{
                width: 60, height: 60, borderRadius: 16, flexShrink: 0,
                background: `linear-gradient(135deg, ${colors.primary}33, ${colors.primary}11)`,
                border: `1px solid ${colors.primary}44`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26,
                backdropFilter: backgroundSrc ? "blur(8px)" : "none",
              }}>
                {ICONS[f.icon] || ICONS.check}
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, color: colors.text, fontFamily: "'Inter', sans-serif", textShadow: backgroundSrc ? "0 1px 8px rgba(0,0,0,0.5)" : "none" }}>{f.text}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
