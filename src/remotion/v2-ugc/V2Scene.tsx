// v2 — Single V2 scene: Veo video clip (preferred) or AI image + Ken Burns zoom + gradient + caption
// Must be used inside a <Sequence> — useCurrentFrame() is already relative

import React from "react";
import { AbsoluteFill, Img, Video, interpolate, useCurrentFrame } from "remotion";
import { V2Caption } from "./V2Caption";
import { resolveImage } from "../engine/resolveImage";

interface V2SceneProps {
  imagePath:       string;
  videoClipPath?:  string;
  caption:         string;
  keyWord:         string;
  durationFrames:  number;
  zoomDirection?:  "in" | "out" | "pan";
  overlayOpacity?: number;
}

export const V2Scene: React.FC<V2SceneProps> = ({
  imagePath,
  videoClipPath,
  caption,
  keyWord,
  durationFrames,
  zoomDirection  = "in",
  overlayOpacity = 0.45,
}) => {
  const frame    = useCurrentFrame(); // relative to Sequence — 0 at scene start
  const progress = Math.min(frame / durationFrames, 1);

  // Ken Burns motion — only used when no video clip
  const scale = zoomDirection === "in"
    ? interpolate(progress, [0, 1], [1.0, 1.08])
    : zoomDirection === "out"
    ? interpolate(progress, [0, 1], [1.08, 1.0])
    : 1.04;

  const translateX = zoomDirection === "pan"
    ? interpolate(progress, [0, 1], [-3, 3])
    : 0;

  // Fade in/out
  const opacity = interpolate(
    frame,
    [0, 8, durationFrames - 8, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const clipSrc  = videoClipPath ? resolveImage(videoClipPath) : "";
  const imageSrc = imagePath     ? resolveImage(imagePath)     : "";

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Background — Veo video clip if available, otherwise static image with Ken Burns */}
      {clipSrc ? (
        <AbsoluteFill>
          <Video
            src={clipSrc}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            volume={0}
            loop
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            transform:       `scale(${scale}) translateX(${translateX}%)`,
            transformOrigin: "center center",
          }}
        >
          {imageSrc && (
            <Img
              src={imageSrc}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}
        </AbsoluteFill>
      )}

      {/* Gradient overlay — center-focused for caption legibility */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(
            to bottom,
            rgba(0,0,0,0.25) 0%,
            rgba(0,0,0,${overlayOpacity * 0.9}) 35%,
            rgba(0,0,0,${overlayOpacity * 0.9}) 65%,
            rgba(0,0,0,0.25) 100%
          )`,
        }}
      />

      {/* Caption — frame is relative here too, inside the same Sequence */}
      <V2Caption caption={caption} keyWord={keyWord} />
    </AbsoluteFill>
  );
};
