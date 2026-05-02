/**
 * TEXTBLOCK — Universal animated text component
 * Renders any text role (headline, subheadline, body, bullet) with:
 *   - Engine-driven font, color, size, weight
 *   - Smooth spring/interpolate animations
 *   - Optional gradient text (premium feel)
 *   - Glow text-shadow
 *
 * Animations:
 *   fadeSlideUp  — fade in + slide up from below
 *   punchScale   — fast punch scale (0.3→1.0)
 *   glowPulse    — subtle scale pulse + glow
 *   popIn        — spring pop from small
 *   fadeIn       — simple opacity fade
 *   none         — instant, no animation
 */
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TextStyleConfig, TextAnimConfig } from "../../engine/types";

interface TextBlockProps {
  /** Text content to render */
  text: string;
  /** Typography style config from textEngine */
  style: TextStyleConfig;
  /** Animation config from textEngine */
  anim: TextAnimConfig;
  /** Additional CSS overrides */
  className?: string;
}

export const TextBlock: React.FC<TextBlockProps> = ({ text, style, anim }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Frame relative to animation start
  const animFrame = Math.max(0, frame - anim.delay);

  // ─── Animation calculations ────────────────────────────────

  let opacity = 1;
  let translateY = 0;
  let scale = 1;

  if (anim.animation === "fadeSlideUp") {
    const progress = spring({
      frame: animFrame,
      fps,
      config: { damping: anim.damping, stiffness: anim.stiffness },
    });
    opacity = progress;
    translateY = (1 - progress) * anim.slideDistance;
    scale = 1;
  }

  if (anim.animation === "punchScale") {
    const progress = spring({
      frame: animFrame,
      fps,
      config: { damping: anim.damping, stiffness: anim.stiffness, mass: 0.6 },
    });
    opacity = interpolate(progress, [0, 0.3, 1], [0, 0.8, 1]);
    scale = interpolate(progress, [0, 1], [anim.scaleFrom, anim.scaleTo]);
    translateY = 0;
  }

  if (anim.animation === "popIn") {
    const progress = spring({
      frame: animFrame,
      fps,
      config: { damping: anim.damping, stiffness: anim.stiffness },
    });
    opacity = progress;
    scale = interpolate(progress, [0, 1], [anim.scaleFrom, anim.scaleTo]);
    translateY = (1 - progress) * 10;
  }

  if (anim.animation === "glowPulse") {
    const progress = spring({
      frame: animFrame,
      fps,
      config: { damping: anim.damping, stiffness: anim.stiffness },
    });
    opacity = progress;
    // Subtle pulse after entry
    const pulse = animFrame > 20
      ? interpolate(animFrame % 60, [0, 30, 60], [1, 1.03, 1])
      : 1;
    scale = interpolate(progress, [0, 1], [anim.scaleFrom, anim.scaleTo]) * pulse;
  }

  if (anim.animation === "fadeIn") {
    const progress = spring({
      frame: animFrame,
      fps,
      config: { damping: anim.damping, stiffness: anim.stiffness },
    });
    opacity = progress;
  }

  if (anim.animation === "none") {
    opacity = 1;
    scale = 1;
    translateY = 0;
  }

  // Don't render before delay
  if (frame < anim.delay && anim.animation !== "none") {
    opacity = 0;
  }

  // ─── Build CSS ─────────────────────────────────────────────

  const baseStyle: React.CSSProperties = {
    fontFamily: `'${style.fontFamily}', system-ui, -apple-system, sans-serif`,
    fontWeight: style.fontWeight,
    fontSize: style.fontSize,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    color: style.color,
    opacity: opacity * style.opacity,
    textTransform: style.textTransform,
    textShadow: style.textShadow,
    transform: `translateY(${translateY}px) scale(${scale})`,
    willChange: "transform, opacity",
  };

  // Gradient text (premium effect)
  if (style.gradient) {
    return (
      <div
        style={{
          ...baseStyle,
          background: style.gradient,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {text}
      </div>
    );
  }

  return <div style={baseStyle}>{text}</div>;
};
