import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile, useVideoConfig } from "remotion";
import type { BrandColors } from "../../types";

interface GalleryImage { path: string; headline: string; }

export const Unb3_Unboxing: React.FC<{ images: GalleryImage[]; colors: BrandColors }> = ({ images, colors }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  if (!images.length) return <AbsoluteFill style={{ backgroundColor: colors.background }} />;

  const perImage = durationInFrames / Math.max(images.length, 1);
  const activeIndex = Math.min(Math.floor(frame / perImage), images.length - 1);
  const localFrame = frame - activeIndex * perImage;

  const opacity = interpolate(localFrame, [0, 15, perImage - 15, perImage], [0, 1, 1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  const scale = interpolate(localFrame, [0, perImage], [1.05, 1], { extrapolateRight: "clamp" });
  const img = images[activeIndex];

  // Step counter
  const stepLabel = `Step ${activeIndex + 1} of ${images.length}`;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>
        <Img src={staticFile(img.path)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 40%, rgba(0,0,0,0.85))" }} />
      </AbsoluteFill>

      {/* Step indicator */}
      <div style={{ position: "absolute", top: 80, left: 0, right: 0, display: "flex", justifyContent: "center", opacity }}>
        <div style={{ padding: "8px 20px", borderRadius: 20, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: colors.primary, fontFamily: "'Inter', sans-serif" }}>{stepLabel}</span>
        </div>
      </div>

      {/* Headline */}
      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 60px 160px" }}>
        <div style={{ opacity, transform: `translateY(${(1 - opacity) * 20}px)` }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: colors.text, fontFamily: "'Inter', sans-serif" }}>{img.headline}</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
