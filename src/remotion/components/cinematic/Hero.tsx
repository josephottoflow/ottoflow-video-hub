/**
 * HERO SCENE — Main concept reveal (Scene 3)
 *
 * Two modes:
 *  - Product mode (src provided): floating product image + text below
 *  - Explainer mode (no src): full-frame kinetic headline + concept badge
 *
 * The explainer mode is triggered when src is empty — used for educational/
 * non-product content where Pexels backgrounds supply the visuals.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationVariant, LightingConfig, ThemeConfig, SceneTextConfig } from "../../engine/types";
import { depthShadowCSS } from "../../engine/lightingEngine";
import { LightingOverlay } from "./LightingOverlay";
import { resolveImage } from "../../engine/resolveImage";
import { KineticText } from "../KineticText";

interface HeroProps {
  src: string;
  headline: string;
  subheadline: string;
  variant: AnimationVariant;
  lighting: LightingConfig;
  theme: ThemeConfig;
  textConfig?: SceneTextConfig;
}

export const Hero: React.FC<HeroProps> = ({ src, headline, subheadline, variant, lighting, theme, textConfig }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const opacity = interpolate(frame, [0, 15, durationInFrames - 12, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Detect explainer mode: no product image supplied
  const hasProduct = src && src.trim().length > 0;

  // ── PRODUCT MODE animations ──
  const entry     = spring({ frame, fps, config: { damping: variant.springDamping, stiffness: variant.springStiffness } });
  const floatY    = Math.sin(frame * 0.04 * variant.floatSpeed) * variant.floatAmplitude;
  const rotateY   = Math.sin(frame * 0.025) * variant.rotateAmount;
  const scale     = interpolate(frame, [0, durationInFrames * 0.7], [variant.zoomFrom, variant.zoomTo], { extrapolateRight: "clamp" });
  const headlineS = spring({ frame: frame - 20, fps, config: { damping: 14, stiffness: 120 } });
  const subS      = spring({ frame: frame - 35, fps, config: { damping: 16, stiffness: 100 } });
  const glowSize  = interpolate(frame, [10, 60], [0, 600], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── EXPLAINER MODE animations ──
  // Concept badge (e.g. "99.9997%" or key term) pulses in
  const badgeS    = spring({ frame: frame - 10, fps, config: { damping: 10, stiffness: 140 } });
  const pulseOpacity = 0.12 + 0.08 * Math.sin(frame * 0.06);
  const ringScale = interpolate(frame, [10, 80], [0.6, 1.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  if (hasProduct) {
    // ── PRODUCT MODE ──
    return (
      <AbsoluteFill style={{ opacity }}>
        <LightingOverlay config={lighting} glowCenter="50% 50%" />

        {/* Product glow halo */}
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -55%)",
          width: glowSize, height: glowSize, borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.color}15 0%, ${theme.color}08 40%, transparent 70%)`,
          filter: "blur(20px)",
        }} />

        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 220 }}>
          <Img
            src={resolveImage(src)}
            style={{
              maxWidth: 680, maxHeight: 880, objectFit: "contain",
              transform: `translateY(${floatY}px) scale(${entry * scale}) perspective(1200px) rotateY(${rotateY}deg)`,
              filter: `drop-shadow(${depthShadowCSS(lighting)})`,
            }}
          />
        </AbsoluteFill>

        <div style={{ position: "absolute", bottom: 260, left: 0, right: 0, textAlign: "center", padding: "0 60px" }}>
          <div style={{ fontSize: 76, fontWeight: 800, color: "#fff", fontFamily: "'Inter', sans-serif", lineHeight: "88px", opacity: headlineS, transform: `translateY(${(1 - headlineS) * 30}px)`, textShadow: `0 4px 30px rgba(0,0,0,0.5), 0 0 60px ${theme.color}20` }}>
            {headline}
          </div>
          <div style={{ fontSize: 38, fontWeight: 500, color: "rgba(255,255,255,0.7)", fontFamily: "'Inter', sans-serif", marginTop: 16, opacity: subS, transform: `translateY(${(1 - subS) * 20}px)`, letterSpacing: "0.5px" }}>
            {subheadline}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // ── EXPLAINER MODE — Text-first layout ──
  return (
    <AbsoluteFill style={{ opacity }}>
      <LightingOverlay config={lighting} glowCenter="50% 42%" />

      {/* Pulsing ring behind concept */}
      <div style={{
        position: "absolute", top: "30%", left: "50%",
        transform: `translate(-50%, -50%) scale(${ringScale})`,
        width: 420, height: 420, borderRadius: "50%",
        border: `2px solid ${theme.color}30`,
        boxShadow: `0 0 60px ${theme.color}20, inset 0 0 60px ${theme.color}10`,
        opacity: pulseOpacity * 3,
      }} />

      {/* Concept badge — big glowing accent */}
      <div style={{
        position: "absolute", top: "22%", left: "50%",
        transform: `translate(-50%, 0) scale(${badgeS})`,
        textAlign: "center",
      }}>
        <div style={{
          display: "inline-block",
          padding: "14px 36px",
          borderRadius: 16,
          background: `linear-gradient(135deg, ${theme.color}22 0%, ${theme.color}10 100%)`,
          border: `1.5px solid ${theme.color}50`,
          boxShadow: `0 0 40px ${theme.color}30`,
          backdropFilter: "blur(8px)",
        }}>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: theme.color,
            fontFamily: "'Inter', sans-serif",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
            Key Concept
          </div>
        </div>
      </div>

      {/* Main headline — kinetic word reveal */}
      <div style={{
        position: "absolute", top: "38%", left: 0, right: 0,
        padding: "0 64px",
      }}>
        <KineticText
          text={headline}
          startFrame={12}
          wordStagger={7}
          fontSize={84}
          fontWeight={900}
          color="#ffffff"
          accentColor={theme.color}
          lineHeight={1.1}
          textAlign="center"
          textShadow={`0 6px 32px rgba(0,0,0,0.7), 0 0 80px ${theme.color}25`}
          letterSpacing="-0.03em"
        />
      </div>

      {/* Subheadline — kinetic, delayed */}
      <div style={{
        position: "absolute", top: "68%", left: 0, right: 0,
        padding: "0 72px",
      }}>
        <KineticText
          text={subheadline}
          startFrame={18}
          wordStagger={7}
          fontSize={40}
          fontWeight={500}
          color="rgba(255,255,255,0.88)"
          accentColor={theme.color}
          lineHeight={1.45}
          textAlign="center"
          textShadow="0 3px 14px rgba(0,0,0,0.5)"
          letterSpacing="0em"
        />
      </div>

      {/* Bottom decorative line */}
      <div style={{
        position: "absolute", bottom: 180, left: "50%",
        transform: "translateX(-50%)",
        width: interpolate(frame, [40, 90], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        height: 2,
        background: `linear-gradient(90deg, transparent, ${theme.color}70, transparent)`,
        borderRadius: 1,
      }} />
    </AbsoluteFill>
  );
};
