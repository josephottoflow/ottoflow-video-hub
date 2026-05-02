import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import type { BrandColors } from "../../types";

export const Unb6_SocialProof: React.FC<{ number: number; label: string; colors: BrandColors }> = ({ number, label, colors }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 30, stiffness: 120 } });
  const count = Math.round(s * number);
  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Star rating
  const stars = 5;
  const starDelay = 15;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, justifyContent: "center", alignItems: "center", opacity: fadeOut }}>
      <div style={{ textAlign: "center" }}>
        {/* Stars */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {Array.from({ length: stars }, (_, i) => {
            const starS = spring({ frame: frame - i * starDelay, fps, config: { damping: 10, stiffness: 200 } });
            return (
              <div key={i} style={{ fontSize: 40, transform: `scale(${starS}) rotate(${(1 - starS) * 180}deg)`, opacity: starS }}>
                ⭐
              </div>
            );
          })}
        </div>

        {/* Counter */}
        <div style={{ fontSize: 96, fontWeight: 800, color: colors.primary, fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>
          {count.toLocaleString()}+
        </div>
        <div style={{ fontSize: 28, fontWeight: 600, color: colors.text, marginTop: 12, fontFamily: "'Inter', sans-serif", opacity: s }}>
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};
