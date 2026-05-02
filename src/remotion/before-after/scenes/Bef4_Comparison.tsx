import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { BrandColors } from "../../types";

// TODO: Implement Comparison scene — Side by Side
export const Bef4_Comparison: React.FC<{ colors: BrandColors }> = ({ colors }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontSize: 36, color: colors.text, fontWeight: 600 }}>Side by Side</div>
    </AbsoluteFill>
  );
};
