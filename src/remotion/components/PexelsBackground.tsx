/**
 * PEXELS BACKGROUND — Reusable fullscreen background layer for Remotion scenes.
 * Renders a stock photo with Ken Burns zoom + dark overlay for text readability.
 *
 * Usage:
 *   <PexelsBackground src="content/my-product/backgrounds/pexels-123.jpg" />
 *   <PexelsBackground src={bgPath} overlay={0.6} zoom={1.15} />
 */
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface PexelsBackgroundProps {
  /** Path to the background image (relative to /public) */
  src: string;
  /** Overlay darkness: 0 = none, 1 = fully black. Default 0.5 */
  overlay?: number;
  /** Overlay color. Default "#000000" */
  overlayColor?: string;
  /** End scale for Ken Burns zoom. Default 1.08 */
  zoom?: number;
  /** Whether to enable Ken Burns pan/zoom. Default true */
  animate?: boolean;
  /** Optional gradient instead of flat overlay: "top" | "bottom" | "both" */
  gradient?: "top" | "bottom" | "both" | "none";
}

export const PexelsBackground: React.FC<PexelsBackgroundProps> = ({
  src,
  overlay = 0.5,
  overlayColor = "#000000",
  zoom = 1.08,
  animate = true,
  gradient = "none",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const scale = animate
    ? interpolate(frame, [0, durationInFrames], [1, zoom], { extrapolateRight: "clamp" })
    : 1;

  // Subtle horizontal drift
  const translateX = animate
    ? interpolate(frame, [0, durationInFrames], [0, -15], { extrapolateRight: "clamp" })
    : 0;

  const gradientOverlay = (() => {
    switch (gradient) {
      case "top":
        return `linear-gradient(to bottom, ${overlayColor} 0%, transparent 50%)`;
      case "bottom":
        return `linear-gradient(to top, ${overlayColor} 0%, transparent 50%)`;
      case "both":
        return `linear-gradient(to bottom, ${overlayColor} 0%, transparent 30%, transparent 70%, ${overlayColor} 100%)`;
      default:
        return "none";
    }
  })();

  const resolvedSrc = src.startsWith("http") ? src : `/${src}`;
  const isVideo = /\.(mp4|webm|mov)$/i.test(src);

  return (
    <>
      {/* Media layer — video or image depending on file type */}
      <AbsoluteFill style={{ overflow: "hidden" }}>
        {isVideo ? (
          <OffthreadVideo
            src={resolvedSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${scale}) translateX(${translateX}px)`,
            }}
            muted
          />
        ) : (
          <Img
            src={resolvedSrc}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${scale}) translateX(${translateX}px)`,
            }}
          />
        )}
      </AbsoluteFill>

      {/* Flat overlay */}
      {overlay > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: overlayColor,
            opacity: overlay,
          }}
        />
      )}

      {/* Gradient overlay */}
      {gradient !== "none" && (
        <AbsoluteFill
          style={{
            background: gradientOverlay,
            opacity: 0.8,
          }}
        />
      )}
    </>
  );
};
