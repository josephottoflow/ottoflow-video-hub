/**
 * SCENE BACKGROUND — Cinematic video/photo background layer for all templates.
 * Prefers Pexels video; falls back to Pexels photo; falls back to solid dark.
 * Ken Burns slow zoom + dark overlay for text readability.
 */
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface SceneBackgroundProps {
  videos?:       string[];
  photos?:       string[];
  sceneIndex?:   number;
  overlay?:      number;   // 0–1, default 0.68
  accentColor?:  string;   // brand primary for gradient tint
}

export const SceneBackground: React.FC<SceneBackgroundProps> = ({
  videos       = [],
  photos       = [],
  sceneIndex   = 0,
  overlay      = 0.68,
  accentColor  = "#000000",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const videoSrc = videos.length > 0 ? videos[sceneIndex % videos.length] : null;
  const photoSrc = photos.length > 0 ? photos[sceneIndex % photos.length] : null;
  const hasBg    = !!(videoSrc || photoSrc);

  // Slow Ken Burns zoom
  const scale = interpolate(frame, [0, durationInFrames], [1.0, 1.07], { extrapolateRight: "clamp" });
  // Slight horizontal drift
  const driftX = interpolate(frame, [0, durationInFrames], [0, sceneIndex % 2 === 0 ? -12 : 12], { extrapolateRight: "clamp" });

  if (!hasBg) return null;

  const src = (videoSrc || photoSrc)!;
  const url = src.startsWith("http") ? src : `/${src}`;

  return (
    <>
      {/* Media layer */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {videoSrc ? (
          <OffthreadVideo
            src={url}
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              transform: `scale(${scale}) translateX(${driftX}px)`,
            }}
            muted
          />
        ) : (
          <Img
            src={url}
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              transform: `scale(${scale}) translateX(${driftX}px)`,
            }}
          />
        )}
      </AbsoluteFill>

      {/* Flat dark overlay for readability */}
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: overlay }} />

      {/* Cinematic vignette — dark edges, slight brand tint at top */}
      <AbsoluteFill style={{
        background: `
          radial-gradient(ellipse 110% 110% at 50% 50%, transparent 40%, rgba(0,0,0,0.6) 100%),
          linear-gradient(180deg, ${accentColor}18 0%, transparent 35%, transparent 70%, rgba(0,0,0,0.5) 100%)
        `,
        pointerEvents: "none",
      }} />
    </>
  );
};
