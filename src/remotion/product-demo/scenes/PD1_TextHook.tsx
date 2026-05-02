/**
 * PRODUCT DEMO SCENE 1 — TEXT HOOK (3s / 90 frames)
 * hook.painPointQuestion slams in word by word.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BrandColors, HookScene } from "../../types";
import { PD_COLORS, PD_WIDTH, PD_HEIGHT } from "../types";
import { PexelsBackground } from "../../components/PexelsBackground";

interface Props {
  data: HookScene;
  colors: BrandColors;
  backgroundSrc?: string;
}

export const PD1_TextHook: React.FC<Props> = ({ data, colors, backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = data.painPointQuestion.split(" ");
  const fadeIn = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [75, 90], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: PD_COLORS.bg, opacity: fadeIn * fadeOut }}>
      {backgroundSrc && <PexelsBackground src={backgroundSrc} overlay={0.6} gradient="both" />}
      {/* Radial glow */}
      <div style={{
        position: "absolute", width: PD_WIDTH, height: PD_HEIGHT,
        background: `radial-gradient(ellipse at 50% 45%, ${colors.primary}18 0%, transparent 55%)`,
      }} />
      {/* Scan line */}
      <div style={{
        position: "absolute", width: PD_WIDTH, height: 2, backgroundColor: `${colors.primary}20`,
        top: interpolate(frame, [0, 90], [400, 1500], { extrapolateRight: "clamp" }),
      }} />

      <div style={{ width: 920, textAlign: "center", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "6px 18px", padding: "0 40px" }}>
        {words.map((word, i) => {
          const delay = i * 4 + 5;
          const s = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 10, stiffness: 180 }, from: 1.8, to: 1 });
          const op = interpolate(frame, [delay, delay + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const isAccent = i === 0 || i === words.length - 1;
          return (
            <span key={i} style={{
              fontFamily: "Inter", fontWeight: 800, fontSize: words.length > 6 ? 64 : 80, lineHeight: words.length > 6 ? "78px" : "96px",
              color: isAccent ? colors.accent : PD_COLORS.text, opacity: op, transform: `scale(${s})`, display: "inline-block",
              textShadow: isAccent ? `0 0 40px ${colors.accent}50` : `0 4px 20px ${PD_COLORS.bg}`,
            }}>
              {word}
            </span>
          );
        })}
      </div>

      {/* Accent line */}
      <div style={{
        position: "absolute", bottom: 300, left: "50%", transform: "translateX(-50%)",
        width: interpolate(frame, [40, 65], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        height: 4, borderRadius: 2,
        background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
      }} />
    </AbsoluteFill>
  );
};
