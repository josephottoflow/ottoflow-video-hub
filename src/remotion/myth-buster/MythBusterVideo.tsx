/**
 * MYTH BUSTER TEMPLATE — Myth vs Reality reveal format
 * Best for: debunking, controversial takes, "you've been lied to", paradigm shifts
 * Font: Bebas Neue (already loaded) for maximum impact
 * Style: Dramatic red MYTH → explosive green REALITY reveal with split screen
 */

import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame } from "remotion";
import { z } from "zod";
import type { ProductVideoData } from "../types";
import { BEBAS, SPACE_GROTESK } from "../fonts";
import { SceneBackground } from "../components/SceneBackground";
type Backgrounds = { videos?: string[]; photos?: string[] };

export const mythBusterSchema = z.object({ data: z.any() });

// ── Timing ────────────────────────────────────────────────────
export const MB_FPS   = 30;
export const MB_W     = 1080;
export const MB_H     = 1920;
const S = (s: number) => Math.round(s * MB_FPS);

const MYTH_START    = 0;                              const MYTH_DUR    = S(3);
const SHOCK_START   = MYTH_DUR;                       const SHOCK_DUR   = S(2);
const REALITY_START = SHOCK_START + SHOCK_DUR;        const REALITY_DUR = S(4);
const PROOF_START   = REALITY_START + REALITY_DUR;    const PROOF_DUR   = S(3.5);
const CTA_START     = PROOF_START + PROOF_DUR;        const CTA_DUR     = S(2.5);
export const MB_TOTAL = CTA_START + CTA_DUR; // 450f = 15s

function spr(frame: number, delay = 0) {
  return spring({ frame: frame - delay, fps: MB_FPS, config: { damping: 10, stiffness: 200, mass: 0.7 } });
}

const RED   = "#ef4444";
const GREEN = "#10b981";
const AMBER = "#f59e0b";

// ── Scenes ────────────────────────────────────────────────────

function MythScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame = useCurrentFrame();
  const fadeOut = interpolate(frame, [MYTH_DUR - 15, MYTH_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const mythLabel = interpolate(spr(frame), [0, 1], [0, 1]);
  const textY     = interpolate(spr(frame, 8), [0, 1], [100, 0]);
  const crackW    = interpolate(frame, [40, 70], [0, 1080], { extrapolateRight: "clamp" });
  const shake     = frame > MYTH_DUR * 0.7 ? Math.sin(frame * 3) * 3 : 0;

  return (
    <AbsoluteFill style={{ background: "#1a0505", opacity: fadeOut, transform: `translateX(${shake}px)` }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={0} accentColor={RED} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 90% 70% at 50% 50%, ${RED}20 0%, transparent 65%)` }} />

      {/* Diagonal crack line */}
      <div style={{ position: "absolute", top: "50%", left: 0, width: crackW, height: 2, background: `linear-gradient(90deg, transparent, ${RED}60, transparent)`, transform: "translateY(-50%)" }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 72px" }}>
        {/* MYTH badge */}
        <div style={{ transform: `scale(${mythLabel})`, marginBottom: 32 }}>
          <div style={{ background: RED, padding: "12px 36px", borderRadius: 8, boxShadow: `0 0 40px ${RED}80` }}>
            <p style={{ fontFamily: BEBAS, fontSize: 32, color: "#fff", letterSpacing: 6 }}>⚠ MYTH</p>
          </div>
        </div>

        <div style={{ transform: `translateY(${textY}px)`, textAlign: "center" }}>
          <h1 style={{ fontFamily: BEBAS, fontSize: 100, color: "#fff", lineHeight: 1, letterSpacing: 1, textShadow: `0 0 40px ${RED}80` }}>
            {data.hook.painPointQuestion}
          </h1>
        </div>

        {/* X mark */}
        <div style={{ marginTop: 40, width: 80, height: 80, borderRadius: "50%", background: `${RED}30`, border: `3px solid ${RED}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 30px ${RED}60` }}>
          <span style={{ fontFamily: BEBAS, fontSize: 52, color: RED }}>✕</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ShockScene() {
  const frame  = useCurrentFrame();
  const scale  = interpolate(spr(frame), [0, 1], [2, 1]);
  const fadeOut = interpolate(frame, [SHOCK_DUR - 10, SHOCK_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flash  = interpolate(frame, [0, 8, 16], [1, 0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#fff", opacity: fadeOut * flash, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ fontFamily: BEBAS, fontSize: 180, color: RED, transform: `scale(${scale})`, lineHeight: 1, textShadow: `0 0 60px ${RED}` }}>
        WRONG!
      </h1>
    </AbsoluteFill>
  );
}

function RealityScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const fadeOut = interpolate(frame, [REALITY_DUR - 15, REALITY_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  const badgeS = spr(frame, 0);
  const textY  = interpolate(spr(frame, 10), [0, 1], [80, 0]);
  const glowR  = interpolate(frame, [20, 60], [0, 80], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#021a0a", opacity: Math.min(opacity, fadeOut) }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={2} accentColor={GREEN} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 90% 70% at 50% 50%, ${GREEN}18 0%, transparent 65%)` }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 72px" }}>
        {/* REALITY badge */}
        <div style={{ transform: `scale(${interpolate(badgeS, [0, 1], [0, 1])})`, marginBottom: 32 }}>
          <div style={{ background: GREEN, padding: "12px 36px", borderRadius: 8, boxShadow: `0 0 40px ${GREEN}80` }}>
            <p style={{ fontFamily: BEBAS, fontSize: 32, color: "#fff", letterSpacing: 6 }}>✓ REALITY</p>
          </div>
        </div>

        <div style={{ transform: `translateY(${textY}px)`, textAlign: "center" }}>
          <h1 style={{ fontFamily: BEBAS, fontSize: 96, color: "#fff", lineHeight: 1, letterSpacing: 1, textShadow: `0 0 ${glowR}px ${GREEN}` }}>
            {data.simulatedDemo?.resultText || data.productIntro.tagline}
          </h1>
          {data.simulatedDemo?.resultSubtext && (
            <p style={{ fontFamily: SPACE_GROTESK, fontSize: 32, color: `${GREEN}cc`, marginTop: 24, lineHeight: 1.4 }}>
              {data.simulatedDemo.resultSubtext}
            </p>
          )}
        </div>

        {/* Checkmark */}
        <div style={{ marginTop: 40, width: 80, height: 80, borderRadius: "50%", background: `${GREEN}25`, border: `3px solid ${GREEN}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 30px ${GREEN}60` }}>
          <span style={{ fontFamily: BEBAS, fontSize: 52, color: GREEN }}>✓</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ProofScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame    = useCurrentFrame();
  const features = data.featureCallouts.features.slice(0, 4);
  const opacity  = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const primary  = data.brandColors.primary;

  return (
    <AbsoluteFill style={{ background: "#03100a", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={3} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 100% 35% at 50% 0%, ${GREEN}12 0%, transparent 55%)` }} />

      <div style={{ position: "absolute", top: 160, left: 0, right: 0, padding: "0 72px" }}>
        <p style={{ fontFamily: BEBAS, fontSize: 28, color: AMBER, letterSpacing: 6, marginBottom: 12 }}>HERE'S THE PROOF</p>
        <div style={{ height: 3, width: 200, background: AMBER, borderRadius: 2, marginBottom: 52 }} />

        {features.map((feat, i) => {
          const delay = i * 14;
          const s   = spr(frame, delay);
          const x   = interpolate(s, [0, 1], [-140, 0]);
          const op  = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 40, transform: `translateX(${x}px)`, opacity: op }}>
              <div style={{ flexShrink: 0, marginTop: 6 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: GREEN, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 14px ${GREEN}60` }}>
                  <span style={{ fontFamily: BEBAS, fontSize: 18, color: "#fff" }}>✓</span>
                </div>
              </div>
              <p style={{ fontFamily: SPACE_GROTESK, fontSize: 38, fontWeight: 700, color: "#e0ffe8", lineHeight: 1.25 }}>
                {feat.text}
              </p>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", bottom: 180, left: 72, right: 72 }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${primary}60, transparent)` }} />
      </div>
    </AbsoluteFill>
  );
}

function CtaScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const s       = spr(frame, 5);
  const scale   = interpolate(s, [0, 1], [0.85, 1]);
  const pulse   = interpolate(frame % 30, [0, 15, 30], [1, 1.04, 1]);

  return (
    <AbsoluteFill style={{ background: "#020a06", display: "flex", alignItems: "center", justifyContent: "center", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={4} accentColor={GREEN} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${GREEN}15 0%, transparent 65%)` }} />

      <div style={{ textAlign: "center", padding: "0 80px", transform: `scale(${scale})` }}>
        <h2 style={{ fontFamily: BEBAS, fontSize: 96, color: "#fff", lineHeight: 1, letterSpacing: 1 }}>
          Don&apos;t get fooled again
        </h2>
        <p style={{ fontFamily: SPACE_GROTESK, fontSize: 30, color: "#80c090", marginTop: 20, marginBottom: 52, lineHeight: 1.4 }}>
          Follow for daily myth-busting content
        </p>
        <div style={{ transform: `scale(${pulse})` }}>
          <div style={{ display: "inline-block", padding: "22px 64px", borderRadius: 16, background: `linear-gradient(135deg, ${GREEN}, #059669)`, boxShadow: `0 8px 36px ${GREEN}60` }}>
            <p style={{ fontFamily: BEBAS, fontSize: 38, color: "#fff", letterSpacing: 2 }}>
              {data.socialProofCta.ctaUrl}
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Main ──────────────────────────────────────────────────────

export function MythBusterVideo({ data }: { data: ProductVideoData | null }) {
  if (!data) return <AbsoluteFill style={{ background: "#020a06" }} />;
  const bg: Backgrounds = { videos: data.backgrounds?.videos, photos: data.backgrounds?.photos };
  return (
    <AbsoluteFill>
      <Sequence from={MYTH_START}    durationInFrames={MYTH_DUR}>    <MythScene    data={data} bg={bg} /></Sequence>
      <Sequence from={SHOCK_START}   durationInFrames={SHOCK_DUR}>   <ShockScene /></Sequence>
      <Sequence from={REALITY_START} durationInFrames={REALITY_DUR}><RealityScene  data={data} bg={bg} /></Sequence>
      <Sequence from={PROOF_START}   durationInFrames={PROOF_DUR}>   <ProofScene   data={data} bg={bg} /></Sequence>
      <Sequence from={CTA_START}     durationInFrames={CTA_DUR}>     <CtaScene     data={data} bg={bg} /></Sequence>
    </AbsoluteFill>
  );
}
