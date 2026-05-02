/**
 * CINEMATIC BACKGROUND — Atmospheric Pexels background layer for cinematic scenes.
 * Supports both image and VIDEO backgrounds with Ken Burns zoom, dark overlay, and color tint.
 * Auto-detects video URLs (.mp4, Pexels video links) and renders OffthreadVideo.
 * Falls back gracefully if no background source is provided.
 */
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ThemeConfig } from "../../engine/types";
import { resolveImage } from "../../engine/resolveImage";

/** Detect whether a URL points to a video file */
function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  // Direct video extensions
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) return true;
  // Pexels video CDN patterns (video files served from their CDN)
  if (lower.includes("videos.pexels.com")) return true;
  if (lower.includes("player.vimeo.com")) return true;
  // Explicit query param hint
  if (lower.includes("type=video")) return true;
  return false;
}

interface CinematicBackgroundProps {
  /** Background image or video URL (Pexels or local) */
  src?: string;
  /** Theme config for color tinting */
  theme: ThemeConfig;
  /** Overlay darkness: 0-1. Default 0.65 */
  overlay?: number;
  /** Ken Burns zoom amount. Default 1.08 */
  zoom?: number;
  /** Pan direction. Default alternates */
  panDirection?: "left" | "right" | "none";
  /** Whether to add a color tint from the theme. Default true */
  colorTint?: boolean;
}

export const CinematicBackground: React.FC<CinematicBackgroundProps> = ({
  src,
  theme,
  overlay = 0.2,
  zoom = 1.08,
  panDirection = "left",
  colorTint = true,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // If no background source, render a gradient background
  if (!src) {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${theme.bgStart} 0%, ${theme.bgEnd} 100%)`,
        }}
      />
    );
  }

  const resolvedSrc = resolveImage(src);
  const useVideo = isVideoUrl(src) || isVideoUrl(resolvedSrc);

  // Ken Burns zoom
  const scale = interpolate(frame, [0, durationInFrames], [1, zoom], {
    extrapolateRight: "clamp",
  });

  // Slow pan
  const panDistance = panDirection === "none" ? 0 : 20;
  const translateX =
    panDirection === "right"
      ? interpolate(frame, [0, durationInFrames], [0, panDistance], { extrapolateRight: "clamp" })
      : interpolate(frame, [0, durationInFrames], [0, -panDistance], { extrapolateRight: "clamp" });

  // Fade in
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    transform: `scale(${scale}) translateX(${translateX}px)`,
  };

  return (
    <>
      {/* Background media (video or image) with Ken Burns */}
      <AbsoluteFill style={{ overflow: "hidden", opacity: fadeIn }}>
        {useVideo ? (
          <OffthreadVideo
            src={resolvedSrc}
            style={mediaStyle}
            muted
          />
        ) : (
          <Img
            src={resolvedSrc}
            style={mediaStyle}
          />
        )}
      </AbsoluteFill>

      {/* Dark overlay for content readability */}
      <AbsoluteFill
        style={{
          backgroundColor: "#000000",
          opacity: overlay,
        }}
      />

      {/* Color tint from theme */}
      {colorTint && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${theme.color}12 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Vignette edges */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0,0,0,0.15) 100%)",
        }}
      />
    </>
  );
};
