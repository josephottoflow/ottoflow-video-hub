/**
 * CTA SCENE — Final conversion close
 * Maximum glow intensity, hero callback, pulsing CTA button, urgency.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationVariant, LightingConfig, ThemeConfig, SceneTextConfig } from "../../engine/types";
import { LightingOverlay } from "./LightingOverlay";
import { depthShadowCSS } from "../../engine/lightingEngine";
import { resolveImage } from "../../engine/resolveImage";
import { TikTokBasket } from "./TikTokBasket";

interface CtaSceneProps {
  src: string;
  headline: string;
  ctaText: string;
  variant: AnimationVariant;
  lighting: LightingConfig;
  theme: ThemeConfig;
  /** Text Engine config for this scene */
  textConfig?: SceneTextConfig;
  /** Price tag for TikTok basket */
  price?: string;
  /** CTA style: tiktok-basket (default) or classic */
  ctaStyle?: "tiktok-basket" | "classic";
}

export const CtaScene: React.FC<CtaSceneProps> = ({
  src,
  headline,
  ctaText,
  variant,
  lighting,
  theme,
  textConfig,
  price,
  ctaStyle = "tiktok-basket",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entry
  const entry = spring({ frame, fps, config: { damping: 10, stiffness: 180 } });

  // Product float
  const floatY = Math.sin(frame * 0.05 * variant.floatSpeed) * (variant.floatAmplitude * 1.2);
  const scale = interpolate(frame, [0, 30], [0.9, 1.0], { extrapolateRight: "clamp" });

  // Scene fade
  const opacity = interpolate(frame, [0, 8, durationInFrames - 8, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // CTA button
  const ctaEntry = spring({ frame: frame - 25, fps, config: { damping: 12, stiffness: 150 } });
  const ctaPulse = interpolate(frame % 40, [0, 20, 40], [1, 1.04, 1], { extrapolateRight: "clamp" });

  // Shine sweep on CTA
  const shine = interpolate(frame, [35, 70], [-200, 600], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Headline
  const headS = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 160 } });

  // Radial glow explosion behind product
  const glowExpand = interpolate(frame, [0, 40], [100, 700], { extrapolateRight: "clamp" });
  const glowOpacity = interpolate(frame, [0, 20, 40], [0, 0.15, 0.08], { extrapolateRight: "clamp" });

  // Urgency ring
  const ringScale = interpolate(frame, [15, 50], [0.5, 1.3], { extrapolateRight: "clamp" });
  const ringOpacity = interpolate(frame, [15, 35, 50], [0.4, 0.2, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity }}>
      <LightingOverlay config={lighting} glowCenter="50% 40%" />

      {/* Expanding glow */}
      <div style={{
        position: "absolute",
        top: "40%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: glowExpand,
        height: glowExpand,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${theme.color}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
        filter: "blur(25px)",
      }} />

      {/* Urgency ring */}
      <div style={{
        position: "absolute",
        top: "40%",
        left: "50%",
        transform: `translate(-50%, -50%) scale(${ringScale})`,
        width: 400,
        height: 400,
        borderRadius: "50%",
        border: `2px solid ${theme.color}`,
        opacity: ringOpacity,
      }} />

      {/* Product image */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 350 }}>
        <Img
          src={resolveImage(src)}
          style={{
            maxWidth: 550,
            maxHeight: 700,
            objectFit: "contain",
            transform: `translateY(${floatY}px) scale(${entry * scale})`,
            filter: `drop-shadow(${depthShadowCSS(lighting)}) brightness(1.05)`,
          }}
        />
      </AbsoluteFill>

      {/* Headline */}
      <div style={{
        position: "absolute",
        bottom: 350,
        left: 0,
        right: 0,
        textAlign: "center",
        padding: `0 ${textConfig?.layout.paddingX ?? 60}px`,
      }}>
        <div style={{
          fontSize: textConfig?.headline.fontSize ?? 48,
          fontWeight: textConfig?.headline.fontWeight ?? 800,
          color: textConfig?.colors.primary ?? "#ffffff",
          fontFamily: `'${textConfig?.headline.fontFamily ?? "Inter"}', sans-serif`,
          letterSpacing: textConfig?.headline.letterSpacing ?? "-0.02em",
          opacity: headS,
          transform: `scale(${headS})`,
          textShadow: textConfig?.headline.textShadow ?? `0 4px 20px rgba(0,0,0,0.5), 0 0 60px ${theme.color}15`,
        }}>
          {headline}
        </div>
      </div>

      {/* CTA Button — TikTok Yellow Basket (default) or Classic */}
      <div style={{
        position: "absolute",
        bottom: 220,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
      }}>
        {ctaStyle === "tiktok-basket" ? (
          <TikTokBasket
            text={ctaText}
            price={price}
            theme={theme}
            delay={25}
            variant="basket"
          />
        ) : (
          <div style={{
            display: "inline-block",
            padding: "20px 56px",
            borderRadius: 50,
            background: `linear-gradient(135deg, ${theme.color}, ${theme.rimWarm})`,
            fontSize: textConfig?.cta.fontSize ?? 30,
            fontWeight: textConfig?.cta.fontWeight ?? 700,
            color: textConfig?.colors.contrast ?? "#ffffff",
            fontFamily: `'${textConfig?.cta.fontFamily ?? "Inter"}', sans-serif`,
            letterSpacing: textConfig?.cta.letterSpacing ?? "0.04em",
            textTransform: (textConfig?.cta.textTransform ?? "uppercase") as React.CSSProperties["textTransform"],
            boxShadow: `0 8px 40px ${theme.color}50, 0 0 80px ${theme.color}20`,
            transform: `scale(${ctaEntry * ctaPulse})`,
            opacity: ctaEntry,
            position: "relative",
            overflow: "hidden",
          }}>
            {ctaText}
            <div style={{
              position: "absolute",
              top: 0,
              left: shine,
              width: 80,
              height: "100%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
              transform: "skewX(-20deg)",
            }} />
          </div>
        )}
      </div>

      {/* Bottom accent line */}
      <div style={{
        position: "absolute",
        bottom: 180,
        left: "50%",
        transform: "translateX(-50%)",
        width: interpolate(frame, [50, 80], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        height: 3,
        borderRadius: 2,
        background: `linear-gradient(90deg, transparent, ${theme.color}, transparent)`,
        opacity: 0.5,
      }} />
    </AbsoluteFill>
  );
};
