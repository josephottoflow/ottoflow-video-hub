/**
 * SCENE 2 — CLAUDE DESIGN BROWSER (8s / 240 frames)
 * Shows a browser with Claude Design open.
 * Cursor clicks Present → New Tab → URL copies.
 *
 * Timeline:
 *   0-30   Browser fades in, shows Claude Design mockup
 *  30-80   Cursor moves to "Present" link at top-right
 *  80-100  Click "Present", dropdown appears
 * 100-130  Cursor moves to "New Tab" in dropdown
 * 130-150  Click "New Tab"
 * 150-200  New tab opens, URL appears highlighted
 * 200-240  URL copied toast, fade out
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

export const Scene2_ClaudeDesign: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [225, 240], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Dropdown visibility
  const showDropdown = frame >= 85;
  const dropdownScale = spring({
    frame: Math.max(0, frame - 85),
    fps,
    config: { damping: 14, stiffness: 200 },
    from: 0.8,
    to: 1,
  });
  const dropdownOpacity = interpolate(frame, [85, 92], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // New tab / URL phase
  const showNewTab = frame >= 140;
  const urlOpacity = interpolate(frame, [155, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Copy toast
  const showCopyToast = frame >= 190;
  const toastY = spring({
    frame: Math.max(0, frame - 190),
    fps,
    config: { damping: 12, stiffness: 150 },
    from: 30,
    to: 0,
  });
  const toastOpacity = interpolate(frame, [190, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Cursor positions (relative to viewport)
  const cursorX = interpolate(
    frame,
    [0, 30, 80, 100, 130, 150],
    [200, 200, 780, 780, 720, 720],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const cursorY = interpolate(
    frame,
    [0, 30, 80, 100, 130, 150],
    [600, 600, 445, 445, 530, 530],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );
  const cursorClicking =
    (frame >= 80 && frame <= 88) || (frame >= 130 && frame <= 138);
  const cursorVisible = frame >= 25 && frame < 155;

  // Hover highlight on "New Tab"
  const hoverNewTab = frame >= 115 && frame < 135;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.bg,
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeIn * fadeOut,
      }}
    >
      {/* Browser showing Claude Design */}
      <div style={{ position: "relative", marginTop: -100 }}>
        <BrowserFrame
          title="Claude"
          url="claude.ai/chat/design-project"
          favicon="✦"
          width={960}
          height={showNewTab ? 900 : 1100}
        >
          {/* Claude Design mockup content */}
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#f8f9fa",
              position: "relative",
            }}
          >
            {/* Top bar with Present & Share */}
            <div
              style={{
                height: 52,
                backgroundColor: "#fff",
                borderBottom: "1px solid #e5e5e5",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
              }}
            >
              <span
                style={{
                  fontFamily: "Inter",
                  fontSize: 15,
                  color: "#666",
                  fontWeight: 500,
                }}
              >
                Design Artifact
              </span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {/* Present link */}
                <div
                  style={{
                    fontFamily: "Inter",
                    fontSize: 14,
                    color: frame >= 80 && frame < 135 ? BRAND.green : "#1a1a1a",
                    fontWeight: 500,
                    cursor: "pointer",
                    padding: "6px 12px",
                    borderRadius: 6,
                    backgroundColor:
                      frame >= 70 && frame < 85 ? "#f0f0f0" : "transparent",
                    position: "relative",
                  }}
                >
                  Present
                  {/* Dropdown */}
                  {showDropdown && frame < 140 && (
                    <div
                      style={{
                        position: "absolute",
                        top: 38,
                        right: 0,
                        width: 180,
                        backgroundColor: "#fff",
                        borderRadius: 10,
                        boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
                        border: "1px solid #e5e5e5",
                        overflow: "hidden",
                        opacity: dropdownOpacity,
                        transform: `scale(${dropdownScale})`,
                        transformOrigin: "top right",
                      }}
                    >
                      <div
                        style={{
                          padding: "10px 16px",
                          fontFamily: "Inter",
                          fontSize: 14,
                          color: "#666",
                          borderBottom: "1px solid #f0f0f0",
                        }}
                      >
                        This Window
                      </div>
                      <div
                        style={{
                          padding: "10px 16px",
                          fontFamily: "Inter",
                          fontSize: 14,
                          color: "#1a1a1a",
                          fontWeight: 500,
                          backgroundColor: hoverNewTab ? "#f5f5f5" : "#fff",
                        }}
                      >
                        ↗ New Tab
                      </div>
                    </div>
                  )}
                </div>
                {/* Share button */}
                <div
                  style={{
                    fontFamily: "Inter",
                    fontSize: 14,
                    color: "#fff",
                    fontWeight: 500,
                    padding: "6px 16px",
                    borderRadius: 8,
                    backgroundColor: "#1a1a1a",
                  }}
                >
                  Share
                </div>
              </div>
            </div>

            {/* Fake canvas/design area */}
            <div
              style={{
                width: "100%",
                height: "calc(100% - 52px)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                background:
                  "linear-gradient(135deg, #667eea22 0%, #764ba222 100%)",
              }}
            >
              {/* Fake animated design preview */}
              <div
                style={{
                  width: 400,
                  height: 300,
                  borderRadius: 16,
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  boxShadow: "0 20px 60px rgba(102,126,234,0.3)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      fontFamily: "Inter",
                      fontSize: 32,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    My Animation
                  </div>
                  <div
                    style={{
                      fontFamily: "Inter",
                      fontSize: 16,
                      color: "rgba(255,255,255,0.7)",
                      marginTop: 8,
                    }}
                  >
                    Claude Design Artifact
                  </div>
                </div>
              </div>
            </div>
          </div>
        </BrowserFrame>

        {/* Cursor */}
        {cursorVisible && (
          <Cursor x={cursorX - 30} y={cursorY - 310} clicking={cursorClicking} />
        )}
      </div>

      {/* URL Copy section - appears after "New Tab" click */}
      {showNewTab && (
        <div
          style={{
            position: "absolute",
            bottom: 280,
            width: DEMO_WIDTH,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            opacity: urlOpacity,
          }}
        >
          <div
            style={{
              fontFamily: "Inter",
              fontSize: 18,
              color: BRAND.textMuted,
              fontWeight: 500,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            URL Copied
          </div>
          <div
            style={{
              maxWidth: 860,
              padding: "14px 24px",
              borderRadius: 12,
              backgroundColor: `${BRAND.green}15`,
              border: `1px solid ${BRAND.green}40`,
              fontFamily: "Inter",
              fontSize: 15,
              color: BRAND.greenLight,
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            https://2d0b2821-9f01-40b1...claudeusercontent.com/v1/design/projects/2d0b2...
          </div>

          {/* Copy toast */}
          {showCopyToast && (
            <div
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                backgroundColor: BRAND.green,
                color: "#fff",
                fontFamily: "Inter",
                fontSize: 16,
                fontWeight: 600,
                opacity: toastOpacity,
                transform: `translateY(${toastY}px)`,
                boxShadow: `0 4px 20px ${BRAND.green}40`,
              }}
            >
              ✓ Link copied to clipboard
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
