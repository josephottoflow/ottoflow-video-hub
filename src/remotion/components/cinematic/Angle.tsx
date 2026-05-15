/**
 * ANGLE SCENE — Slide in + fade, used for Hook and fallback scenes
 * Eye-catching entry animation to grab attention.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CameraMotionBlur } from "@remotion/motion-blur";
import type { AnimationVariant, LightingConfig, ThemeConfig, SceneTextConfig } from "../../engine/types";
import { LightingOverlay } from "./LightingOverlay";
import { depthShadowCSS } from "../../engine/lightingEngine";
import { resolveImage } from "../../engine/resolveImage";
import { TextBlock } from "./TextBlock";

interface AngleProps {
  src: string;
  /** Main text for the scene */
  text: string;
  /** Optional secondary text */
  subtext?: string;
  variant: AnimationVariant;
  lighting: LightingConfig;
  theme: ThemeConfig;
  /** Text Engine config for this scene */
  textConfig?: SceneTextConfig;
  /** Direction of slide entry */
  slideFrom?: "left" | "right" | "bottom";
}

export const Angle: React.FC<AngleProps> = ({
  src,
  text,
  subtext,
  variant,
  lighting,
  theme,
  textConfig,
  slideFrom = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entry spring
  const entry = spring({ frame, fps, config: { damping: variant.springDamping, stiffness: variant.springStiffness } });

  // Slide direction
  const slideDistance = 200;
  const slideX = slideFrom === "left" ? -(1 - entry) * slideDistance : slideFrom === "right" ? (1 - entry) * slideDistance : 0;
  const slideY = slideFrom === "bottom" ? (1 - entry) * slideDistance : 0;

  // Floating animation after entry
  const floatY = entry > 0.9 ? Math.sin(frame * 0.04 * variant.floatSpeed) * variant.floatAmplitude : 0;
  const rotateY = Math.sin(frame * 0.03) * variant.rotateAmount;

  // Scale
  const scale = interpolate(frame, [0, durationInFrames * 0.6], [variant.zoomFrom, variant.zoomTo], { extrapolateRight: "clamp" });

  // Scene fade
  const opacity = interpolate(frame, [0, 8, durationInFrames - 10, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Text animations
  const textS = spring({ frame: frame - 12, fps, config: { damping: 12, stiffness: 180 } });
  const subS = spring({ frame: frame - 25, fps, config: { damping: 14, stiffness: 140 } });

  // Flash on entry
  const flash = interpolate(frame, [0, 4, 12], [0.3, 0.15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity }}>
      <LightingOverlay config={lighting} />

      {/* Entry flash */}
      <AbsoluteFill style={{ backgroundColor: theme.color, opacity: flash }} />

      {/* Product image — only when a real src is provided */}
      {src && src.trim().length > 0 && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 250 }}>
          <div style={{
            position: "absolute",
            width: 500, height: 500, borderRadius: "50%",
            background: `radial-gradient(circle, ${theme.color}12 0%, transparent 70%)`,
            filter: "blur(30px)", opacity: entry,
          }} />
          <CameraMotionBlur shutterAngle={120} samples={8}>
            <Img
              src={resolveImage(src)}
              style={{
                maxWidth: 650, maxHeight: 850, objectFit: "contain",
                transform: `translate(${slideX}px, ${slideY + floatY}px) scale(${entry * scale}) perspective(1200px) rotateY(${rotateY}deg)`,
                filter: `drop-shadow(${depthShadowCSS(lighting)})`,
              }}
            />
          </CameraMotionBlur>
        </AbsoluteFill>
      )}

      {/* Text — centered when no product image, bottom otherwise */}
      <div style={{
        position: "absolute",
        ...(src && src.trim().length > 0
          ? { bottom: 280 }
          : { top: "50%", transform: "translateY(-50%)" }),
        left: 0,
        right: 0,
        textAlign: "center",
        padding: `0 ${textConfig?.layout.paddingX ?? 60}px`,
      }}>
        {textConfig ? (
          <>
            <TextBlock text={text} style={textConfig.headline} anim={textConfig.headlineAnim} />
            {subtext && (
              <div style={{ marginTop: 12 }}>
                <TextBlock text={subtext} style={textConfig.subheadline} anim={textConfig.subheadlineAnim} />
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{
              fontSize: 76,
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "'Inter', sans-serif",
              lineHeight: "86px",
              opacity: textS,
              transform: `translateY(${(1 - textS) * 25}px)`,
              textShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 40px ${theme.color}15`,
            }}>
              {text}
            </div>
            {subtext && (
              <div style={{
                fontSize: 36,
                fontWeight: 600,
                color: "rgba(255,255,255,0.65)",
                fontFamily: "'Inter', sans-serif",
                marginTop: 12,
                opacity: subS,
                transform: `translateY(${(1 - subS) * 15}px)`,
              }}>
                {subtext}
              </div>
            )}
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
