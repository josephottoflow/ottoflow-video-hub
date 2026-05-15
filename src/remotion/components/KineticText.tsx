/**
 * KINETIC TEXT — Word-by-word animated text reveal
 *
 * Variants:
 *   spring      — default word-level spring reveal (bottom-up fade-in)
 *   maskReveal  — each word clips out from behind a horizontal mask
 *   glitch      — fast horizontal jitter + scale punch per word
 *   cascade     — words fall in from above with overshoot spring
 *   wave        — words float in on a staggered sine curve
 */
import React from "react";
import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export type KineticVariant = "spring" | "maskReveal" | "glitch" | "cascade" | "wave";

interface KineticTextProps {
  text: string;
  startFrame?: number;
  wordStagger?: number;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  color?: string;
  accentColor?: string;
  lineHeight?: string | number;
  textAlign?: "left" | "center" | "right";
  textShadow?: string;
  letterSpacing?: string;
  variant?: KineticVariant;
  style?: React.CSSProperties;
}

export const KineticText: React.FC<KineticTextProps> = ({
  text,
  startFrame = 0,
  wordStagger = 6,
  fontSize = 52,
  fontWeight = 800,
  fontFamily = "'Space Grotesk', 'Inter', sans-serif",
  color = "#ffffff",
  accentColor,
  lineHeight = 1.15,
  textAlign = "center",
  textShadow = "0 4px 24px rgba(0,0,0,0.95), 0 2px 6px rgba(0,0,0,1)",
  letterSpacing = "-0.02em",
  variant = "spring",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(/\s+/).filter(Boolean);
  const justifyContent =
    textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start";

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight,
        color,
        lineHeight,
        textAlign,
        textShadow,
        letterSpacing,
        display: "flex",
        flexWrap: "wrap",
        justifyContent,
        columnGap: "0.28em",
        rowGap: "0.12em",
        ...style,
      }}
    >
      {words.map((word, i) => {
        const bare = word.replace(/[^A-Za-z]/g, "");
        const isAccent =
          accentColor &&
          (/[\d%$×]/.test(word) || (bare.length >= 2 && bare === bare.toUpperCase()));

        const wordColor = isAccent ? accentColor! : color;
        const wordShadow = isAccent && accentColor
          ? `0 0 28px ${accentColor}90, ${textShadow}`
          : textShadow;

        const s = spring({
          frame: frame - (startFrame + i * wordStagger),
          fps,
          config: { damping: 12, stiffness: 220, mass: 0.65 },
        });

        let wordStyle: React.CSSProperties = { display: "inline-block" };

        if (variant === "spring") {
          wordStyle = {
            ...wordStyle,
            opacity: Math.min(1, s),
            transform: `translateY(${(1 - s) * 22}px) scale(${0.84 + 0.16 * s})`,
          };

        } else if (variant === "maskReveal") {
          const clipS = spring({
            frame: frame - (startFrame + i * wordStagger),
            fps,
            config: { damping: 16, stiffness: 260, mass: 0.5 },
          });
          wordStyle = {
            ...wordStyle,
            opacity: 1,
            transform: `translateY(${(1 - clipS) * 36}px)`,
            clipPath: `inset(0 0 ${(1 - clipS) * 100}% 0)`,
          };

        } else if (variant === "glitch") {
          const gs = spring({
            frame: frame - (startFrame + i * wordStagger),
            fps,
            config: { damping: 5, stiffness: 500, mass: 0.4 },
          });
          // Quick horizontal jitter on first 6 frames post-trigger
          const elapsed = frame - (startFrame + i * wordStagger);
          const jitter = elapsed >= 0 && elapsed < 6
            ? Math.sin(elapsed * 4.7) * 8 * (1 - elapsed / 6)
            : 0;
          wordStyle = {
            ...wordStyle,
            opacity: Math.min(1, gs * 2),
            transform: `translateX(${jitter}px) scale(${0.6 + 0.4 * gs})`,
            filter: elapsed >= 0 && elapsed < 4
              ? `blur(${(1 - gs) * 3}px)`
              : undefined,
          };

        } else if (variant === "cascade") {
          const cs = spring({
            frame: frame - (startFrame + i * wordStagger),
            fps,
            config: { damping: 9, stiffness: 280, mass: 0.55 },
          });
          wordStyle = {
            ...wordStyle,
            opacity: Math.min(1, cs * 1.5),
            transform: `translateY(${(1 - cs) * -40}px) scale(${0.75 + 0.25 * cs})`,
          };

        } else if (variant === "wave") {
          const ws = spring({
            frame: frame - (startFrame + i * wordStagger),
            fps,
            config: { damping: 14, stiffness: 180, mass: 0.6 },
          });
          // After entry, add gentle sine wave
          const waveOffset = ws > 0.95
            ? Math.sin((frame - startFrame) * 0.08 + i * 0.6) * 4
            : 0;
          wordStyle = {
            ...wordStyle,
            opacity: Math.min(1, ws),
            transform: `translateY(${(1 - ws) * 30 + waveOffset}px)`,
          };
        }

        return (
          <span key={i} style={{ ...wordStyle, color: wordColor, textShadow: wordShadow }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};
