/**
 * DETAIL SCENE — Ken Burns zoom + brightness boost
 * Shows detail/closeup shots with slow zoom and pan.
 * Multiple images cycle with crossfade transitions.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationVariant, LightingConfig, ThemeConfig, SceneTextConfig } from "../../engine/types";
import { LightingOverlay } from "./LightingOverlay";
import { resolveImage } from "../../engine/resolveImage";

interface DetailProps {
  images: { src: string; label?: string }[];
  bulletPoints?: string[];
  variant: AnimationVariant;
  lighting: LightingConfig;
  theme: ThemeConfig;
  /** Text Engine config for this scene */
  textConfig?: SceneTextConfig;
}

export const Detail: React.FC<DetailProps> = ({ images, bulletPoints, variant, lighting, theme, textConfig }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const imageCount = Math.max(1, images.length);
  const crossfadeDuration = imageCount > 1 ? 15 : 0;
  const framesPerImage = imageCount > 1
    ? Math.floor((durationInFrames + crossfadeDuration * (imageCount - 1)) / imageCount)
    : durationInFrames;

  // Fade in/out
  const sceneOpacity = interpolate(frame, [0, 10, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      <LightingOverlay config={lighting} glowCenter="50% 40%" />

      {/* Image carousel with Ken Burns */}
      {images.map((img, i) => {
        const startFrame = i * (framesPerImage - crossfadeDuration);
        const endFrame = startFrame + framesPerImage;
        const localFrame = frame - startFrame;

        // Single image: always visible. Multiple: crossfade in/out (last stays)
        const imgOpacity = imageCount === 1
          ? 1
          : interpolate(
              frame,
              [startFrame, startFrame + crossfadeDuration, Math.min(endFrame - crossfadeDuration, durationInFrames), Math.min(endFrame, durationInFrames)],
              [i === 0 ? 1 : 0, 1, 1, i === imageCount - 1 ? 1 : 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

        if (imgOpacity <= 0) return null;

        // Ken Burns: zoom from → to + pan
        const zoom = interpolate(localFrame, [0, framesPerImage], [variant.zoomFrom, variant.zoomTo], { extrapolateRight: "clamp" });
        const panX = interpolate(localFrame, [0, framesPerImage], [0, variant.panDistance * (i % 2 === 0 ? 1 : -1)], { extrapolateRight: "clamp" });
        const panY = interpolate(localFrame, [0, framesPerImage], [0, variant.panDistance * 0.5], { extrapolateRight: "clamp" });

        // Brightness boost on detail shots
        const brightness = interpolate(localFrame, [10, framesPerImage * 0.4], [0.9, 1.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

        return (
          <AbsoluteFill key={i} style={{ opacity: imgOpacity }}>
            <Img
              src={resolveImage(img.src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
                filter: `brightness(${brightness})`,
              }}
            />
            {/* Dark overlay for text readability */}
            <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.05) 100%)" }} />
          </AbsoluteFill>
        );
      })}

      {/* Bullet points — only render when product-specific text is provided */}
      {bulletPoints && bulletPoints.length > 0 && (
        <div style={{
          position: "absolute",
          bottom: 180,
          left: 60,
          right: 60,
        }}>
          {bulletPoints.slice(0, 3).map((point, i) => {
            const pointDelay = 20 + i * 18;
            const s = spring({ frame: frame - pointDelay, fps, config: { damping: 14, stiffness: 140 } });

            return (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 20,
                opacity: s,
                transform: `translateX(${(1 - s) * 80}px)`,
              }}>
                {/* Glowing dot */}
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  backgroundColor: theme.color,
                  boxShadow: `0 0 12px ${theme.color}60, 0 0 24px ${theme.color}30`,
                  flexShrink: 0,
                }} />
                <div style={{
                  fontSize: textConfig?.body.fontSize ?? 26,
                  fontWeight: textConfig?.body.fontWeight ?? 600,
                  color: textConfig?.colors.primary ?? "#ffffff",
                  fontFamily: `'${textConfig?.body.fontFamily ?? "Inter"}', sans-serif`,
                  letterSpacing: textConfig?.body.letterSpacing ?? "0em",
                  textShadow: textConfig?.body.textShadow ?? "0 2px 10px rgba(0,0,0,0.5)",
                }}>
                  {point}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
