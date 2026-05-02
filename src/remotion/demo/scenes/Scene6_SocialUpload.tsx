/**
 * SCENE 6 — SOCIAL UPLOAD DRAG & DROP (7s / 210 frames)
 * video.mp4 gets dragged onto YouTube, Instagram, then Facebook.
 *
 * Timeline:
 *   0-20   File icon appears center
 *  20-75   Drag to YouTube card → drop → checkmark
 *  75-135  Drag to Instagram card → drop → checkmark
 * 135-190  Drag to Facebook card → drop → checkmark
 * 190-210  All three glow, fade out
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

interface PlatformConfig {
  name: string;
  color: string;
  icon: string;
  startFrame: number;
  dropFrame: number;
  cardY: number;
}

const PLATFORMS: PlatformConfig[] = [
  { name: "YouTube", color: "#ff0000", icon: "▶", startFrame: 20, dropFrame: 55, cardY: 500 },
  { name: "Instagram", color: "#e4405f", icon: "📷", startFrame: 75, dropFrame: 110, cardY: 880 },
  { name: "Facebook", color: "#1877f2", icon: "f", startFrame: 135, dropFrame: 170, cardY: 1260 },
];

export const Scene6_SocialUpload: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [195, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // File icon at center
  const fileVisible = frame >= 5;
  const fileScale = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 10, stiffness: 150 },
    from: 0,
    to: 1,
  });

  // Determine which platform is active
  const activePlatformIndex = PLATFORMS.findIndex(
    (p) => frame >= p.startFrame && frame < p.startFrame + 55
  );

  // File drag position — moves to each platform
  const getFilePosition = () => {
    const centerX = DEMO_WIDTH / 2;
    const centerY = 300;

    for (let i = PLATFORMS.length - 1; i >= 0; i--) {
      const p = PLATFORMS[i];
      if (frame >= p.dropFrame) {
        // After drop, file snaps back to center (or stays if last)
        if (i < PLATFORMS.length - 1 && frame < PLATFORMS[i + 1].startFrame) {
          return { x: centerX, y: centerY };
        }
      }
      if (frame >= p.startFrame && frame < p.dropFrame + 10) {
        const dragProgress = interpolate(
          frame,
          [p.startFrame, p.dropFrame - 5],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const eased = 1 - Math.pow(1 - dragProgress, 2);
        return {
          x: interpolate(eased, [0, 1], [centerX, centerX]),
          y: interpolate(eased, [0, 1], [centerY, p.cardY - 20]),
        };
      }
    }
    return { x: centerX, y: centerY };
  };

  const filePos = getFilePosition();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bg,
        opacity: fadeIn * fadeOut,
        overflow: "hidden",
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 100,
          width: DEMO_WIDTH,
          textAlign: "center",
        }}
      >
        <span
          style={{
            fontFamily: "Inter",
            fontSize: 18,
            fontWeight: 500,
            color: BRAND.textMuted,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          Upload Everywhere
        </span>
      </div>

      {/* Platform cards */}
      {PLATFORMS.map((platform, i) => {
        const cardEntry = spring({
          frame: Math.max(0, frame - platform.startFrame + 10),
          fps,
          config: { damping: 14, stiffness: 100 },
          from: 0.8,
          to: 1,
        });
        const cardOpacity = interpolate(
          frame,
          [platform.startFrame - 10, platform.startFrame],
          [0.3, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const dropped = frame >= platform.dropFrame;
        const dropBounce = dropped
          ? spring({
              frame: Math.max(0, frame - platform.dropFrame),
              fps,
              config: { damping: 8, stiffness: 200 },
              from: 1.1,
              to: 1,
            })
          : 1;

        const checkOpacity = interpolate(
          frame,
          [platform.dropFrame + 5, platform.dropFrame + 15],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        // Drag-over highlight
        const isHovering =
          frame >= platform.startFrame + 10 && frame < platform.dropFrame;
        const borderGlow = isHovering
          ? interpolate(
              frame % 20,
              [0, 10, 20],
              [0.3, 0.6, 0.3],
              {}
            )
          : 0;

        return (
          <div
            key={platform.name}
            style={{
              position: "absolute",
              top: platform.cardY,
              left: "50%",
              transform: `translateX(-50%) scale(${cardEntry * dropBounce})`,
              opacity: cardOpacity,
            }}
          >
            <div
              style={{
                width: 700,
                height: 140,
                borderRadius: 20,
                backgroundColor: BRAND.bgCard,
                border: `2px solid ${
                  isHovering
                    ? platform.color
                    : dropped
                      ? `${platform.color}60`
                      : BRAND.border
                }`,
                boxShadow: isHovering
                  ? `0 0 30px ${platform.color}30, inset 0 0 20px ${platform.color}08`
                  : dropped
                    ? `0 0 20px ${platform.color}20`
                    : "none",
                display: "flex",
                alignItems: "center",
                padding: "0 30px",
                gap: 20,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Dashed border overlay when hovering */}
              {isHovering && (
                <div
                  style={{
                    position: "absolute",
                    inset: 6,
                    borderRadius: 14,
                    border: `2px dashed ${platform.color}50`,
                    opacity: borderGlow,
                  }}
                />
              )}

              {/* Platform icon circle */}
              <div
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 18,
                  backgroundColor: `${platform.color}20`,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: platform.icon === "f" ? 38 : 32,
                    fontWeight: 800,
                    color: platform.color,
                    fontFamily: platform.icon === "f" ? "Georgia, serif" : "Inter",
                  }}
                >
                  {platform.icon}
                </span>
              </div>

              {/* Platform name + status */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: "Inter",
                    fontSize: 28,
                    fontWeight: 700,
                    color: BRAND.text,
                  }}
                >
                  {platform.name}
                </div>
                <div
                  style={{
                    fontFamily: "Inter",
                    fontSize: 16,
                    color: dropped ? platform.color : BRAND.textMuted,
                    marginTop: 4,
                  }}
                >
                  {dropped
                    ? "✓ Uploaded successfully"
                    : isHovering
                      ? "Drop video.mp4 here..."
                      : "Drag & drop to upload"}
                </div>
              </div>

              {/* Checkmark */}
              {dropped && (
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: "50%",
                    backgroundColor: platform.color,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    opacity: checkOpacity,
                    boxShadow: `0 0 20px ${platform.color}40`,
                  }}
                >
                  <span style={{ fontSize: 26, color: "#fff" }}>✓</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Draggable file icon */}
      {fileVisible && (
        <div
          style={{
            position: "absolute",
            left: filePos.x - 55,
            top: filePos.y - 35,
            transform: `scale(${fileScale * 0.7})`,
            zIndex: 100,
            opacity: frame >= 190 ? 0 : 1,
          }}
        >
          <div
            style={{
              width: 110,
              height: 70,
              borderRadius: 12,
              backgroundColor: BRAND.bgCard,
              border: `1px solid ${BRAND.green}40`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              boxShadow: `0 10px 30px rgba(0,0,0,0.4), 0 0 15px ${BRAND.green}20`,
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "10px solid white",
                borderTop: "6px solid transparent",
                borderBottom: "6px solid transparent",
              }}
            />
            <span
              style={{
                fontFamily: "Inter",
                fontSize: 13,
                fontWeight: 600,
                color: BRAND.text,
              }}
            >
              .mp4
            </span>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
