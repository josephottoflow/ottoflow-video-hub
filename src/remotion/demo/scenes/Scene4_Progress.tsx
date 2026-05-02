/**
 * SCENE 4 — PROGRESS BAR (4s / 120 frames)
 * Fast-moving progress bar 0% → 100%.
 * Frame counter: "Rendering Video (0/2000 frames)" → "2000/2000"
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, DEMO_WIDTH } from "../types";

export const Scene4_Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [108, 120], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress: ease-in fast then decelerate near end
  const rawProgress = interpolate(frame, [8, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Ease: starts slow, speeds up, slows at end
  const progress = rawProgress < 0.8
    ? Math.pow(rawProgress / 0.8, 0.7) * 0.8
    : 0.8 + (1 - Math.pow(1 - (rawProgress - 0.8) / 0.2, 3)) * 0.2;

  const percent = Math.floor(progress * 100);
  const frameCount = Math.floor(progress * 2000);

  const complete = percent >= 100;

  const checkScale = spring({
    frame: Math.max(0, frame - 96),
    fps,
    config: { damping: 8, stiffness: 150 },
    from: 0,
    to: 1,
  });

  // Glow intensity on progress bar
  const barGlow = interpolate(frame, [8, 50, 95], [0, 1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bg,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn * fadeOut,
      }}
    >
      {/* Ambient glow from progress */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BRAND.green}${Math.round(barGlow * 20).toString(16).padStart(2, "0")} 0%, transparent 60%)`,
          filter: "blur(40px)",
        }}
      />

      <div style={{ width: 800, textAlign: "center" }}>
        {/* Status label */}
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 18,
            fontWeight: 500,
            color: BRAND.textMuted,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          {complete ? "EXPORT COMPLETE" : "RENDERING VIDEO"}
        </div>

        {/* Percentage */}
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 120,
            fontWeight: 800,
            color: complete ? BRAND.green : BRAND.text,
            lineHeight: "130px",
            textShadow: complete
              ? `0 0 40px ${BRAND.green}50`
              : `0 0 ${barGlow * 20}px ${BRAND.green}30`,
          }}
        >
          {percent}%
        </div>

        {/* Frame counter */}
        <div
          style={{
            fontFamily: "Inter",
            fontSize: 24,
            fontWeight: 400,
            color: BRAND.textDim,
            marginTop: 16,
            marginBottom: 48,
          }}
        >
          Rendering Video ({frameCount.toLocaleString()}/2,000 frames)
        </div>

        {/* Progress bar track */}
        <div
          style={{
            width: "100%",
            height: 16,
            borderRadius: 8,
            backgroundColor: `${BRAND.text}10`,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Fill */}
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: 8,
              background: `linear-gradient(90deg, ${BRAND.greenDark}, ${BRAND.green}, ${BRAND.greenLight})`,
              boxShadow: `0 0 ${20 * barGlow}px ${BRAND.green}50`,
              position: "relative",
            }}
          >
            {/* Shine sweep on bar */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: interpolate(frame % 40, [0, 40], [-60, 800], {}),
                width: 60,
                height: "100%",
                background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)`,
                borderRadius: 8,
              }}
            />
          </div>
        </div>

        {/* Completion checkmark */}
        {complete && (
          <div
            style={{
              marginTop: 40,
              transform: `scale(${checkScale})`,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                backgroundColor: BRAND.green,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                boxShadow: `0 0 30px ${BRAND.green}40`,
              }}
            >
              <span style={{ fontSize: 36, color: "#fff" }}>✓</span>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
