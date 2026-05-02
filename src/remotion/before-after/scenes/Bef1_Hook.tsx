import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import type { BrandColors } from "../../types";
import { PexelsBackground } from "../../components/PexelsBackground";

export const Bef1_Hook: React.FC<{ text: string; colors: BrandColors; backgroundSrc?: string }> = ({ text, colors, backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {backgroundSrc && <PexelsBackground src={backgroundSrc} overlay={0.65} gradient="both" />}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 60 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 14px", maxWidth: 900 }}>
          {words.map((word, i) => {
            const delay = i * 3;
            const s = spring({ frame: frame - delay, fps, config: { damping: 12, stiffness: 200 } });
            const isHighlight = i === 0 || i === words.length - 1;
            return (
              <span key={i} style={{
                fontSize: 72, fontWeight: 800, fontFamily: "'Inter', sans-serif",
                color: isHighlight ? colors.primary : colors.text,
                transform: `scale(${s}) translateY(${(1 - s) * 40}px)`,
                opacity: s, display: "inline-block",
                textShadow: backgroundSrc ? "0 2px 16px rgba(0,0,0,0.6)" : "none",
              }}>{word}</span>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
