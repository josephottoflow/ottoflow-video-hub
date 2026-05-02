/**
 * Animated cursor with glow effect
 */
import React from "react";
import { BRAND } from "../types";

interface Props {
  x: number;
  y: number;
  opacity?: number;
  clicking?: boolean;
  scale?: number;
}

export const Cursor: React.FC<Props> = ({
  x,
  y,
  opacity = 1,
  clicking = false,
  scale = 1,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity,
      zIndex: 999,
      pointerEvents: "none",
      transform: `scale(${scale})`,
    }}
  >
    {/* Glow behind cursor */}
    <div
      style={{
        position: "absolute",
        width: 36,
        height: 36,
        borderRadius: "50%",
        backgroundColor: BRAND.green,
        opacity: clicking ? 0.5 : 0.25,
        filter: "blur(12px)",
        transform: "translate(-14px, -14px)",
      }}
    />
    {/* Click ripple */}
    {clicking && (
      <div
        style={{
          position: "absolute",
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: `2px solid ${BRAND.green}`,
          opacity: 0.5,
          transform: "translate(-18px, -18px)",
        }}
      />
    )}
    {/* Cursor arrow */}
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}
    >
      <path
        d="M5.5 3L19.5 12.5L12 13.5L8.5 21L5.5 3Z"
        fill="white"
        stroke="#222"
        strokeWidth="1.2"
      />
    </svg>
  </div>
);
