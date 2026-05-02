/**
 * PRODUCT DEMO SCENE 2 — THE OLD WAY (6s / 180 frames)
 * Shows a browser with generic shopping frustration:
 * scrolling through boring listings, bad photos, confusing results.
 * Uses product name to personalize the search.
 */
import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { BrandColors } from "../../types";
import { PD_COLORS, PD_WIDTH } from "../types";

interface Props {
  productName: string;
  colors: BrandColors;
}

const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
};

export const PD2_OldWay: React.FC<Props> = ({ productName, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [165, 180], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Scroll effect — listings scroll up
  const scrollY = interpolate(frame, [30, 140], [0, -600], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // "X" marks and frustrated indicators appear
  const showFrustration = frame >= 80;
  const frustrationOpacity = interpolate(frame, [80, 95], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Title "The old way..." fades in
  const titleOp = interpolate(frame, [5, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Fake product listings
  const listings = Array.from({ length: 8 }, (_, i) => ({
    name: [
      `${productName} - Basic Model`,
      `Cheap ${productName} Clone`,
      `${productName} (Low Quality)`,
      `Generic Product #${i + 1}`,
      `Budget ${productName} Copy`,
      `${productName} - Refurbished`,
      `No-Brand ${productName}`,
      `${productName} Knockoff`,
    ][i],
    price: `$${Math.floor(seededRandom(i * 7) * 80 + 10)}.99`,
    rating: Math.floor(seededRandom(i * 3 + 1) * 3 + 1),
    reviews: Math.floor(seededRandom(i * 5 + 2) * 200 + 5),
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: PD_COLORS.bg, justifyContent: "center", alignItems: "center", opacity: fadeIn * fadeOut }}>
      {/* Title */}
      <div style={{
        position: "absolute", top: 120, width: PD_WIDTH, textAlign: "center", opacity: titleOp, zIndex: 10,
      }}>
        <span style={{ fontFamily: "Inter", fontSize: 28, fontWeight: 500, color: PD_COLORS.textMuted, letterSpacing: 3, textTransform: "uppercase" }}>
          The old way...
        </span>
      </div>

      {/* Browser mockup */}
      <div style={{
        width: 940, height: 1200, borderRadius: 20, overflow: "hidden", marginTop: 60,
        backgroundColor: PD_COLORS.bgBrowser, border: `1px solid ${PD_COLORS.border}`,
        boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Title bar */}
        <div style={{ height: 48, backgroundColor: PD_COLORS.bgBrowserBar, display: "flex", alignItems: "center", padding: "0 18px", gap: 10, borderBottom: `1px solid ${PD_COLORS.border}` }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: "#ff5f56" }} />
            <div style={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: "#ffbd2e" }} />
            <div style={{ width: 13, height: 13, borderRadius: "50%", backgroundColor: "#27c93f" }} />
          </div>
          <div style={{ padding: "6px 14px", backgroundColor: PD_COLORS.bgBrowser, borderRadius: "8px 8px 0 0", fontSize: 13, fontFamily: "Inter", color: "#999" }}>
            🔍 Shopping Results
          </div>
        </div>
        {/* Search bar */}
        <div style={{ height: 50, backgroundColor: PD_COLORS.bgBrowserBar, display: "flex", alignItems: "center", padding: "0 18px", borderBottom: `1px solid ${PD_COLORS.border}` }}>
          <div style={{ flex: 1, height: 32, borderRadius: 8, backgroundColor: PD_COLORS.inputBg, display: "flex", alignItems: "center", padding: "0 14px", fontSize: 14, fontFamily: "Inter", color: "#777" }}>
            🔍 {productName}
          </div>
        </div>
        {/* Scrolling results */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative", backgroundColor: "#f5f5f5" }}>
          <div style={{ transform: `translateY(${scrollY}px)`, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {listings.map((item, i) => {
              const isMarked = showFrustration && (i === 0 || i === 2 || i === 4);
              return (
                <div key={i} style={{
                  display: "flex", gap: 14, padding: 14, borderRadius: 12,
                  backgroundColor: "#fff", border: isMarked ? "2px solid #ff4444" : "1px solid #e5e5e5",
                  opacity: isMarked ? 0.5 : 1,
                  position: "relative",
                }}>
                  {/* Fake image placeholder */}
                  <div style={{
                    width: 90, height: 90, borderRadius: 10, backgroundColor: "#e8e8e8",
                    display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 28, color: "#bbb" }}>📦</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "Inter", fontSize: 15, fontWeight: 600, color: "#333", marginBottom: 4 }}>{item.name}</div>
                    <div style={{ fontFamily: "Inter", fontSize: 13, color: "#999", marginBottom: 6 }}>
                      {"⭐".repeat(item.rating)}{"☆".repeat(5 - item.rating)} ({item.reviews})
                    </div>
                    <div style={{ fontFamily: "Inter", fontSize: 18, fontWeight: 700, color: "#333" }}>{item.price}</div>
                  </div>
                  {/* Red X on bad ones */}
                  {isMarked && (
                    <div style={{
                      position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                      fontSize: 60, color: "#ff4444", fontWeight: 800, opacity: frustrationOpacity,
                      textShadow: "0 2px 10px rgba(255,68,68,0.3)",
                    }}>
                      ✕
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Frustration overlay text */}
      {showFrustration && (
        <div style={{
          position: "absolute", bottom: 180, width: PD_WIDTH, textAlign: "center",
          opacity: frustrationOpacity,
        }}>
          <span style={{ fontFamily: "Inter", fontSize: 32, fontWeight: 700, color: "#ff6b6b" }}>
            Endless scrolling. No quality.
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
