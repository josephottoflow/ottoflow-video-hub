/**
 * LIFESTYLE SCENE — Slow pan + slight blur for cinematic depth
 * Shows the product in context/real-world usage.
 * Multiple images cycle with smooth crossfades.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationVariant, LightingConfig, ThemeConfig, SceneTextConfig } from "../../engine/types";
import { LightingOverlay } from "./LightingOverlay";
import { resolveImage } from "../../engine/resolveImage";

interface LifestyleProps {
  images: { src: string }[];
  socialProofText?: string;
  socialProofNumber?: number;
  variant: AnimationVariant;
  lighting: LightingConfig;
  theme: ThemeConfig;
  /** Text Engine config for this scene */
  textConfig?: SceneTextConfig;
}

export const Lifestyle: React.FC<LifestyleProps> = ({
  images,
  socialProofText,
  socialProofNumber,
  variant,
  lighting,
  theme,
  textConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const imageCount = Math.max(1, images.length);
  // Add overlap so crossfades don't create black gaps
  const crossfade = imageCount > 1 ? 18 : 0;
  const framesPerImage = imageCount > 1
    ? Math.floor((durationInFrames + crossfade * (imageCount - 1)) / imageCount)
    : durationInFrames;

  const sceneOpacity = interpolate(frame, [0, 12, durationInFrames - 12, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Counting animation for social proof
  const countEnd = durationInFrames * 0.6;
  const displayNumber = socialProofNumber
    ? Math.floor(interpolate(frame, [30, countEnd], [0, socialProofNumber], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
    : 0;

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      <LightingOverlay config={lighting} glowCenter="50% 55%" showSweep={false} />

      {/* Lifestyle images with slow pan */}
      {images.map((img, i) => {
        const startFrame = i * (framesPerImage - crossfade);
        const endFrame = startFrame + framesPerImage;
        const localFrame = frame - startFrame;

        // Single image: always visible. Multiple: crossfade in/out (last image stays)
        const imgOpacity = imageCount === 1
          ? 1
          : interpolate(
              frame,
              [startFrame, startFrame + crossfade, Math.min(endFrame - crossfade, durationInFrames), Math.min(endFrame, durationInFrames)],
              [i === 0 ? 1 : 0, 1, 1, i === imageCount - 1 ? 1 : 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

        if (imgOpacity <= 0) return null;

        // Slow pan — alternating direction
        const panX = interpolate(
          localFrame,
          [0, framesPerImage],
          [0, variant.panDistance * (i % 2 === 0 ? 1 : -1)],
          { extrapolateRight: "clamp" }
        );
        const zoom = interpolate(localFrame, [0, framesPerImage], [variant.zoomFrom, variant.zoomTo], { extrapolateRight: "clamp" });

        return (
          <AbsoluteFill key={i} style={{ opacity: imgOpacity }}>
            <Img
              src={resolveImage(img.src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${zoom}) translateX(${panX}px)`,
              }}
            />
            {/* Cinematic overlay */}
            <AbsoluteFill style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 35%, rgba(0,0,0,0.05) 100%)",
            }} />
          </AbsoluteFill>
        );
      })}

      {/* Social proof counter */}
      {socialProofNumber && socialProofText && (
        <div style={{
          position: "absolute",
          bottom: 220,
          left: 0,
          right: 0,
          textAlign: "center",
        }}>
          <div style={{
            fontSize: textConfig?.headline.fontSize ?? 72,
            fontWeight: textConfig?.headline.fontWeight ?? 800,
            color: textConfig?.colors.accent ?? theme.color,
            fontFamily: `'${textConfig?.headline.fontFamily ?? "Inter"}', sans-serif`,
            letterSpacing: textConfig?.headline.letterSpacing ?? "-0.02em",
            textShadow: textConfig?.headline.textShadow ?? `0 0 40px ${theme.color}40`,
            opacity: spring({ frame: frame - 15, fps, config: { damping: 14 } }),
          }}>
            {displayNumber.toLocaleString()}+
          </div>
          <div style={{
            fontSize: textConfig?.subheadline.fontSize ?? 24,
            fontWeight: textConfig?.subheadline.fontWeight ?? 500,
            color: textConfig?.colors.secondary ?? "rgba(255,255,255,0.7)",
            fontFamily: `'${textConfig?.subheadline.fontFamily ?? "Inter"}', sans-serif`,
            marginTop: 8,
            opacity: spring({ frame: frame - 30, fps, config: { damping: 16 } }),
            textShadow: textConfig?.subheadline.textShadow ?? "0 2px 10px rgba(0,0,0,0.5)",
          }}>
            {socialProofText}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
,
            letterSpacing: textConfig?.headline.letterSpacing ?? "-0.02em",
            textShadow: textConfig?.headline.textShadow ?? `0 0 40px ${theme.color}40`,
            opacity: spring({ frame: frame - 15, fps, config: { damping: 14 } }),
          }}>
            {displayNumber.toLocaleString()}+
          </div>
          <div style={{
            fontSize: textConfig?.subheadline.fontSize ?? 24,
            fontWeight: textConfig?.subheadline.fontWeight ?? 500,
            color: textConfig?.colors.secondary ?? "rgba(255,255,255,0.7)",
            fontFamily: `'${textConfig?.subheadline.fontFamily ?? "Inter"}', sans-serif`,
            marginTop: 8,
            opacity: spring({ frame: frame - 30, fps, config: { damping: 16 } }),
            textShadow: textConfig?.subheadline.textShadow ?? "0 2px 10px rgba(0,0,0,0.5)",
          }}>
            {socialProofText}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
