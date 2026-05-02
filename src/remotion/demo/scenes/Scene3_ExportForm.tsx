/**
 * SCENE 3 — EXPORT FORM (5s / 150 frames)
 * Shows claudevideoexport.com with the URL pasted and Export clicked.
 *
 * Timeline:
 *   0-20   Browser fades in showing the site
 *  20-60   URL text types into the input field
 *  60-80   Cursor moves to "Export →" button
 *  80-95   Click button, button depresses
 *  95-150  Button glows, transition out
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
import { BrowserFrame } from "../components/BrowserFrame";
import { Cursor } from "../components/Cursor";

export const Scene3_ExportForm: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [135, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Typing animation
  const fullUrl =
    "https://2d0b2821-9f01-40b1-b0a6...claudeusercontent.com/v1/design/projects/2d0b2...";
  const typingProgress = interpolate(frame, [20, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const visibleChars = Math.floor(typingProgress * fullUrl.length);
  const typedUrl = fullUrl.slice(0, visibleChars);
  const showCursor = frame >= 20 && frame < 62 && Math.floor(frame / 4) % 2 === 0;

  // Cursor movement
  const cursorX = interpolate(frame, [0, 20, 60, 80], [300, 480, 480, 770], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorY = interpolate(frame, [0, 20, 60, 80], [700, 555, 555, 555], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clicking = frame >= 82 && frame <= 90;
  const cursorVisible = frame >= 15 && frame < 100;

  // Button state
  const buttonPressed = frame >= 82;
  const buttonGlow = interpolate(frame, [82, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const buttonScale = buttonPressed
    ? spring({
        frame: Math.max(0, frame - 82),
        fps,
        config: { damping: 8, stiffness: 200 },
        from: 0.92,
        to: 1,
      })
    : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bg,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn * fadeOut,
      }}
    >
      <div style={{ position: "relative", marginTop: -80 }}>
        <BrowserFrame
          title="Claude Video Export"
          url="claudevideoexport.com"
          favicon="🎬"
          width={960}
          height={1000}
        >
          {/* Site mockup */}
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#fff",
              padding: "50px 40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Logo / Title */}
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#1a1a1a",
                  lineHeight: "44px",
                }}
              >
                Claude animations,
              </div>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#1a1a1a",
                  lineHeight: "44px",
                }}
              >
                exported as MP4.
              </div>
              <div
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 36,
                  fontWeight: 700,
                  color: BRAND.yellow,
                  fontStyle: "italic",
                  marginTop: 4,
                }}
              >
                Finally.
              </div>
            </div>

            {/* Form card */}
            <div
              style={{
                width: "100%",
                maxWidth: 700,
                backgroundColor: "#fff",
                borderRadius: 16,
                border: "1px solid #e5e5e5",
                padding: "32px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
              }}
            >
              {/* Tab headers */}
              <div
                style={{
                  display: "flex",
                  gap: 0,
                  marginBottom: 24,
                  borderBottom: "1px solid #e5e5e5",
                }}
              >
                <div
                  style={{
                    padding: "10px 18px",
                    fontFamily: "Inter",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#1a1a1a",
                    borderBottom: `2px solid ${BRAND.green}`,
                  }}
                >
                  🔗 Paste a URL
                </div>
                <div
                  style={{
                    padding: "10px 18px",
                    fontFamily: "Inter",
                    fontSize: 14,
                    color: "#999",
                  }}
                >
                  📦 Upload a ZIP
                </div>
              </div>

              {/* Label */}
              <div
                style={{
                  fontFamily: "Inter",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#888",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                CLAUDE PRESENT SHARE LINK
              </div>

              {/* Input + Export button row */}
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {/* URL Input */}
                <div
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 10,
                    border: frame >= 20 ? `2px solid ${BRAND.green}` : "1px solid #ddd",
                    backgroundColor: "#fafafa",
                    display: "flex",
                    alignItems: "center",
                    padding: "0 16px",
                    fontFamily: "Inter",
                    fontSize: 14,
                    color: frame >= 20 ? "#1a1a1a" : "#bbb",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {frame < 20 ? "claude.ai/artifacts/..." : typedUrl}
                  {showCursor && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 2,
                        height: 20,
                        backgroundColor: BRAND.green,
                        marginLeft: 1,
                      }}
                    />
                  )}
                </div>

                {/* Export button */}
                <div
                  style={{
                    padding: "12px 28px",
                    borderRadius: 10,
                    backgroundColor: BRAND.green,
                    color: "#fff",
                    fontFamily: "Inter",
                    fontSize: 16,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    transform: `scale(${buttonScale})`,
                    boxShadow: buttonPressed
                      ? `0 0 ${30 * buttonGlow}px ${BRAND.green}60`
                      : "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                >
                  Export →
                </div>
              </div>

              {/* Helper text */}
              <div
                style={{
                  fontFamily: "Inter",
                  fontSize: 13,
                  color: "#999",
                  marginTop: 12,
                }}
              >
                In Claude Design, Click Present → New Tab → Copy the URL here.
              </div>
            </div>

            {/* Trust badges */}
            <div
              style={{
                display: "flex",
                gap: 24,
                marginTop: 28,
              }}
            >
              {["Free, for now", "No account", "No watermark"].map((text) => (
                <div
                  key={text}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontFamily: "Inter",
                    fontSize: 13,
                    color: "#777",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: BRAND.green,
                    }}
                  />
                  {text}
                </div>
              ))}
            </div>
          </div>
        </BrowserFrame>

        {/* Cursor */}
        {cursorVisible && (
          <Cursor x={cursorX - 30} y={cursorY - 370} clicking={clicking} />
        )}
      </div>
    </AbsoluteFill>
  );
};
