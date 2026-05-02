/**
 * CTA BUTTON — Animated call-to-action with glow pulse + shine
 * Premium button component for the final conversion scene.
 *
 * Features:
 *   - Pop-in spring animation
 *   - Glow pulse cycle (40-frame loop)
 *   - Shine sweep across surface
 *   - Theme-aware gradient fill
 *   - High contrast text
 *   - Engine-driven typography
 */
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TextStyleConfig, TextAnimConfig, ThemeConfig, TextColorPalette } from "../../engine/types";

interface CtaButtonProps {
  /** Button text */
  text: string;
  /** Typography config from textEngine */
  style: TextStyleConfig;
  /** Animation config from textEngine */
  anim: TextAnimConfig;
  /** Theme config for gradient colors */
  theme: ThemeConfig;
  /** Color palette for accent */
  palette: TextColorPalette;
}

export const CtaButton: React.FC<CtaButtonProps> = ({ text, style, anim, theme, palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animFrame = Math.max(0, frame - anim.delay);

  // ─── Entry animation (pop-in) ──────────────────────────────
  const entry = spring({
    frame: animFrame,
    fps,
    config: { damping: anim.damping, stiffness: anim.stiffness },
  });

  // ─── Glow pulse (40-frame cycle) ──────────────────────────
  const pulse = interpolate(animFrame % 40, [0, 20, 40], [1, 1.04, 1], {
    extrapolateRight: "clamp",
  });

  const scale = interpolate(entry, [0, 1], [anim.scaleFrom, anim.scaleTo]) * pulse;

  // ─── Shine sweep ──────────────────────────────────────────
  const shineX = interpolate(animFrame, [10, 45], [-200, 600], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ─── Glow shadow intensity ─────────────────────────────────
  const glowIntensity = interpolate(animFrame % 60, [0, 30, 60], [0.4, 0.7, 0.4], {
    extrapolateRight: "clamp",
  });

  // Don't render before delay
  if (frame < anim.delay) return null;

  return (
    <div style={{
      display: "inline-block",
      padding: "20px 56px",
      borderRadius: 50,
      background: `linear-gradient(135deg, ${palette.accent}, ${theme.rimWarm})`,
      transform: `scale(${scale})`,
      opacity: entry,
      position: "relative",
      overflow: "hidden",
      boxShadow: `
        0 8px 40px ${palette.accent}${Math.round(glowIntensity * 80).toString(16).padStart(2, "0")},
        0 0 80px ${palette.accent}${Math.round(glowIntensity * 30).toString(16).padStart(2, "0")}
      `,
    }}>
      {/* Button text */}
      <span style={{
        fontFamily: `'${style.fontFamily}', system-ui, -apple-system, sans-serif`,
        fontWeight: style.fontWeight,
        fontSize: style.fontSize,
        letterSpacing: style.letterSpacing,
        lineHeight: style.lineHeight,
        color: style.color,
        textTransform: style.textTransform,
        position: "relative",
        zIndex: 1,
      }}>
        {text}
      </span>

      {/* Shine sweep */}
      <div style={{
        position: "absolute",
        top: 0,
        left: shineX,
        width: 80,
        height: "100%",
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
        transform: "skewX(-20deg)",
        zIndex: 2,
      }} />
    </div>
  );
};
