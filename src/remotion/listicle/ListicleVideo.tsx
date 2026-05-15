/**
 * LISTICLE TEMPLATE — Numbered reveal list format
 * Best for: "5 reasons why X", "Top 7 ways to Y", educational breakdowns
 * Font: Oswald (bold condensed impact)
 * Style: Dark navy bg, indigo accents, items stagger in from right
 */

import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import type { ProductVideoData } from "../types";
import { OSWALD, SPACE_GROTESK } from "../fonts";
import { SceneBackground } from "../components/SceneBackground";

type Backgrounds = { videos?: string[]; photos?: string[] };

export const listicleSchema = z.object({ data: z.any() });

// ── Timing ────────────────────────────────────────────────────
export const LIST_FPS    = 30;
export const LIST_W      = 1080;
export const LIST_H      = 1920;
const S = (s: number) => Math.round(s * LIST_FPS);

const HOOK_START   = 0;
const HOOK_DUR     = S(2.5);
const INTRO_START  = HOOK_DUR;
const INTRO_DUR    = S(2);
const ITEMS_START  = INTRO_START + INTRO_DUR;
const ITEMS_DUR    = S(6);
const RECAP_START  = ITEMS_START + ITEMS_DUR;
const RECAP_DUR    = S(2);
const CTA_START    = RECAP_START + RECAP_DUR;
const CTA_DUR      = S(2.5);
export const LIST_TOTAL = CTA_START + CTA_DUR; // 450f = 15s

// ── Helpers ───────────────────────────────────────────────────

const cfg = () => ({ fps: LIST_FPS, durationInFrames: LIST_TOTAL, width: LIST_W, height: LIST_H });

function spr(frame: number, delay = 0) {
  return spring({ frame: frame - delay, fps: LIST_FPS, config: { damping: 14, stiffness: 160, mass: 0.9 } });
}

function fadeIn(frame: number, start = 0, len = 15) {
  return interpolate(frame, [start, start + len], [0, 1], { extrapolateRight: "clamp" });
}

function slideRight(frame: number, delay = 0) {
  const s = spr(frame, delay);
  return interpolate(s, [0, 1], [120, 0]);
}

// ── Scenes ────────────────────────────────────────────────────

function HookScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame = useCurrentFrame();
  const primary = data.brandColors.primary;
  const fadeOut = interpolate(frame, [HOOK_DUR - 20, HOOK_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const scale = interpolate(spr(frame), [0, 1], [1.15, 1]);
  const lineW  = interpolate(frame, [20, 50], [0, 340], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#060614", display: "flex", alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={0} accentColor={primary} />
      {/* BG radial glow */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 50%, ${primary}22 0%, transparent 70%)` }} />

      <div style={{ textAlign: "center", padding: "0 80px", transform: `scale(${scale})` }}>
        <p style={{ fontFamily: OSWALD, fontSize: 26, fontWeight: 400, color: primary, letterSpacing: 6, textTransform: "uppercase", marginBottom: 24 }}>
          Did you know?
        </p>
        <h1 style={{ fontFamily: OSWALD, fontSize: 88, fontWeight: 700, color: "#fff", lineHeight: 1.05, textTransform: "uppercase", letterSpacing: -1 }}>
          {data.hook.painPointQuestion}
        </h1>
        <div style={{ margin: "32px auto 0", height: 4, width: lineW, background: `linear-gradient(90deg, ${primary}, #818cf8)`, borderRadius: 2 }} />
      </div>
    </AbsoluteFill>
  );
}

function IntroScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame = useCurrentFrame();
  const primary = data.brandColors.primary;
  const accent  = data.brandColors.accent;

  const titleY  = interpolate(spr(frame, 5), [0, 1], [60, 0]);
  const subY    = interpolate(spr(frame, 15), [0, 1], [40, 0]);
  const opacity = fadeIn(frame, 0, 12);
  const lineW   = interpolate(frame, [20, 55], [0, 200], { extrapolateRight: "clamp" });

  const itemCount = data.featureCallouts.features.length;

  return (
    <AbsoluteFill style={{ background: "#080820", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={1} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 30%, ${primary}18 0%, transparent 65%)` }} />

      <div style={{ position: "absolute", top: 220, left: 0, right: 0, padding: "0 80px" }}>
        <p style={{ fontFamily: SPACE_GROTESK, fontSize: 22, fontWeight: 600, color: accent, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16, transform: `translateY(${subY}px)` }}>
          Today&apos;s breakdown
        </p>
        <h1 style={{ fontFamily: OSWALD, fontSize: 96, fontWeight: 700, color: "#fff", textTransform: "uppercase", lineHeight: 1, letterSpacing: -1, transform: `translateY(${titleY}px)` }}>
          {data.productIntro.productName || data.hook.painPointQuestion.split(" ").slice(0, 4).join(" ")}
        </h1>
        <div style={{ marginTop: 28, height: 5, width: lineW, background: `linear-gradient(90deg, ${primary}, ${accent})`, borderRadius: 3 }} />
        <p style={{ fontFamily: SPACE_GROTESK, fontSize: 32, fontWeight: 400, color: "#a8a8d8", marginTop: 24, lineHeight: 1.4 }}>
          {data.productIntro.tagline}
        </p>

        <div style={{ marginTop: 60, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${primary}33`, border: `2px solid ${primary}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: OSWALD, fontSize: 22, fontWeight: 700, color: primary }}>{itemCount}</span>
          </div>
          <span style={{ fontFamily: SPACE_GROTESK, fontSize: 22, color: "#7070a0" }}>things you need to know</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function ItemsScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const accent  = data.brandColors.accent;
  const features = data.featureCallouts.features.slice(0, 5);

  const ITEM_DELAY = 18;
  const opacity = fadeIn(frame, 0, 10);

  return (
    <AbsoluteFill style={{ background: "#07071a", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={2} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 90% 40% at 50% 0%, ${primary}10 0%, transparent 60%)` }} />

      <div style={{ position: "absolute", top: 180, left: 0, right: 0, padding: "0 72px" }}>
        <p style={{ fontFamily: OSWALD, fontSize: 24, fontWeight: 400, color: primary, letterSpacing: 5, textTransform: "uppercase", marginBottom: 48 }}>
          {data.featureCallouts.featureTitle || "Key Points"}
        </p>

        {features.map((feat, i) => {
          const delay = i * ITEM_DELAY;
          const s = spr(frame, delay);
          const x = interpolate(s, [0, 1], [220, 0]);
          const op = interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" });
          const numScale = interpolate(s, [0, 1], [0.4, 1]);

          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 28, marginBottom: 42, transform: `translateX(${x}px)`, opacity: op }}>
              {/* Number badge */}
              <div style={{
                flexShrink: 0, width: 72, height: 72, borderRadius: 16,
                background: i % 2 === 0 ? `linear-gradient(135deg, ${primary}, #4f46e5)` : `linear-gradient(135deg, #7c3aed, ${accent})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 20px ${primary}40`,
                transform: `scale(${numScale})`,
              }}>
                <span style={{ fontFamily: OSWALD, fontSize: 36, fontWeight: 700, color: "#fff" }}>{i + 1}</span>
              </div>
              {/* Text */}
              <div style={{ paddingTop: 8 }}>
                <p style={{ fontFamily: OSWALD, fontSize: 52, fontWeight: 700, color: "#fff", lineHeight: 1.1, textTransform: "uppercase", letterSpacing: -0.5 }}>
                  {feat.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

function RecapScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const fadeOut = interpolate(frame, [RECAP_DUR - 15, RECAP_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale   = interpolate(spr(frame), [0, 1], [0.9, 1]);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, #0a0a2e 0%, #06060f 60%)`, display: "flex", alignItems: "center", justifyContent: "center", opacity: fadeOut }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={3} accentColor={primary} />
      <div style={{ textAlign: "center", padding: "0 80px", transform: `scale(${scale})` }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${primary}, #818cf8)`, margin: "0 auto 32px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px ${primary}60` }}>
          <span style={{ fontSize: 40 }}>💡</span>
        </div>
        <h2 style={{ fontFamily: OSWALD, fontSize: 72, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: -1, lineHeight: 1 }}>
          Now you know
        </h2>
        <p style={{ fontFamily: SPACE_GROTESK, fontSize: 30, color: "#8080b0", marginTop: 20, lineHeight: 1.5 }}>
          {data.productIntro.tagline || "Apply these insights today"}
        </p>
      </div>
    </AbsoluteFill>
  );
}

function CtaScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const opacity = fadeIn(frame, 0, 12);
  const pulse   = interpolate(frame % 30, [0, 15, 30], [1, 1.04, 1]);
  const ctaY    = interpolate(spr(frame, 10), [0, 1], [50, 0]);

  return (
    <AbsoluteFill style={{ background: "#050510", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={4} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${primary}20 0%, transparent 70%)` }} />

      <div style={{ textAlign: "center", padding: "0 80px" }}>
        <p style={{ fontFamily: OSWALD, fontSize: 28, fontWeight: 400, color: primary, letterSpacing: 6, textTransform: "uppercase", marginBottom: 20 }}>
          Want more?
        </p>
        <h2 style={{ fontFamily: OSWALD, fontSize: 80, fontWeight: 700, color: "#fff", textTransform: "uppercase", lineHeight: 1.05 }}>
          Follow for daily insights
        </h2>

        <div style={{ marginTop: 56, transform: `translateY(${ctaY}px) scale(${pulse})` }}>
          <div style={{
            display: "inline-block", padding: "22px 64px", borderRadius: 16,
            background: `linear-gradient(135deg, ${primary}, #4f46e5)`,
            boxShadow: `0 8px 32px ${primary}60`,
          }}>
            <span style={{ fontFamily: OSWALD, fontSize: 36, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>
              {data.socialProofCta.ctaUrl}
            </span>
          </div>
        </div>

        {data.socialProofCta.socialProofNumber && (
          <p style={{ fontFamily: SPACE_GROTESK, fontSize: 22, color: "#5050a0", marginTop: 32 }}>
            Join {data.socialProofCta.socialProofNumber.toLocaleString()}+ {data.socialProofCta.socialProofLabel || "people learning daily"}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
}

// ── Main composition ──────────────────────────────────────────

export function ListicleVideo({ data }: { data: ProductVideoData | null }) {
  if (!data) return <AbsoluteFill style={{ background: "#050510" }} />;
  const bg: Backgrounds = { videos: data.backgrounds?.videos, photos: data.backgrounds?.photos };
  return (
    <AbsoluteFill>
      <Sequence from={HOOK_START}  durationInFrames={HOOK_DUR}>   <HookScene  data={data} bg={bg} /></Sequence>
      <Sequence from={INTRO_START} durationInFrames={INTRO_DUR}>  <IntroScene data={data} bg={bg} /></Sequence>
      <Sequence from={ITEMS_START} durationInFrames={ITEMS_DUR}>  <ItemsScene data={data} bg={bg} /></Sequence>
      <Sequence from={RECAP_START} durationInFrames={RECAP_DUR}>  <RecapScene data={data} bg={bg} /></Sequence>
      <Sequence from={CTA_START}   durationInFrames={CTA_DUR}>    <CtaScene   data={data} bg={bg} /></Sequence>
    </AbsoluteFill>
  );
}
