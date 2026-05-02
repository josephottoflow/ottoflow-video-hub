/**
 * SCENE 2 — PRODUCT INTRO (3s / 90 frames)
 * Product name springs in from 3x to 1x with glow ring.
 * Tagline slides up. 24 particles burst outward.
 */

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import type { BrandColors, ProductIntroScene } from "../types";
import { SAFE_ZONE, VIDEO_WIDTH, VIDEO_HEIGHT } from "../types";

interface Props {
  data: ProductIntroScene;
  colors: BrandColors;
}

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
};

export const ProductIntroSceneComponent: React.FC<Props> = ({
  data,
  colors,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const nameScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150, mass: 1 },
    from: 3,
    to: 1,
  });

  const taglineY = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 15, stiffness: 120 },
    from: 60,
    to: 0,
  });

  const taglineOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ringScale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 100 },
    from: 0,
    to: 1,
  });

  const ringOpacity = interpolate(frame, [0, 15, 60, 90], [0, 0.6, 0.4, 0.2], {
    extrapolateRight: "clamp",
  });

  const glowPulse = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.3, 0.6]
  );

  const particles = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      angle: seededRandom(i * 3 + 1) * Math.PI * 2,
      speed: 150 + seededRandom(i * 3 + 2) * 500,
      size: 4 + seededRandom(i * 3 + 3) * 16,
      delay: Math.floor(seededRandom(i * 3 + 4) * 8),
      hueShift: seededRandom(i * 3 + 5) > 0.5,
    }));
  }, []);

  const fadeOut = interpolate(frame, [80, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        opacity: fadeOut,
      }}
    >
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          background: `radial-gradient(ellipse at 50% 40%, ${colors.primary}18 0%, transparent 60%)`,
        }}
      />

      {/* Glow ring */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          left: "50%",
          top: "45%",
          transform: `translate(-50%, -50%) scale(${ringScale})`,
          borderRadius: "50%",
          border: `3px solid ${colors.accent}`,
          opacity: ringOpacity,
          boxShadow: `0 0 60px ${colors.accent}40, inset 0 0 60px ${colors.accent}20`,
        }}
      />

      {/* Second ring */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          left: "50%",
          top: "45%",
          transform: `translate(-50%, -50%) scale(${ringScale * 0.9})`,
          borderRadius: "50%",
          border: `1px solid ${colors.primary}40`,
          opacity: ringOpacity * 0.4,
        }}
      />

      {/* Particle burst */}
      {particles.map((p, i) => {
        const particleFrame = Math.max(0, frame - 3 - p.delay);
        const progress = interpolate(particleFrame, [0, 60], [0, 1], {
          extrapolateRight: "clamp",
        });
        const particleOpacity = interpolate(
          particleFrame,
          [0, 15, 60],
          [0.9, 0.7, 0],
          { extrapolateRight: "clamp" }
        );
        const x = Math.cos(p.angle) * p.speed * progress;
        const y = Math.sin(p.angle) * p.speed * progress;
        const particleColor = p.hueShift ? colors.primary : colors.accent;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "45%",
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: particleColor,
              opacity: particleOpacity,
              transform: `translate(${x - p.size / 2}px, ${y - p.size / 2}px)`,
              filter: `blur(${p.size > 12 ? 2 : 0}px)`,
              boxShadow: `0 0 ${p.size}px ${particleColor}60`,
            }}
          />
        );
      })}

      {/* Pulsing glow */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          left: "50%",
          top: "45%",
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${colors.accent}${Math.round(glowPulse * 255).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
          filter: "blur(30px)",
        }}
      />

      {/* Product name */}
      <div
        style={{
          transform: `scale(${nameScale})`,
          textAlign: "center",
          zIndex: 10,
          paddingLeft: SAFE_ZONE.left,
          paddingRight: SAFE_ZONE.right,
        }}
      >
        {data.logoPath ? (
          <Img
            src={staticFile(data.logoPath)}
            style={{
              maxWidth: 400,
              maxHeight: 200,
              objectFit: "contain",
              filter: `drop-shadow(0 0 30px ${colors.primary}60)`,
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "Inter",
              fontWeight: 800,
              fontSize: 76,
              lineHeight: "86px",
              color: colors.text,
              textShadow: `0 0 40px ${colors.primary}60, 0 0 80px ${colors.primary}30`,
              letterSpacing: "-1px",
            }}
          >
            {data.productName}
          </span>
        )}
      </div>

      {/* Tagline */}
      <div
        style={{
          position: "absolute",
          top: "58%",
          width: "100%",
          textAlign: "center",
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          paddingLeft: SAFE_ZONE.left + 20,
          paddingRight: SAFE_ZONE.right + 20,
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontFamily: "Inter",
            fontWeight: 400,
            fontSize: 40,
            lineHeight: "52px",
            color: `${colors.text}cc`,
          }}
        >
          {data.tagline}
        </span>
      </div>

      {/* Decorative line under tagline */}
      <div
        style={{
          position: "absolute",
          top: "66%",
          left: "50%",
          transform: "translateX(-50%)",
          width: interpolate(frame, [25, 45], [0, 160], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${colors.accent}80, transparent)`,
          opacity: taglineOpacity * 0.7,
        }}
      />
    </AbsoluteFill>
  );
};
