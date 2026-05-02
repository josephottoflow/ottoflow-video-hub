/**
 * SCENE 3 — SIMULATED DEMO (8s / 240 frames)
 * Animated cursor interacts with a simplified product UI.
 * Enhanced: gradient button, glow effects, better cursor with trail.
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BrandColors, SimulatedDemoScene } from "../types";
import { SAFE_ZONE, CONTENT_WIDTH, VIDEO_WIDTH, VIDEO_HEIGHT } from "../types";

interface Props {
  data: SimulatedDemoScene;
  colors: BrandColors;
}

export const SimulatedDemoSceneComponent: React.FC<Props> = ({
  data,
  colors,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inputY = 700;
  const buttonY = 820;
  const resultY = 960;
  const centerX = 540;

  const cursorPhase1 = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
    from: 0,
    to: 1,
  });

  const cursorPhase2 = spring({
    frame: Math.max(0, frame - 120),
    fps,
    config: { damping: 15, stiffness: 80 },
    from: 0,
    to: 1,
  });

  const cursorX = interpolate(cursorPhase2, [0, 1], [centerX - 200, centerX]);
  const cursorY = interpolate(
    cursorPhase1,
    [0, 1],
    [1200, frame < 120 ? inputY + 36 : interpolate(cursorPhase2, [0, 1], [inputY + 36, buttonY + 32])],
  );

  const inputFocused = frame >= 30;
  const typedChars = Math.min(
    data.typedText.length,
    Math.max(0, Math.floor((frame - 40) / (80 / data.typedText.length)))
  );
  const displayedText = data.typedText.slice(0, typedChars);
  const showCaret = frame >= 40 && frame < 120 && Math.floor(frame / 8) % 2 === 0;

  const inputRippleProgress = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const buttonClicked = frame >= 150;
  const buttonScale = buttonClicked
    ? spring({
        frame: frame - 150,
        fps,
        config: { damping: 20, stiffness: 300 },
        from: 0.93,
        to: 1,
      })
    : 1;

  const buttonRippleProgress = interpolate(frame, [150, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const showSpinner = frame >= 160 && frame < 175;
  const spinnerRotation = frame * 15;

  const resultScale = spring({
    frame: Math.max(0, frame - 175),
    fps,
    config: { damping: 12, stiffness: 150 },
    from: 0.5,
    to: 1,
  });
  const resultOpacity = interpolate(frame, [175, 195], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const shineX = interpolate(frame, [185, 220], [-200, 1200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const focusGlow = inputFocused
    ? interpolate(Math.sin(frame * 0.1), [-1, 1], [10, 25])
    : 0;

  const sceneEntry = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.background, opacity: sceneEntry, overflow: "hidden" }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          left: "50%",
          top: frame < 120 ? inputY : frame < 175 ? buttonY : resultY,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${colors.primary}12 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: SAFE_ZONE.top + 80,
          width: "100%",
          textAlign: "center",
          opacity: titleOpacity,
        }}
      >
        <span
          style={{
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: 44,
            color: `${colors.text}90`,
            letterSpacing: "2px",
            textTransform: "uppercase",
          }}
        >
          How It Works
        </span>
      </div>

      {/* Input field */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE.left,
          top: inputY,
          width: CONTENT_WIDTH,
          height: 72,
          backgroundColor: `${colors.text}08`,
          border: `2px solid ${inputFocused ? colors.primary : colors.text + "20"}`,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          paddingLeft: 24,
          paddingRight: 24,
          boxShadow: inputFocused
            ? `0 0 ${focusGlow}px ${colors.primary}40, inset 0 1px 0 ${colors.text}05`
            : `inset 0 1px 0 ${colors.text}05`,
        }}
      >
        <span
          style={{
            fontFamily: "Inter",
            fontSize: 36,
            color: typedChars > 0 ? colors.text : `${colors.text}40`,
          }}
        >
          {typedChars > 0 ? displayedText : data.inputPlaceholder}
          {showCaret && (
            <span style={{ color: colors.primary, fontWeight: 300 }}>|</span>
          )}
        </span>

        {frame >= 30 && frame < 50 && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: inputRippleProgress * 120,
              height: inputRippleProgress * 120,
              borderRadius: "50%",
              border: `2px solid ${colors.primary}`,
              opacity: 1 - inputRippleProgress,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
      </div>

      {/* Button */}
      <div
        style={{
          position: "absolute",
          left: SAFE_ZONE.left,
          top: buttonY,
          width: CONTENT_WIDTH,
          height: 64,
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary || colors.primary})`,
          borderRadius: 16,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          transform: `scale(${buttonScale})`,
          boxShadow: `0 8px 32px ${colors.primary}40, 0 2px 8px ${colors.primary}20`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "50%",
            background: `linear-gradient(180deg, ${colors.text}10, transparent)`,
            borderRadius: "16px 16px 0 0",
          }}
        />

        {showSpinner ? (
          <div
            style={{
              width: 32,
              height: 32,
              border: `3px solid ${colors.text}30`,
              borderTop: `3px solid ${colors.text}`,
              borderRadius: "50%",
              transform: `rotate(${spinnerRotation}deg)`,
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "Inter",
              fontWeight: 700,
              fontSize: 36,
              color: colors.text,
              zIndex: 1,
            }}
          >
            {data.buttonText}
          </span>
        )}

        {frame >= 150 && frame < 170 && (
          <div
            style={{
              position: "absolute",
              width: buttonRippleProgress * 250,
              height: buttonRippleProgress * 250,
              borderRadius: "50%",
              backgroundColor: `${colors.text}20`,
              opacity: 1 - buttonRippleProgress,
            }}
          />
        )}
      </div>

      {/* Result card */}
      {frame >= 175 && (
        <div
          style={{
            position: "absolute",
            left: SAFE_ZONE.left,
            top: resultY,
            width: CONTENT_WIDTH,
            opacity: resultOpacity,
            transform: `scale(${resultScale})`,
          }}
        >
          <div
            style={{
              backgroundColor: `${colors.accent}10`,
              border: `1px solid ${colors.accent}30`,
              borderRadius: 20,
              padding: 32,
              overflow: "hidden",
              position: "relative",
              boxShadow: `0 8px 40px ${colors.accent}15`,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: shineX,
                width: 100,
                height: "100%",
                background: `linear-gradient(90deg, transparent, ${colors.text}08, transparent)`,
                transform: "skewX(-15deg)",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: "#22c55e",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>✓</span>
              </div>
              <span style={{ fontFamily: "Inter", fontSize: 28, color: "#22c55e", fontWeight: 600 }}>
                Success
              </span>
            </div>

            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 600,
                fontSize: 40,
                lineHeight: "52px",
                color: colors.text,
                display: "block",
              }}
            >
              {data.resultText}
            </span>
            {data.resultSubtext && (
              <span
                style={{
                  fontFamily: "Inter",
                  fontWeight: 400,
                  fontSize: 30,
                  lineHeight: "40px",
                  color: `${colors.text}80`,
                  display: "block",
                  marginTop: 12,
                }}
              >
                {data.resultSubtext}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Cursor */}
      {frame < 175 && (
        <>
          <div
            style={{
              position: "absolute",
              left: cursorX - 16,
              top: cursorY - 16,
              width: 32,
              height: 32,
              borderRadius: "50%",
              backgroundColor: `${colors.primary}20`,
              filter: "blur(8px)",
              zIndex: 99,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: cursorX - 8,
              top: cursorY - 8,
              width: 16,
              height: 16,
              borderRadius: "50%",
              backgroundColor: `${colors.text}25`,
              filter: "blur(4px)",
              zIndex: 100,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: cursorX - 7,
              top: cursorY - 7,
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: colors.text,
              border: `2px solid ${colors.primary}`,
              boxShadow: `0 0 16px ${colors.primary}60`,
              zIndex: 101,
            }}
          />
        </>
      )}
    </AbsoluteFill>
  );
};
