/**
 * HERO SCENE — Main product showcase
 * Apple-style floating product with subtle rotateY + scale up.
 * sin-wave float, cinematic entry, glow intensification.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationVariant, LightingConfig, ThemeConfig, SceneTextConfig } from "../../engine/types";
import { depthShadowCSS } from "../../engine/lightingEngine";
import { LightingOverlay } from "./LightingOverlay";
import { resolveImage } from "../../engine/resolveImage";
import { TextBlock } from "./TextBlock";

interface HeroProps {
  src: string;
  headline: string;
  subheadline: string;
  variant: AnimationVariant;
  lighting: LightingConfig;
  theme: ThemeConfig;
  /** Text Engine config for this scene */
  textConfig?: SceneTextConfig;
}

export const Hero: React.FC<HeroProps> = ({ src, headline, subheadline, variant, lighting, theme, textConfig }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entry spring
  const entry = spring({ frame, fps, config: { damping: variant.springDamping, stiffness: variant.springStiffness } });

  // Floating sin wave
  const floatY = Math.sin(frame * 0.04 * variant.floatSpeed) * variant.floatAmplitude;

  // Subtle rotateY oscillation
  const rotateY = Math.sin(frame * 0.025) * variant.rotateAmount;

  // Scale ramp up
  const scale = interpolate(frame, [0, durationInFrames * 0.7], [variant.zoomFrom, variant.zoomTo], { extrapolateRight: "clamp" });

  // Fade in/out
  const opacity = interpolate(frame, [0, 15, durationInFrames - 12, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Text entry
  const headlineS = spring({ frame: frame - 20, fps, config: { damping: 14, stiffness: 120 } });
  const subS = spring({ frame: frame - 35, fps, config: { damping: 16, stiffness: 100 } });

  // Glow behind product
  const glowSize = interpolate(frame, [10, 60], [0, 600], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity }}>
      <LightingOverlay config={lighting} glowCenter="50% 50%" />

      {/* Product glow halo */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -55%)",
        width: glowSize,
        height: glowSize,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${theme.color}15 0%, ${theme.color}08 40%, transparent 70%)`,
        filter: "blur(20px)",
      }} />

      {/* Product image — floating + rotateY */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 200 }}>
        <Img
          src={resolveImage(src)}
          style={{
            maxWidth: 700,
            maxHeight: 900,
            objectFit: "contain",
            transform: `translateY(${floatY}px) scale(${entry * scale}) perspective(1200px) rotateY(${rotateY}deg)`,
            filter: `drop-shadow(${depthShadowCSS(lighting)})`,
          }}
        />
      </AbsoluteFill>

      {/* Headline + Subheadline — Engine-driven typography */}
      <div style={{
        position: "absolute",
        bottom: 260,
        left: 0,
        right: 0,
        textAlign: "center",
        padding: `0 ${textConfig?.layout.paddingX ?? 60}px`,
      }}>
        {textConfig ? (
          <>
            <TextBlock text={headline} style={textConfig.headline} anim={textConfig.headlineAnim} />
            <div style={{ marginTop: 16 }}>
              <TextBlock text={subheadline} style={textConfig.subheadline} anim={textConfig.subheadlineAnim} />
            </div>
          </>
        ) : (
          <>
            <div style={{
              fontSize: 56,
              fontWeight: 800,
              color: "#ffffff",
              fontFamily: "'Inter', sans-serif",
              lineHeight: "64px",
              opacity: headlineS,
              transform: `translateY(${(1 - headlineS) * 30}px)`,
              textShadow: `0 4px 30px rgba(0,0,0,0.5), 0 0 60px ${theme.color}20`,
            }}>
              {headline}
            </div>
            <div style={{
              fontSize: 24,
              fontWeight: 500,
              color: "rgba(255,255,255,0.7)",
              fontFamily: "'Inter', sans-serif",
              marginTop: 16,
              opacity: subS,
              transform: `translateY(${(1 - subS) * 20}px)`,
              letterSpacing: "0.5px",
            }}>
              {subheadline}
            </div>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
