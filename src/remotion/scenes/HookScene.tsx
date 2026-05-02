/**
 * SCENE 1 — HOOK (3s / 90 frames)
 * Bold pain-point question slams in from 2x scale.
 * Animated radial glow + subtle scan lines + floating particles.
 */

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BrandColors, HookScene } from "../types";
import { SAFE_ZONE, VIDEO_WIDTH, VIDEO_HEIGHT } from "../types";

interface Props {
  data: HookScene;
  colors: BrandColors;
}

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
};

export const HookSceneComponent: React.FC<Props> = ({ data, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.8 },
    from: 2,
    to: 1,
  });

  const opacity = interpolate(frame, [70, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowScale = interpolate(frame, [0, 45, 90], [0.6, 1.2, 0.6], {
    extrapolateRight: "clamp",
  });

  const glowOpacity = interpolate(frame, [0, 45, 90], [0.2, 0.5, 0.2], {
    extrapolateRight: "clamp",
  });

  const particles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      x: seededRandom(i * 7 + 1) * VIDEO_WIDTH,
      y: seededRandom(i * 7 + 2) * VIDEO_HEIGHT,
      size: 3 + seededRandom(i * 7 + 3) * 6,
      speed: 0.3 + seededRandom(i * 7 + 4) * 0.7,
      phase: seededRandom(i * 7 + 5) * Math.PI * 2,
    }));
  }, []);

  const textGlow = interpolate(frame, [0, 8, 20], [0, 80, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const rotation = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 200, mass: 0.6 },
    from: -3,
    to: 0,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      {/* Animated radial glow double layer */}
      <div
        style={{
          position: "absolute",
          width: VIDEO_WIDTH * 1.5,
          height: VIDEO_WIDTH * 1.5,
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${glowScale})`,
          background: `radial-gradient(circle, ${colors.primary}${Math.round(glowOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: VIDEO_WIDTH,
          height: VIDEO_WIDTH,
          left: "50%",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${glowScale * 0.7})`,
          background: `radial-gradient(circle, ${colors.accent}${Math.round(glowOpacity * 0.4 * 255).toString(16).padStart(2, "0")} 0%, transparent 50%)`,
        }}
      />

      {/* Floating ambient particles */}
      {particles.map((p, i) => {
        const pY = p.y + Math.sin(frame * 0.03 * p.speed + p.phase) * 40;
        const pX = p.x + Math.cos(frame * 0.02 * p.speed + p.phase) * 20;
        const pOpacity = interpolate(
          Math.sin(frame * 0.05 + p.phase),
          [-1, 1],
          [0.1, 0.4]
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: pX,
              top: pY,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: colors.primary,
              opacity: pOpacity * opacity,
              filter: `blur(${p.size > 6 ? 2 : 1}px)`,
            }}
          />
        );
      })}

      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          width: VIDEO_WIDTH,
          height: 2,
          backgroundColor: `${colors.primary}15`,
          top: ((frame * 8) % (VIDEO_HEIGHT + 200)) - 100,
          left: 0,
          boxShadow: `0 0 40px 20px ${colors.primary}08`,
        }}
      />

      {/* Pain-point question */}
      <div
        style={{
          opacity,
          transform: `scale(${scale}) rotate(${rotation}deg)`,
          paddingLeft: SAFE_ZONE.left + 20,
          paddingRight: SAFE_ZONE.right + 20,
          textAlign: "center",
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "Inter",
            fontWeight: 800,
            fontSize: 68,
            lineHeight: "82px",
            color: colors.text,
            textShadow: `0 0 ${textGlow}px ${colors.primary}80, 0 4px 40px ${colors.background}`,
            letterSpacing: "-1px",
          }}
        >
          {data.painPointQuestion}
        </span>
      </div>

      {/* Bottom accent line */}
      <div
        style={{
          position: "absolute",
          bottom: SAFE_ZONE.bottom + 60,
          left: "50%",
          transform: "translateX(-50%)",
          width: interpolate(frame, [10, 30], [0, 200], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
          opacity: opacity * 0.8,
        }}
      />
    </AbsoluteFill>
  );
};
