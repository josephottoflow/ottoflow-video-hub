/**
 * SCENE 4 — IMAGE SHOWCASE (5s / 150 frames)
 * Product images displayed LARGE with crossfade transitions.
 * Enhanced: glow border, Ken Burns zoom, headline with underline.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import type { BrandColors, ImageShowcaseScene } from "../types";
import { SAFE_ZONE, CONTENT_WIDTH, VIDEO_WIDTH, VIDEO_HEIGHT } from "../types";

interface Props {
  data: ImageShowcaseScene;
  colors: BrandColors;
}

export const ImageShowcaseSceneComponent: React.FC<Props> = ({
  data,
  colors,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { images } = data;

  const framesPerImage = Math.floor(150 / images.length);
  const activeIndex = Math.min(
    images.length - 1,
    Math.floor(frame / framesPerImage)
  );

  const sceneEntry = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        opacity: sceneEntry,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          background: `radial-gradient(ellipse at 50% 30%, ${colors.primary}0a 0%, transparent 60%)`,
        }}
      />

      {images.map((img, i) => {
        const imageStart = i * framesPerImage;
        const localFrame = frame - imageStart;
        const isActive = i === activeIndex;
        const isPrev = i === activeIndex - 1;

        if (!isActive && !isPrev) return null;

        const entryScale = spring({
          frame: Math.max(0, localFrame),
          fps,
          config: { damping: 15, stiffness: 100 },
          from: 0.92,
          to: 1,
        });

        const kenBurns = interpolate(localFrame, [0, framesPerImage], [1, 1.04], {
          extrapolateRight: "clamp",
        });

        const scale = entryScale * kenBurns;

        let opacity = 1;
        if (isPrev) {
          const nextStart = (i + 1) * framesPerImage;
          opacity = interpolate(frame, [nextStart - 5, nextStart + 12], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
        } else if (i > 0) {
          opacity = interpolate(localFrame, [0, 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
        }

        const headlineOpacity = interpolate(localFrame, [8, 22], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const headlineY = spring({
          frame: Math.max(0, localFrame - 8),
          fps,
          config: { damping: 15, stiffness: 120 },
          from: 30,
          to: 0,
        });

        const underlineWidth = interpolate(localFrame, [18, 35], [0, 120], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const imageGlow = interpolate(localFrame, [0, 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <AbsoluteFill
            key={i}
            style={{ opacity, justifyContent: "center", alignItems: "center" }}
          >
            <div
              style={{
                position: "absolute",
                width: CONTENT_WIDTH * 0.8,
                height: 400,
                borderRadius: 30,
                background: `radial-gradient(ellipse, ${colors.primary}${Math.round(imageGlow * 40).toString(16).padStart(2, "0")} 0%, transparent 70%)`,
                filter: "blur(40px)",
              }}
            />

            <Img
              src={staticFile(img.path)}
              style={{
                width: CONTENT_WIDTH + 20,
                maxHeight: VIDEO_HEIGHT * 0.55,
                objectFit: "contain",
                borderRadius: 20,
                transform: `scale(${scale})`,
                filter: `drop-shadow(0 20px 60px ${colors.background}cc) drop-shadow(0 4px 12px ${colors.primary}30)`,
              }}
            />

            <div
              style={{
                position: "absolute",
                bottom: SAFE_ZONE.bottom + 280,
                display: "flex",
                gap: 12,
                justifyContent: "center",
                width: "100%",
              }}
            >
              {images.map((_, dotIndex) => (
                <div
                  key={dotIndex}
                  style={{
                    width: dotIndex === i ? 28 : 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: dotIndex === i ? colors.accent : `${colors.text}30`,
                  }}
                />
              ))}
            </div>

            <div
              style={{
                position: "absolute",
                bottom: SAFE_ZONE.bottom + 120,
                width: "100%",
                textAlign: "center",
                opacity: headlineOpacity,
                transform: `translateY(${headlineY}px)`,
                paddingLeft: SAFE_ZONE.left,
                paddingRight: SAFE_ZONE.right,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "Inter",
                  fontWeight: 700,
                  fontSize: 56,
                  lineHeight: "66px",
                  color: colors.text,
                  textShadow: `0 4px 30px ${colors.background}, 0 0 20px ${colors.primary}30`,
                }}
              >
                {img.headline}
              </span>
              <div
                style={{
                  width: underlineWidth,
                  height: 4,
                  borderRadius: 2,
                  background: `linear-gradient(90deg, ${colors.accent}, ${colors.primary})`,
                  marginTop: 12,
                  opacity: headlineOpacity,
                }}
              />
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
