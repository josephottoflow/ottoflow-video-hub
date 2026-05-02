/**
 * SCENE 6 — SOCIAL PROOF + CTA (3s / 90 frames)
 * Number counts up with glow. CTA pulses. Fade to black.
 */

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BrandColors, SocialProofCtaScene } from "../types";
import { SAFE_ZONE, VIDEO_WIDTH, VIDEO_HEIGHT } from "../types";

interface Props {
  data: SocialProofCtaScene;
  colors: BrandColors;
}

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
};

export const SocialProofCtaSceneComponent: React.FC<Props> = ({
  data,
  colors,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(frame, [70, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = fadeIn * fadeOut;

  const countRaw = interpolate(frame, [5, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const countProgress = 1 - Math.pow(1 - countRaw, 3);
  const displayNumber = data.socialProofNumber
    ? Math.floor(data.socialProofNumber * countProgress)
    : 0;

  const formattedNumber = displayNumber.toLocaleString();

  const pulse = interpolate(frame % 30, [0, 15, 30], [1, 1.03, 1], {
    extrapolateRight: "clamp",
  });

  const entryScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
    from: 0.7,
    to: 1,
  });

  const ringScale = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 12, stiffness: 60 },
    from: 0,
    to: 1,
  });

  const ringOpacity = interpolate(frame, [5, 40], [0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const numberGlow = interpolate(frame, [5, 30, 55], [0, 40, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ctaShineX = interpolate(frame, [50, 75], [-200, 600], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const burstParticles = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      speed: 100 + seededRandom(i * 5) * 150,
      size: 4 + seededRandom(i * 5 + 1) * 6,
    }));
  }, []);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        justifyContent: "center",
        alignItems: "center",
        opacity,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          background: `radial-gradient(ellipse at 50% 40%, ${colors.accent}10 0%, transparent 50%)`,
        }}
      />

      {data.socialProofNumber && (
        <div
          style={{
            position: "absolute",
            width: 400 * ringScale,
            height: 400 * ringScale,
            borderRadius: "50%",
            border: `2px solid ${colors.accent}`,
            opacity: ringOpacity,
            top: "38%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {data.socialProofNumber && frame > 10 && frame < 45 && burstParticles.map((p, i) => {
        const bFrame = Math.max(0, frame - 10);
        const progress = interpolate(bFrame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
        const bOpacity = interpolate(bFrame, [0, 10, 30], [0.8, 0.5, 0], { extrapolateRight: "clamp" });
        const x = Math.cos(p.angle) * p.speed * progress;
        const y = Math.sin(p.angle) * p.speed * progress;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: "38%",
              left: "50%",
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: colors.accent,
              opacity: bOpacity,
              transform: `translate(${x - p.size / 2}px, ${y - p.size / 2}px)`,
            }}
          />
        );
      })}

      {data.socialProofNumber && (
        <div
          style={{
            textAlign: "center",
            transform: `scale(${entryScale})`,
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontFamily: "Inter",
              fontWeight: 800,
              fontSize: 100,
              lineHeight: "110px",
              color: colors.accent,
              display: "block",
              textShadow: `0 0 ${numberGlow}px ${colors.accent}60, 0 4px 20px ${colors.background}`,
              letterSpacing: "-2px",
            }}
          >
            {formattedNumber}+
          </span>
          {data.socialProofLabel && (
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 400,
                fontSize: 40,
                lineHeight: "50px",
                color: `${colors.text}bb`,
                display: "block",
                marginTop: 8,
              }}
            >
              {data.socialProofLabel}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: SAFE_ZONE.bottom + 50,
          left: SAFE_ZONE.left,
          right: SAFE_ZONE.right,
          textAlign: "center",
          transform: `scale(${pulse})`,
        }}
      >
        <div
          style={{
            display: "inline-block",
            position: "relative",
            padding: "16px 48px",
            borderRadius: 40,
            border: `2px solid ${colors.primary}50`,
            backgroundColor: `${colors.primary}15`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: ctaShineX,
              width: 60,
              height: "100%",
              background: `linear-gradient(90deg, transparent, ${colors.text}15, transparent)`,
              transform: "skewX(-15deg)",
            }}
          />
          <span
            style={{
              fontFamily: "Inter",
              fontWeight: 600,
              fontSize: 36,
              color: colors.primary,
              textShadow: `0 0 20px ${colors.primary}30`,
              position: "relative",
              zIndex: 1,
            }}
          >
            {data.ctaUrl}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
