/**
 * STATS STORY TEMPLATE — Data-driven number impact format
 * Best for: case studies, ROI stats, "X% of people", business metrics
 * Font: Bebas Neue for impact numbers + Montserrat for labels
 * Style: Dark bg, huge animated numbers with glow, infographic feel
 */

import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame } from "remotion";
import { z } from "zod";
import type { ProductVideoData } from "../types";
import { BEBAS, MONTSERRAT } from "../fonts";
import { SceneBackground } from "../components/SceneBackground";
type Backgrounds = { videos?: string[]; photos?: string[] };

export const statsStorySchema = z.object({ data: z.any() });

// ── Timing ────────────────────────────────────────────────────
export const SS_FPS   = 30;
export const SS_W     = 1080;
export const SS_H     = 1920;
const S = (s: number) => Math.round(s * SS_FPS);

const HOOK_START  = 0;           const HOOK_DUR  = S(2.5);
const STAT1_START = HOOK_DUR;    const STAT1_DUR = S(3.5);
const STAT2_START = STAT1_START + STAT1_DUR; const STAT2_DUR = S(3.5);
const PROOF_START = STAT2_START + STAT2_DUR; const PROOF_DUR = S(3);
const CTA_START   = PROOF_START + PROOF_DUR; const CTA_DUR   = S(2.5);
export const SS_TOTAL = CTA_START + CTA_DUR; // 450f = 15s

function spr(frame: number, delay = 0) {
  return spring({ frame: frame - delay, fps: SS_FPS, config: { damping: 12, stiffness: 180, mass: 0.8 } });
}

function easeCount(frame: number, from: number, to: number, duration: number) {
  const t = Math.min(frame / duration, 1);
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  return Math.round(from + (to - from) * eased);
}

// ── BG bars animation ─────────────────────────────────────────

function DataBars({ frame, color }: { frame: number; color: string }) {
  const bars = [0.72, 0.45, 0.88, 0.33, 0.61];
  return (
    <div style={{ position: "absolute", bottom: 140, left: 60, right: 60, display: "flex", gap: 18, alignItems: "flex-end", height: 200 }}>
      {bars.map((h, i) => {
        const grow = interpolate(frame, [i * 8, i * 8 + 30], [0, h], { extrapolateRight: "clamp" });
        return (
          <div key={i} style={{ flex: 1, height: `${grow * 100}%`, borderRadius: "6px 6px 0 0", background: `linear-gradient(180deg, ${color}dd, ${color}44)`, boxShadow: `0 0 12px ${color}40` }} />
        );
      })}
    </div>
  );
}

// ── Scenes ────────────────────────────────────────────────────

function HookScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const fadeOut = interpolate(frame, [HOOK_DUR - 18, HOOK_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s       = spr(frame);
  const scale   = interpolate(s, [0, 1], [1.2, 1]);
  const glow    = interpolate(frame % 60, [0, 30, 60], [30, 60, 30]);

  return (
    <AbsoluteFill style={{ background: "#030308", opacity: fadeOut }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={0} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 55% at 50% 50%, ${primary}25 0%, transparent 70%)` }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 72px" }}>
        <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
          <p style={{ fontFamily: MONTSERRAT, fontSize: 24, fontWeight: 600, color: primary, letterSpacing: 5, textTransform: "uppercase", marginBottom: 24 }}>THE NUMBERS DON'T LIE</p>
          <h1 style={{ fontFamily: BEBAS, fontSize: 96, color: "#fff", lineHeight: 1, letterSpacing: 2, textShadow: `0 0 ${glow}px ${primary}` }}>
            {data.hook.painPointQuestion}
          </h1>
        </div>
        <DataBars frame={frame} color={primary} />
      </div>
    </AbsoluteFill>
  );
}

function BigStatScene({ label, value, subtext, color, accent, bg, sceneIndex = 0 }: {
  label: string; value: string; subtext?: string;
  color: string; accent: string; bg: Backgrounds; sceneIndex?: number;
}) {
  const frame   = useCurrentFrame();
  const s       = spr(frame);
  const scale   = interpolate(s, [0, 1], [0.5, 1]);
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const glow    = interpolate(frame, [10, 40], [20, 70], { extrapolateRight: "clamp" });
  const ring    = interpolate(s, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ background: "#050512", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={sceneIndex} accentColor={color} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 90% 70% at 50% 50%, ${color}18 0%, transparent 70%)` }} />

      {/* Decorative ring */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 500, height: 500, borderRadius: "50%",
        border: `2px solid ${color}30`,
        transform: `translate(-50%, -50%) scale(${ring})`,
      }} />
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        width: 360, height: 360, borderRadius: "50%",
        border: `1px solid ${color}20`,
        transform: `translate(-50%, -50%) scale(${ring})`,
      }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
        <p style={{ fontFamily: MONTSERRAT, fontSize: 22, fontWeight: 600, color: `${color}cc`, letterSpacing: 5, textTransform: "uppercase", marginBottom: 12, textAlign: "center" }}>
          {label}
        </p>

        <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
          <h1 style={{ fontFamily: BEBAS, fontSize: 180, color: color, lineHeight: 0.9, letterSpacing: -2, textShadow: `0 0 ${glow}px ${color}80` }}>
            {value}
          </h1>
        </div>

        {subtext && (
          <p style={{ fontFamily: MONTSERRAT, fontSize: 30, fontWeight: 400, color: "#8080b0", textAlign: "center", lineHeight: 1.4, marginTop: 16, maxWidth: 700 }}>
            {subtext}
          </p>
        )}

        {/* Bottom accent bar */}
        <div style={{ marginTop: 48, height: 4, width: interpolate(frame, [20, 50], [0, 320], { extrapolateRight: "clamp" }), background: `linear-gradient(90deg, ${color}, ${accent})`, borderRadius: 2 }} />
      </div>
    </AbsoluteFill>
  );
}

function ProofScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const accent  = data.brandColors.accent;
  const features = data.featureCallouts.features.slice(0, 4);
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#04040f", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={3} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 100% 40% at 50% 0%, ${primary}15 0%, transparent 60%)` }} />

      <div style={{ position: "absolute", top: 200, left: 0, right: 0, padding: "0 72px" }}>
        <p style={{ fontFamily: BEBAS, fontSize: 28, color: primary, letterSpacing: 6, marginBottom: 48 }}>WHY IT MATTERS</p>

        {features.map((feat, i) => {
          const s = spr(frame, i * 15);
          const x = interpolate(s, [0, 1], [-180, 0]);
          const op = interpolate(frame, [i * 15, i * 15 + 12], [0, 1], { extrapolateRight: "clamp" });

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 36, transform: `translateX(${x}px)`, opacity: op }}>
              <div style={{ width: 8, height: 60, borderRadius: 4, background: i % 2 === 0 ? primary : accent, flexShrink: 0 }} />
              <p style={{ fontFamily: MONTSERRAT, fontSize: 36, fontWeight: 700, color: "#e0e0ff", lineHeight: 1.2 }}>{feat.text}</p>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function CtaScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const pulse   = interpolate(frame % 30, [0, 15, 30], [1, 1.04, 1]);
  const bigNum  = data.socialProofCta.socialProofNumber
    ? easeCount(frame, 0, data.socialProofCta.socialProofNumber, CTA_DUR * 0.7)
    : null;

  return (
    <AbsoluteFill style={{ background: "#030308", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={4} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${primary}20 0%, transparent 70%)` }} />

      <div style={{ textAlign: "center", padding: "0 80px" }}>
        {bigNum !== null && (
          <>
            <p style={{ fontFamily: BEBAS, fontSize: 160, color: primary, lineHeight: 0.9, letterSpacing: -2, textShadow: `0 0 60px ${primary}60` }}>
              {bigNum.toLocaleString()}+
            </p>
            <p style={{ fontFamily: MONTSERRAT, fontSize: 28, fontWeight: 600, color: "#8080b0", marginBottom: 48 }}>
              {data.socialProofCta.socialProofLabel || "people already know this"}
            </p>
          </>
        )}

        <div style={{ transform: `scale(${pulse})` }}>
          <div style={{ display: "inline-block", padding: "24px 72px", borderRadius: 16, background: `linear-gradient(135deg, ${primary}, #4f46e5)`, boxShadow: `0 8px 40px ${primary}60` }}>
            <p style={{ fontFamily: BEBAS, fontSize: 40, color: "#fff", letterSpacing: 2 }}>{data.socialProofCta.ctaUrl}</p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Main ──────────────────────────────────────────────────────

export function StatsStoryVideo({ data }: { data: ProductVideoData | null }) {
  if (!data) return <AbsoluteFill style={{ background: "#030308" }} />;

  const mainStat   = data.simulatedDemo?.resultText  || "87%";
  const statLabel  = data.simulatedDemo?.typedText    || "of people don't know this";
  const statSub    = data.simulatedDemo?.resultSubtext || data.productIntro.tagline;
  const secondStat = data.socialProofCta.socialProofNumber
    ? `${(data.socialProofCta.socialProofNumber / 1000).toFixed(0)}K+`
    : "3X";
  const secondLabel = data.socialProofCta.socialProofLabel || "better results";
  const bg: Backgrounds = { videos: data.backgrounds?.videos, photos: data.backgrounds?.photos };

  return (
    <AbsoluteFill>
      <Sequence from={HOOK_START}  durationInFrames={HOOK_DUR}>  <HookScene data={data} bg={bg} /></Sequence>
      <Sequence from={STAT1_START} durationInFrames={STAT1_DUR}>
        <BigStatScene label={statLabel} value={mainStat} subtext={statSub} color={data.brandColors.primary} accent={data.brandColors.accent} bg={bg} sceneIndex={1} />
      </Sequence>
      <Sequence from={STAT2_START} durationInFrames={STAT2_DUR}>
        <BigStatScene label={secondLabel} value={secondStat} color={data.brandColors.accent} accent={data.brandColors.primary} bg={bg} sceneIndex={2} />
      </Sequence>
      <Sequence from={PROOF_START} durationInFrames={PROOF_DUR}><ProofScene data={data} bg={bg} /></Sequence>
      <Sequence from={CTA_START}   durationInFrames={CTA_DUR}>  <CtaScene   data={data} bg={bg} /></Sequence>
    </AbsoluteFill>
  );
}
