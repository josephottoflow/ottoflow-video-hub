/**
 * SCENE 1 — TEXT HOOK (3s / 90 frames)
 * "How to get MP4 from Claude Design Animation"
 * Words slam in one by one with spring physics.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND, DEMO_WIDTH, DEMO_HEIGHT } from "../types";

export const Scene1_TextHook: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["How", "to", "get", "MP4", "from", "Claude Design", "Animation"];
  const highlightWords = ["MP4", "Claude Design"];

  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [75, 90], [1, 0], {
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
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          width: DEMO_WIDTH,
          height: DEMO_HEIGHT,
          background: `radial-gradient(ellipse at 50% 45%, ${BRAND.green}15 0%, transparent 55%)`,
        }}
      />

      {/* Scan line */}
      <div
        style={{
          position: "absolute",
          width: DEMO_WIDTH,
          height: 2,
          backgroundColor: `${BRAND.green}20`,
          top: interpolate(frame, [0, 90], [400, 1500], {
            extrapolateRight: "clamp",
          }),
        }}
      />

      <div
        style={{
          width: 920,
          textAlign: "center",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "6px 18px",
          padding: "0 40px",
        }}
      >
        {words.map((word, i) => {
          const delay = i * 5 + 5;
          const wordScale = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: { damping: 10, stiffness: 180 },
            from: 1.8,
            to: 1,
          });
          const wordOpacity = interpolate(frame, [delay, delay + 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const isHL = highlightWords.includes(word);

          return (
            <span
              key={i}
              style={{
                fontFamily: "Inter",
                fontWeight: 800,
                fontSize: 80,
                lineHeight: "96px",
                color: isHL ? BRAND.green : BRAND.text,
                opacity: wordOpacity,
                transform: `scale(${wordScale})`,
                display: "inline-block",
                textShadow: isHL
                  ? `0 0 40px ${BRAND.green}50, 0 0 80px ${BRAND.green}20`
                  : `0 4px 20px ${BRAND.bg}`,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>

      {/* Bottom accent line */}
      <div
        style={{
          position: "absolute",
          bottom: 300,
          left: "50%",
          transform: "translateX(-50%)",
          width: interpolate(frame, [40, 65], [0, 200], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, transparent, ${BRAND.green}, transparent)`,
        }}
      />
    </AbsoluteFill>
  );
};
