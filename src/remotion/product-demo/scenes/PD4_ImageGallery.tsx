/**
 * PRODUCT DEMO SCENE 4 — IMAGE GALLERY (6s / 180 frames)
 * Product images with smooth crossfade, Ken Burns, and headlines.
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BrandColors, ImageShowcaseScene } from "../../types";
import { PD_COLORS, PD_WIDTH, PD_HEIGHT } from "../types";

interface Props {
  data: ImageShowcaseScene;
  colors: BrandColors;
}

export const PD4_ImageGallery: React.FC<Props> = ({ data, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { images } = data;
  if (images.length === 0) return null;

  const totalFrames = 180;
  const framesPerImage = Math.floor(totalFrames / images.length);
  const activeIndex = Math.min(images.length - 1, Math.floor(frame / framesPerImage));

  const sceneEntry = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: PD_COLORS.bg, opacity: sceneEntry, overflow: "hidden" }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", width: PD_WIDTH, height: PD_HEIGHT,
        background: `radial-gradient(ellipse at 50% 40%, ${colors.primary}0c 0%, transparent 55%)`,
      }} />

      {/* Counter badge */}
      <div style={{
        position: "absolute", top: 120, width: PD_WIDTH, textAlign: "center", zIndex: 10,
      }}>
        <span style={{ fontFamily: "Inter", fontSize: 18, fontWeight: 500, color: PD_COLORS.textMuted, letterSpacing: 3, textTransform: "uppercase" }}>
          Product Gallery
        </span>
      </div>

      {images.map((img, i) => {
        const imageStart = i * framesPerImage;
        const localFrame = frame - imageStart;
        const isActive = i === activeIndex;
        const isPrev = i === activeIndex - 1;
        if (!isActive && !isPrev) return null;

        const entryScale = spring({ frame: Math.max(0, localFrame), fps, config: { damping: 15, stiffness: 100 }, from: 0.9, to: 1 });
        const kenBurns = interpolate(localFrame, [0, framesPerImage], [1, 1.05], { extrapolateRight: "clamp" });
        const scale = entryScale * kenBurns;

        let opacity = 1;
        if (isPrev) {
          const nextStart = (i + 1) * framesPerImage;
          opacity = interpolate(frame, [nextStart - 5, nextStart + 12], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        } else if (i > 0) {
          opacity = interpolate(localFrame, [0, 15], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        }

        const headlineOp = interpolate(localFrame, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const headlineY = spring({ frame: Math.max(0, localFrame - 10), fps, config: { damping: 14, stiffness: 120 }, from: 25, to: 0 });
        const underlineW = interpolate(localFrame, [20, 38], [0, 150], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const glowAmt = interpolate(localFrame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

        return (
          <AbsoluteFill key={i} style={{ opacity, justifyContent: "center", alignItems: "center" }}>
            {/* Glow behind image */}
            <div style={{
              position: "absolute", width: 600, height: 400, borderRadius: "50%",
              background: `radial-gradient(ellipse, ${colors.primary}${Math.round(glowAmt * 30).toString(16).padStart(2, "0")} 0%, transparent 65%)`,
              filter: "blur(40px)", top: "30%",
            }} />

            <Img
              src={staticFile(img.path)}
              style={{
                width: 900, maxHeight: 1000, objectFit: "contain", borderRadius: 24,
                transform: `scale(${scale})`,
                filter: `drop-shadow(0 20px 60px ${PD_COLORS.bg}cc) drop-shadow(0 4px 20px ${colors.primary}25)`,
              }}
            />

            {/* Nav dots */}
            <div style={{ position: "absolute", bottom: 360, display: "flex", gap: 12, justifyContent: "center", width: "100%" }}>
              {images.map((_, di) => (
                <div key={di} style={{
                  width: di === i ? 28 : 10, height: 10, borderRadius: 5,
                  backgroundColor: di === i ? colors.accent : `${PD_COLORS.text}25`,
                  transition: "width 0.2s",
                }} />
              ))}
            </div>

            {/* Headline */}
            <div style={{
              position: "absolute", bottom: 200, width: "100%", textAlign: "center",
              opacity: headlineOp, transform: `translateY(${headlineY}px)`,
              padding: "0 60px", display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <span style={{
                fontFamily: "Inter", fontWeight: 700, fontSize: 56, lineHeight: "66px",
                color: PD_COLORS.text, textShadow: `0 4px 30px ${PD_COLORS.bg}, 0 0 20px ${colors.primary}25`,
              }}>
                {img.headline}
              </span>
              <div style={{
                width: underlineW, height: 4, borderRadius: 2,
                background: `linear-gradient(90deg, ${colors.accent}, ${colors.primary})`,
                marginTop: 12, opacity: headlineOp,
              }} />
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
