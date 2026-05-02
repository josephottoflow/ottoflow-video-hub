/**
 * PRODUCT DEMO SCENE 6 — SOCIAL PLATFORMS + PROOF (5s / 150 frames)
 * Social proof number counts up. Platform badges appear showing
 * where the product is trending.
 */
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BrandColors, SocialProofCtaScene } from "../../types";
import { PD_COLORS, PD_WIDTH, PD_HEIGHT } from "../types";

interface Props {
  data: SocialProofCtaScene;
  productName: string;
  colors: BrandColors;
}

const PLATFORMS = [
  { name: "TikTok Shop", icon: "♪", color: "#00f2ea", delay: 0 },
  { name: "Instagram", icon: "📷", color: "#e4405f", delay: 10 },
  { name: "YouTube", icon: "▶", color: "#ff0000", delay: 20 },
];

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
};

export const PD6_Social: React.FC<Props> = ({ data, productName, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [135, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Social proof counter
  const countRaw = interpolate(frame, [10, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const countProgress = 1 - Math.pow(1 - countRaw, 3);
  const displayNumber = data.socialProofNumber ? Math.floor(data.socialProofNumber * countProgress) : 0;
  const formatted = displayNumber.toLocaleString();

  const numberGlow = interpolate(frame, [10, 50, 80], [0, 35, 18], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Burst particles
  const particles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      speed: 80 + seededRandom(i * 5) * 120,
      size: 4 + seededRandom(i * 5 + 1) * 5,
    }));
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: PD_COLORS.bg, justifyContent: "center", alignItems: "center", opacity: fadeIn * fadeOut, overflow: "hidden" }}>
      {/* Background glow */}
      <div style={{
        position: "absolute", width: PD_WIDTH, height: PD_HEIGHT,
        background: `radial-gradient(ellipse at 50% 35%, ${colors.accent}10 0%, transparent 50%)`,
      }} />

      {/* Burst particles */}
      {data.socialProofNumber && frame > 15 && frame < 60 && particles.map((p, i) => {
        const bFrame = Math.max(0, frame - 15);
        const progress = interpolate(bFrame, [0, 35], [0, 1], { extrapolateRight: "clamp" });
        const bOp = interpolate(bFrame, [0, 10, 35], [0.7, 0.4, 0], { extrapolateRight: "clamp" });
        const x = Math.cos(p.angle) * p.speed * progress;
        const y = Math.sin(p.angle) * p.speed * progress;
        return (
          <div key={i} style={{
            position: "absolute", top: "30%", left: "50%",
            width: p.size, height: p.size, borderRadius: "50%", backgroundColor: colors.accent,
            opacity: bOp, transform: `translate(${x - p.size / 2}px, ${y - p.size / 2}px)`,
          }} />
        );
      })}

      {/* Social proof number */}
      {data.socialProofNumber && (
        <div style={{ textAlign: "center", marginBottom: 40, marginTop: -200 }}>
          <span style={{
            fontFamily: "Inter", fontWeight: 800, fontSize: 100, lineHeight: "110px", color: colors.accent,
            display: "block", textShadow: `0 0 ${numberGlow}px ${colors.accent}60`,
            letterSpacing: -2,
          }}>
            {formatted}+
          </span>
          {data.socialProofLabel && (
            <span style={{ fontFamily: "Inter", fontWeight: 400, fontSize: 36, color: `${PD_COLORS.text}aa`, display: "block", marginTop: 8 }}>
              {data.socialProofLabel}
            </span>
          )}
        </div>
      )}

      {/* "Trending on" label */}
      <div style={{
        position: "absolute", top: 950, width: PD_WIDTH, textAlign: "center",
        opacity: interpolate(frame, [40, 52], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <span style={{ fontFamily: "Inter", fontSize: 20, fontWeight: 500, color: PD_COLORS.textMuted, letterSpacing: 3, textTransform: "uppercase" }}>
          Trending on
        </span>
      </div>

      {/* Platform badges */}
      <div style={{
        position: "absolute", top: 1020, width: PD_WIDTH, display: "flex", justifyContent: "center", gap: 20, padding: "0 40px",
      }}>
        {PLATFORMS.map((plat, i) => {
          const pScale = spring({ frame: Math.max(0, frame - 50 - plat.delay), fps, config: { damping: 10, stiffness: 150 }, from: 0, to: 1 });
          const pOp = interpolate(frame, [50 + plat.delay, 60 + plat.delay], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={plat.name} style={{
              width: 270, padding: "20px 16px", borderRadius: 20,
              backgroundColor: PD_COLORS.bgCard, border: `1px solid ${plat.color}30`,
              textAlign: "center", opacity: pOp, transform: `scale(${pScale})`,
              boxShadow: `0 4px 20px ${plat.color}15`,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, backgroundColor: `${plat.color}20`,
                display: "flex", justifyContent: "center", alignItems: "center", margin: "0 auto 10px",
              }}>
                <span style={{ fontSize: 28, color: plat.color }}>{plat.icon}</span>
              </div>
              <span style={{ fontFamily: "Inter", fontSize: 16, fontWeight: 600, color: PD_COLORS.text }}>{plat.name}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
