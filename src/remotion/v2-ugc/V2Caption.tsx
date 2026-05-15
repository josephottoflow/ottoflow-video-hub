// v2 — Bold 3-4 word caption with spring reveal and key word highlight, centered on screen
// Note: must be used inside a <Sequence> — frame is already relative to scene start

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

interface V2CaptionProps {
  caption: string;
  keyWord: string;
}

export const V2Caption: React.FC<V2CaptionProps> = ({ caption, keyWord }) => {
  const frame   = useCurrentFrame(); // relative to Sequence start
  const { fps } = useVideoConfig();

  const words = caption.split(" ").slice(0, 3);

  return (
    <div
      style={{
        position:       "absolute",
        top:            "50%",
        left:           0,
        right:          0,
        transform:      "translateY(-50%)",
        paddingLeft:    48,
        paddingRight:   48,
        display:        "flex",
        flexWrap:       "wrap",
        justifyContent: "center",
        gap:            "0 12px",
      }}
    >
      {words.map((word, i) => {
        const delay    = i * 4;
        const progress = spring({
          frame:  frame - delay,
          fps,
          config: { damping: 14, stiffness: 200, mass: 0.8 },
        });

        const isKey       = word.toLowerCase().replace(/[^a-z]/g, "") === keyWord.toLowerCase().replace(/[^a-z]/g, "");
        const displayWord = isKey ? word.toUpperCase() : word;

        return (
          <span
            key={i}
            style={{
              display:       "inline-block",
              opacity:       interpolate(progress, [0, 1], [0, 1]),
              transform:     `translateY(${interpolate(progress, [0, 1], [24, 0])}px)`,
              fontFamily:    "'Space Grotesk', sans-serif",
              fontSize:      isKey ? 88 : 76,
              fontWeight:    isKey ? 900 : 700,
              color:         isKey ? "#FFE500" : "#FFFFFF",
              textShadow:    isKey
                ? "0 0 40px rgba(255,229,0,0.6), 0 4px 16px rgba(0,0,0,0.9)"
                : "0 4px 16px rgba(0,0,0,0.85)",
              letterSpacing: isKey ? "0.04em" : "0.01em",
              lineHeight:    1.1,
              marginBottom:  8,
            }}
          >
            {displayWord}
          </span>
        );
      })}
    </div>
  );
};
