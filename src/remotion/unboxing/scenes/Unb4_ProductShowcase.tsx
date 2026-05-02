import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Img, staticFile, useVideoConfig, spring } from "remotion";
import type { BrandColors } from "../../types";

interface GalleryImage { path: string; headline: string; }

export const Unb4_ProductShowcase: React.FC<{ images: GalleryImage[]; colors: BrandColors }> = ({ images, colors }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (!images.length) return <AbsoluteFill style={{ backgroundColor: colors.background }} />;

  const perImage = durationInFrames / Math.max(images.length, 1);
  const activeIndex = Math.min(Math.floor(frame / perImage), images.length - 1);
  const localFrame = frame - activeIndex * perImage;
  const img = images[activeIndex];

  // Cinematic zoom effect
  const zoomIn = interpolate(localFrame, [0, perImage], [1, 1.12], { extrapolateRight: "clamp" });
  const fadeIn = interpolate(localFrame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(localFrame, [perImage - 20, perImage], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vis = Math.min(fadeIn, fadeOut);

  // Gradient headline underline
  const lineWidth = spring({ frame: Math.max(0, localFrame - 10), fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      <AbsoluteFill style={{ opacity: vis, transform: `scale(${zoomIn})` }}>
        <Img src={staticFile(img.path)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 50%, rgba(0,0,0,0.9))" }} />
      </AbsoluteFill>

      <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 60px 140px" }}>
        <div style={{ opacity: vis }}>
          <div style={{ fontSize: 44, fontWeight: 700, color: colors.text, fontFamily: "'Inter', sans-serif", marginBottom: 8 }}>{img.headline}</div>
          <div style={{ width: `${lineWidth * 120}px`, height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent || colors.primary})` }} />
        </div>

        {/* Nav dots */}
        <div style={{ display: "flex", gap: 6, marginTop: 20, opacity: vis }}>
          {images.map((_, i) => (
            <div key={i} style={{
              width: i === activeIndex ? 28 : 8, height: 8, borderRadius: 4,
              background: i === activeIndex ? colors.primary : "rgba(255,255,255,0.25)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
