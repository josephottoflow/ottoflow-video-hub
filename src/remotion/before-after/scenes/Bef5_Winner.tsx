import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import type { BrandColors } from "../../types";

interface Feature { icon: string; text: string; }

const ICONS: Record<string, string> = { check: "✓", lightning: "⚡", star: "⭐", shield: "🛡", zap: "⚡", heart: "❤" };

export const Bef5_Winner: React.FC<{ features: Feature[]; title?: string; colors: BrandColors }> = ({ features, title = "Why You'll Love It", colors }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const titleS = spring({ frame, fps, config: { damping: 14 } });
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, padding: "120px 60px", opacity: fadeOut }}>
      <div style={{ fontSize: 36, fontWeight: 700, color: colors.primary, marginBottom: 40, transform: `translateY(${(1 - titleS) * 30}px)`, opacity: titleS, fontFamily: "'Inter', sans-serif" }}>{title}</div>
      {features.map((f, i) => {
        const s = spring({ frame: frame - 10 - i * 8, fps, config: { damping: 12, stiffness: 180 } });
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 20, marginBottom: 28,
            transform: `translateX(${(1 - s) * 80}px)`, opacity: s,
          }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: colors.primary + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
              {ICONS[f.icon] || ICONS.check}
            </div>
            <div style={{ fontSize: 26, fontWeight: 600, color: colors.text, fontFamily: "'Inter', sans-serif" }}>{f.text}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
