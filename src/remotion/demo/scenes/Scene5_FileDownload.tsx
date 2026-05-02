/**
 * SCENE 5 — FILE DOWNLOAD (3s / 90 frames)
 * A file icon labeled "video.mp4" bounces in and downloads.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../types";

export const Scene5_FileDownload: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [78, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // File icon bounces in
  const iconScale = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 8, stiffness: 120 },
    from: 0,
    to: 1,
  });

  // Download arrow animation
  const arrowY = interpolate(frame, [30, 55], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrowOpacity = interpolate(frame, [30, 40, 50, 55], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Downloaded!" label
  const showLabel = frame >= 50;
  const labelScale = spring({
    frame: Math.max(0, frame - 50),
    fps,
    config: { damping: 10, stiffness: 150 },
    from: 0.5,
    to: 1,
  });
  const labelOpacity = interpolate(frame, [50, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Glow pulse on file
  const glowPulse = interpolate(frame, [5, 25, 50, 70], [0, 0.6, 1, 0.4], {
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
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BRAND.green}${Math.round(glowPulse * 25).toString(16).padStart(2, "0")} 0%, transparent 60%)`,
          filter: "blur(50px)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          transform: `scale(${iconScale})`,
        }}
      >
        {/* File icon */}
        <div style={{ position: "relative" }}>
          <div
            style={{
              width: 200,
              height: 260,
              borderRadius: 20,
              backgroundColor: BRAND.bgCard,
              border: `2px solid ${BRAND.green}40`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              boxShadow: `0 20px 60px rgba(0,0,0,0.4), 0 0 ${40 * glowPulse}px ${BRAND.green}20`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Dog-ear */}
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 50,
                height: 50,
                background: `linear-gradient(135deg, transparent 50%, ${BRAND.green}30 50%)`,
                borderBottomLeftRadius: 10,
              }}
            />
            {/* Play icon */}
            <div
              style={{
                width: 70,
                height: 70,
                borderRadius: "50%",
                backgroundColor: `${BRAND.green}25`,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "24px solid white",
                  borderTop: "14px solid transparent",
                  borderBottom: "14px solid transparent",
                  marginLeft: 6,
                }}
              />
            </div>
            {/* File name */}
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 22,
                fontWeight: 700,
                color: BRAND.text,
              }}
            >
              video.mp4
            </span>
            {/* File size */}
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 14,
                color: BRAND.textMuted,
              }}
            >
              12.4 MB
            </span>
          </div>

          {/* Download arrow overlay */}
          <div
            style={{
              position: "absolute",
              bottom: -20,
              left: "50%",
              transform: `translateX(-50%) translateY(${arrowY}px)`,
              opacity: arrowOpacity,
              fontSize: 40,
              color: BRAND.green,
              filter: `drop-shadow(0 0 10px ${BRAND.green})`,
            }}
          >
            ↓
          </div>
        </div>

        {/* Downloaded label */}
        {showLabel && (
          <div
            style={{
              padding: "12px 32px",
              borderRadius: 12,
              backgroundColor: `${BRAND.green}20`,
              border: `1px solid ${BRAND.green}40`,
              fontFamily: "Inter",
              fontSize: 20,
              fontWeight: 600,
              color: BRAND.green,
              opacity: labelOpacity,
              transform: `scale(${labelScale})`,
            }}
          >
            ✓ Downloaded!
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
