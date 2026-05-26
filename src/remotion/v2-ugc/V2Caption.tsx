// v2 — Dynamic caption engine: 4 styles (impact, word-by-word, slide-up, pulse)
// Must be used inside a <Sequence> — useCurrentFrame() is relative to scene start

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

interface V2CaptionProps {
  caption:        string;
  keyWord:        string;
  highlightColor?: string;                   // from visual style token
  style?:          "impact" | "word-by-word" | "slide-up" | "pulse";
  durationFrames?: number;
}

export const V2Caption: React.FC<V2CaptionProps> = ({
  caption,
  keyWord,
  highlightColor  = "#FFE500",
  style           = "impact",
  durationFrames  = 150,
}) => {
  const frame   = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words   = caption.split(" ").slice(0, style === "impact" ? 3 : 6);

  const fadeIn  = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [durationFrames - 10, durationFrames], [1, 0], { extrapolateLeft: "clamp" });
  const globalOpacity = Math.min(fadeIn, fadeOut);

  // ── IMPACT: bold spring-reveal per word, keyword highlighted ──
  if (style === "impact") {
    return (
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, transform: "translateY(-50%)", paddingLeft: 48, paddingRight: 48, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 10px", opacity: globalOpacity }}>
        {words.map((word, i) => {
          const delay   = i * 5;
          const prog    = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 220, mass: 0.7 } });
          const isKey   = word.toLowerCase().replace(/[^a-z0-9%]/g, "") === keyWord.toLowerCase().replace(/[^a-z0-9%]/g, "");
          return (
            <span key={i} style={{
              display:       "inline-block",
              opacity:       interpolate(prog, [0, 1], [0, 1]),
              transform:     `translateY(${interpolate(prog, [0, 1], [20, 0])}px) scale(${interpolate(prog, [0, 1], [0.85, 1])})`,
              fontFamily:    "'Space Grotesk', sans-serif",
              fontSize:      isKey ? 92 : 78,
              fontWeight:    900,
              color:         isKey ? highlightColor : "#FFFFFF",
              WebkitTextStroke: isKey ? "0px" : "1.5px rgba(0,0,0,0.8)",
              textShadow:    isKey
                ? `0 0 40px ${highlightColor}80, 0 0 12px rgba(0,0,0,1), 0 4px 16px rgba(0,0,0,0.9)`
                : "0 0 8px rgba(0,0,0,1), 0 4px 16px rgba(0,0,0,0.95)",
              letterSpacing: isKey ? "0.04em" : "0.01em",
              lineHeight:    1.1,
              marginBottom:  8,
            }}>
              {isKey ? word.toUpperCase() : word}
            </span>
          );
        })}
      </div>
    );
  }

  // ── WORD-BY-WORD: words pop in sequentially every 8 frames ──
  if (style === "word-by-word") {
    const visibleCount = Math.min(Math.floor(frame / 8) + 1, words.length);
    return (
      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, transform: "translateY(-50%)", paddingLeft: 48, paddingRight: 48, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 10px", opacity: Math.min(fadeIn, fadeOut) }}>
        {words.map((word, i) => {
          const isKey    = word.toLowerCase().replace(/[^a-z0-9%]/g, "") === keyWord.toLowerCase().replace(/[^a-z0-9%]/g, "");
          const visible  = i < visibleCount;
          const wordProg = spring({ frame: frame - i * 8, fps, config: { damping: 12, stiffness: 300, mass: 0.5 } });
          return (
            <span key={i} style={{
              display:    "inline-block",
              opacity:    visible ? interpolate(wordProg, [0, 1], [0, 1]) : 0,
              transform:  visible ? `scale(${interpolate(wordProg, [0, 1], [1.2, 1])})` : "scale(1.2)",
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize:   78,
              fontWeight: 800,
              color:      isKey ? highlightColor : "#FFFFFF",
              WebkitTextStroke: "1.5px rgba(0,0,0,0.8)",
              textShadow: "0 0 8px rgba(0,0,0,1), 0 4px 16px rgba(0,0,0,0.95)",
              lineHeight: 1.15,
              marginBottom: 6,
            }}>
              {isKey ? word.toUpperCase() : word}
            </span>
          );
        })}
      </div>
    );
  }

  // ── SLIDE-UP: full phrase slides up from bottom ──
  if (style === "slide-up") {
    const slideProgress = spring({ frame, fps, config: { damping: 18, stiffness: 160, mass: 0.9 } });
    const slideY = interpolate(slideProgress, [0, 1], [60, 0]);
    return (
      <div style={{ position: "absolute", bottom: "28%", left: 0, right: 0, paddingLeft: 48, paddingRight: 48, textAlign: "center", opacity: Math.min(fadeIn, fadeOut), transform: `translateY(${slideY}px)` }}>
        {words.map((word, i) => {
          const isKey = word.toLowerCase().replace(/[^a-z0-9%]/g, "") === keyWord.toLowerCase().replace(/[^a-z0-9%]/g, "");
          return (
            <span key={i} style={{
              display:       "inline-block",
              marginRight:   10,
              fontFamily:    "'Space Grotesk', sans-serif",
              fontSize:      82,
              fontWeight:    800,
              color:         isKey ? highlightColor : "#FFFFFF",
              WebkitTextStroke: isKey ? "0px" : "1.5px rgba(0,0,0,0.8)",
              textShadow:    isKey
                ? `0 0 30px ${highlightColor}60, 0 0 10px rgba(0,0,0,1), 0 4px 16px rgba(0,0,0,0.9)`
                : "0 0 8px rgba(0,0,0,1), 0 4px 20px rgba(0,0,0,0.95)",
              lineHeight:    1.15,
            }}>
              {isKey ? word.toUpperCase() : word}
            </span>
          );
        })}
      </div>
    );
  }

  // ── PULSE: each word scales in with a bounce, staggered ──
  return (
    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, transform: "translateY(-50%)", paddingLeft: 48, paddingRight: 48, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 10px", opacity: globalOpacity }}>
      {words.map((word, i) => {
        const delay   = i * 6;
        const prog    = spring({ frame: frame - delay, fps, config: { damping: 8, stiffness: 500, mass: 0.4 } });
        const scale   = interpolate(prog, [0, 1], [0.4, 1], { extrapolateRight: "clamp" });
        const isKey   = word.toLowerCase().replace(/[^a-z0-9%]/g, "") === keyWord.toLowerCase().replace(/[^a-z0-9%]/g, "");
        return (
          <span key={i} style={{
            display:       "inline-block",
            opacity:       interpolate(prog, [0, 0.3, 1], [0, 1, 1]),
            transform:     `scale(${scale})`,
            fontFamily:    "'Space Grotesk', sans-serif",
            fontSize:      isKey ? 96 : 80,
            fontWeight:    900,
            color:         isKey ? highlightColor : "#FFFFFF",
            WebkitTextStroke: isKey ? "0px" : "1.5px rgba(0,0,0,0.8)",
            textShadow:    isKey
              ? `0 0 60px ${highlightColor}90, 0 0 12px rgba(0,0,0,1), 0 4px 20px rgba(0,0,0,0.9)`
              : "0 0 8px rgba(0,0,0,1), 0 4px 16px rgba(0,0,0,0.95)",
            letterSpacing: isKey ? "0.05em" : "0.01em",
            lineHeight:    1.1,
            marginBottom:  8,
          }}>
            {isKey ? word.toUpperCase() : word}
          </span>
        );
      })}
    </div>
  );
};
