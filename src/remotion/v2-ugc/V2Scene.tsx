// v2 — Single V2 scene: 3-level fallback hierarchy
//
// Level 1: Veo video clip              — real cinematic motion
// Level 2: Imagen3 image + Ken Burns   — AI image + simulated motion
// Level 3: Animated cinematic bg       — procedural spotlight, accent glow, light sweep
//
// Must be used inside a <Sequence> — useCurrentFrame() is relative to scene start.

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
  captionStyle?:   "impact" | "word-by-word" | "slide-up" | "pulse";
  highlightColor?: string;
  overlayColor?:   string;   // "r,g,b" string matching visual style token
}

// ── Level 3: Animated cinematic procedural background ────────────────────────
// Generates perceived depth + motion with no external assets.
// Uses the storyboard visual style tokens (overlayColor, highlightColor) for consistency.
const CinematicBackground: React.FC<{
  frame:          number;
  durationFrames: number;
  highlightColor: string;   // #rrggbb
  overlayColor:   string;   // "r,g,b"
  zoomDirection:  "in" | "out" | "pan";
}> = ({ frame, durationFrames, highlightColor, overlayColor, zoomDirection }) => {
  const progress = Math.min(frame / durationFrames, 1);

  // Spotlight slowly drifts — mirrors zoomDirection intent so motion feels intentional
  const spotX = zoomDirection === "pan"
    ? interpolate(progress, [0, 1], [28, 68])   // horizontal drift across frame
    : interpolate(progress, [0, 1], [42, 58]);   // subtle drift for zoom
  const spotY = interpolate(progress, [0, 1], [32, 52]);

  // Single light sweep — crosses the frame once per scene (like a lens flare trace)
  const sweepX = interpolate(progress, [0, 1], [-18, 118]);

  // Accent glow pulse — 0.5Hz so it completes one cycle in a 4-8s scene
  const glowAlpha = 0.05 + 0.035 * Math.sin((frame / 30) * Math.PI);

  // Base tone: dark but hued from the overlay color (not pure black)
  const [r, g, b] = overlayColor.split(",").map(v => Math.max(0, Math.min(255, Number(v.trim()))));
  const darkR = Math.min(r + 14, 42);
  const darkG = Math.min(g + 11, 38);
  const darkB = Math.min(b + 24, 56);

  // Highlight color channels for rgba use
  const hx = highlightColor.replace("#", "");
  const hr = parseInt(hx.slice(0, 2), 16) || 255;
  const hg = parseInt(hx.slice(2, 4), 16) || 229;
  const hb = parseInt(hx.slice(4, 6), 16) || 0;

  return (
    <AbsoluteFill>
      {/* Hued dark base — gives the scene a visual identity beyond plain black */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse 85% 65% at ${spotX}% ${spotY}%, rgb(${darkR},${darkG},${darkB}) 0%, #04040a 100%)`,
      }} />
      {/* Pulsing accent glow from spotlight center */}
      <AbsoluteFill style={{
        background: `radial-gradient(ellipse 52% 38% at ${spotX}% ${spotY}%, rgba(${hr},${hg},${hb},${glowAlpha.toFixed(3)}) 0%, transparent 60%)`,
      }} />
      {/* Light sweep — a single thin shimmer moving across the frame */}
      <AbsoluteFill style={{
        background: `linear-gradient(
          108deg,
          transparent ${sweepX - 12}%,
          rgba(${hr},${hg},${hb},0.04) ${sweepX}%,
          rgba(255,255,255,0.025) ${sweepX + 2}%,
          transparent ${sweepX + 14}%
        )`,
      }} />
      {/* Bottom vignette — cinematic letterbox feel without letterboxing */}
      <AbsoluteFill style={{
        background: `linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.72) 100%)`,
      }} />
    </AbsoluteFill>
  );
};

// ── Main scene component ──────────────────────────────────────────────────────

export const V2Scene: React.FC<V2SceneProps> = ({
  imagePath,
  videoClipPath,
  caption,
  keyWord,
  durationFrames,
  zoomDirection  = "in",
  overlayOpacity = 0.45,
  captionStyle   = "impact",
  highlightColor = "#FFE500",
  overlayColor   = "0,0,0",
}) => {
  const frame    = useCurrentFrame();
  const progress = Math.min(frame / durationFrames, 1);

  // Ken Burns parameters — only applied to Imagen3 static image (Level 2)
  const kbScale = zoomDirection === "in"
    ? interpolate(progress, [0, 1], [1.0, 1.09])
    : zoomDirection === "out"
    ? interpolate(progress, [0, 1], [1.09, 1.0])
    : 1.04;
  const kbTranslateX = zoomDirection === "pan"
    ? interpolate(progress, [0, 1], [-3.5, 3.5])
    : 0;

  // Scene-boundary fade (8 frames in, 8 frames out)
  const opacity = interpolate(
    frame,
    [0, 8, durationFrames - 8, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const clipSrc  = videoClipPath ? resolveImage(videoClipPath) : "";
  const imageSrc = imagePath     ? resolveImage(imagePath)     : "";

  const hasClip  = !!clipSrc;
  const hasImage = !hasClip && !!imageSrc;
  const useProcedural = !hasClip && !hasImage;

  // The gradient overlay sits on top of all background levels.
  // When using the procedural bg, reduce opacity slightly so the animated
  // glow and sweep remain visible through the overlay.
  const effectiveOverlayOpacity = useProcedural
    ? Math.max(0.28, overlayOpacity - 0.18)
    : overlayOpacity;

  return (
    <AbsoluteFill style={{ opacity }}>

      {/* ── Level 1: Veo video clip — real cinematic motion ── */}
      {hasClip && (
        <AbsoluteFill>
          <Video
            src={clipSrc}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            volume={0}
            loop
          />
        </AbsoluteFill>
      )}

      {/* ── Level 2: Imagen3 AI image + Ken Burns motion ── */}
      {hasImage && (
        <AbsoluteFill style={{
          transform:       `scale(${kbScale}) translateX(${kbTranslateX}%)`,
          transformOrigin: "center center",
        }}>
          <Img
            src={imageSrc}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      )}

      {/* ── Level 3: Animated cinematic procedural background ── */}
      {useProcedural && (
        <CinematicBackground
          frame={frame}
          durationFrames={durationFrames}
          highlightColor={highlightColor}
          overlayColor={overlayColor}
          zoomDirection={zoomDirection}
        />
      )}

      {/* Gradient overlay — consistent visual style treatment across all levels */}
      <AbsoluteFill style={{
        background: `linear-gradient(
          to bottom,
          rgba(${overlayColor},0.12) 0%,
          rgba(${overlayColor},${effectiveOverlayOpacity}) 28%,
          rgba(${overlayColor},${effectiveOverlayOpacity}) 72%,
          rgba(${overlayColor},0.12) 100%
        )`,
      }} />

      {/* Caption */}
      <V2Caption
        caption={caption}
        keyWord={keyWord}
        highlightColor={highlightColor}
        style={captionStyle}
        durationFrames={durationFrames}
      />

    </AbsoluteFill>
  );
};
