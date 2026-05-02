import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Img, staticFile } from "remotion";
import type { BrandColors } from "../../types";

export const Unb2_PackageReveal: React.FC<{ imagePath: string; productName: string; colors: BrandColors }> = ({ imagePath, productName, colors }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Box slides up from bottom
  const slideUp = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const scale = interpolate(frame, [0, durationInFrames], [1.15, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Sparkle particles
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const radius = interpolate(frame, [10, 60], [0, 200 + (i % 3) * 80], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const opacity = interpolate(frame, [10, 30, 80], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return { x, y, opacity, size: 4 + (i % 3) * 3 };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, opacity: fadeOut }}>
      {/* Product image with Ken Burns */}
      {imagePath && (
        <AbsoluteFill style={{ transform: `scale(${scale})`, opacity: slideUp }}>
          <Img src={staticFile(imagePath)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 60%, transparent 30%, rgba(0,0,0,0.7))" }} />
        </AbsoluteFill>
      )}

      {/* Sparkles */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        {particles.map((p, i) => (
          <div key={i} style={{
            position: "absolute", width: p.size, height: p.size, borderRadius: "50%",
            background: colors.primary, opacity: p.opacity,
            transform: `translate(${p.x}px, ${p.y}px)`,
            boxShadow: `0 0 ${p.size * 2}px ${colors.primary}`,
          }} />
        ))}
      </AbsoluteFill>

      {/* Title overlay */}
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 60px 200px" }}>
        <div style={{ transform: `translateY(${(1 - slideUp) * 80}px)`, opacity: slideUp }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: colors.primary, fontFamily: "'Inter', sans-serif", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>Unboxing</div>
          <div style={{ fontSize: 52, fontWeight: 800, color: colors.text, fontFamily: "'Inter', sans-serif" }}>{productName}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
