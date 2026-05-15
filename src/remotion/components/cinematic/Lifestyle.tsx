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

  const validImages = images.filter((img) => img.src && img.src.trim().length > 0);
  const imageCount = Math.max(1, validImages.length);
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

  // Spring entries
  const headerS = spring({ frame: frame - 8,  fps, config: { damping: 14, stiffness: 130 } });
  const countS  = spring({ frame: frame - 15, fps, config: { damping: 14 } });
  const labelS  = spring({ frame: frame - 30, fps, config: { damping: 16 } });
  const textS   = spring({ frame: frame - 20, fps, config: { damping: 14, stiffness: 120 } });

  // Pulsing ring for educational mode
  const ringScale   = interpolate(frame, [10, 80], [0.7, 1.08], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ringOpacity = 0.08 + 0.06 * Math.sin(frame * 0.05);
  const glowSize    = interpolate(frame, [0, durationInFrames], [280, 500], { extrapolateRight: "clamp" });
  const lineW       = interpolate(frame, [20, 60], [0, 220], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── EDUCATIONAL MODE — no product images ──
  // Show a bold social proof / key fact block over the video background
  if (validImages.length === 0) {
    const proofLabel = socialProofText || "people learned this";
    const hasNumber  = typeof socialProofNumber === "number";

    return (
      <AbsoluteFill style={{ opacity: sceneOpacity }}>
        <LightingOverlay config={lighting} glowCenter="50% 50%" showSweep={false} />

        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: "45%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: glowSize, height: glowSize, borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.color}18 0%, transparent 70%)`,
          filter: "blur(50px)", pointerEvents: "none",
        }} />

        {/* Pulsing ring */}
        <div style={{
          position: "absolute", top: "42%", left: "50%",
          transform: `translate(-50%, -50%) scale(${ringScale})`,
          width: 380, height: 380, borderRadius: "50%",
          border: `1.5px solid ${theme.color}40`,
          boxShadow: `0 0 50px ${theme.color}18, inset 0 0 40px ${theme.color}08`,
          opacity: ringOpacity * 4,
        }} />

        {/* Section label */}
        <div style={{
          position: "absolute", top: "24%", left: 0, right: 0,
          textAlign: "center",
          opacity: headerS, transform: `translateY(${(1 - headerS) * 18}px)`,
        }}>
          <div style={{
            display: "inline-block",
            padding: "10px 28px",
            borderRadius: 40,
            background: `linear-gradient(135deg, ${theme.color}20 0%, ${theme.color}0c 100%)`,
            border: `1.5px solid ${theme.color}45`,
            boxShadow: `0 0 30px ${theme.color}20`,
          }}>
            <span style={{
              fontSize: 20,
              fontWeight: 700,
              color: theme.color,
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "0.10em",
              textTransform: "uppercase" as const,
            }}>
              By The Numbers
            </span>
          </div>
        </div>

        {/* Top accent line */}
        <div style={{
          position: "absolute", top: "36%", left: "50%",
          transform: "translateX(-50%)",
          width: lineW, height: 2, borderRadius: 1,
          background: `linear-gradient(90deg, transparent, ${theme.color}70, transparent)`,
        }} />

        {/* Main stat / proof block */}
        <div style={{
          position: "absolute", top: "38%", left: 0, right: 0,
          textAlign: "center", padding: "0 60px",
        }}>
          {hasNumber ? (
            <>
              <div style={{
                fontSize: textConfig?.headline.fontSize ?? 96,
                fontWeight: 900,
                color: theme.color,
                fontFamily: "'Inter', sans-serif",
                letterSpacing: "-0.04em",
                lineHeight: 1,
                textShadow: `0 0 60px ${theme.color}50, 0 4px 24px rgba(0,0,0,0.8)`,
                opacity: countS,
                transform: `scale(${0.7 + 0.3 * countS})`,
              }}>
                {displayNumber.toLocaleString()}+
              </div>
              <div style={{
                fontSize: textConfig?.subheadline.fontSize ?? 36,
                fontWeight: textConfig?.subheadline.fontWeight ?? 600,
                color: "rgba(255,255,255,0.82)",
                fontFamily: "'Inter', sans-serif",
                marginTop: 20,
                letterSpacing: "0.02em",
                opacity: labelS,
                transform: `translateY(${(1 - labelS) * 14}px)`,
                textShadow: "0 3px 14px rgba(0,0,0,0.6)",
              }}>
                {proofLabel}
              </div>
            </>
          ) : (
            /* No number — show proof text as a bold kinetic statement */
            <div style={{
              fontSize: textConfig?.headline.fontSize ?? 72,
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "'Inter', sans-serif",
              letterSpacing: "-0.02em",
              lineHeight: 1.18,
              textShadow: `0 4px 28px rgba(0,0,0,0.75), 0 0 60px ${theme.color}20`,
              opacity: textS,
              transform: `translateY(${(1 - textS) * 24}px)`,
            }}>
              {proofLabel}
            </div>
          )}
        </div>

        {/* Bottom accent line */}
        <div style={{
          position: "absolute", top: "72%", left: "50%",
          transform: "translateX(-50%)",
          width: lineW * 0.7, height: 1.5, borderRadius: 1,
          background: `linear-gradient(90deg, transparent, ${theme.color}50, transparent)`,
        }} />
      </AbsoluteFill>
    );
  }

  // ── PRODUCT / IMAGE MODE — lifestyle images with slow pan ──
  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      <LightingOverlay config={lighting} glowCenter="50% 55%" showSweep={false} />

      {validImages.map((img, i) => {
        const startFrame = i * (framesPerImage - crossfade);
        const endFrame = startFrame + framesPerImage;
        const localFrame = frame - startFrame;

        const imgOpacity = imageCount === 1
          ? 1
          : interpolate(
              frame,
              [startFrame, startFrame + crossfade, Math.min(endFrame - crossfade, durationInFrames), Math.min(endFrame, durationInFrames)],
              [i === 0 ? 1 : 0, 1, 1, i === imageCount - 1 ? 1 : 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

        if (imgOpacity <= 0) return null;

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
                width: "100%", height: "100%", objectFit: "cover",
                transform: `scale(${zoom}) translateX(${panX}px)`,
              }}
            />
            <AbsoluteFill style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 35%, rgba(0,0,0,0.05) 100%)",
            }} />
          </AbsoluteFill>
        );
      })}

      {/* Social proof counter */}
      {(socialProofNumber || socialProofText) && (
        <div style={{
          position: "absolute", bottom: 220, left: 0, right: 0, textAlign: "center",
        }}>
          {socialProofNumber && (
            <div style={{
              fontSize: textConfig?.headline.fontSize ?? 72,
              fontWeight: textConfig?.headline.fontWeight ?? 800,
              color: textConfig?.colors.accent ?? theme.color,
              fontFamily: `'${textConfig?.headline.fontFamily ?? "Inter"}', sans-serif`,
              letterSpacing: textConfig?.headline.letterSpacing ?? "-0.02em",
              textShadow: textConfig?.headline.textShadow ?? `0 0 40px ${theme.color}40`,
              opacity: countS,
            }}>
              {displayNumber.toLocaleString()}+
            </div>
          )}
          {socialProofText && (
            <div style={{
              fontSize: textConfig?.subheadline.fontSize ?? 36,
              fontWeight: textConfig?.subheadline.fontWeight ?? 600,
              color: textConfig?.colors.secondary ?? "rgba(255,255,255,0.7)",
              fontFamily: `'${textConfig?.subheadline.fontFamily ?? "Inter"}', sans-serif`,
              marginTop: 8,
              opacity: labelS,
              textShadow: textConfig?.subheadline.textShadow ?? "0 2px 10px rgba(0,0,0,0.5)",
            }}>
              {socialProofText}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
