/**
 * QUOTE CARD TEMPLATE — Cinematic word-by-word quote reveal
 * Best for: thought leadership, business wisdom, insight breakdowns, frameworks
 * Font: Playfair Display (serif elegance) + Space Grotesk (modern body)
 * Style: Minimal dark bg, word-by-word reveal, soft glow typography
 */

import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame } from "remotion";
import { z } from "zod";
import type { ProductVideoData } from "../types";
import { PLAYFAIR, SPACE_GROTESK, BEBAS } from "../fonts";
import { SceneBackground } from "../components/SceneBackground";
type Backgrounds = { videos?: string[]; photos?: string[] };

export const quoteCardSchema = z.object({ data: z.any() });

// ── Timing ────────────────────────────────────────────────────
export const QC_FPS   = 30;
export const QC_W     = 1080;
export const QC_H     = 1920;
const S = (s: number) => Math.round(s * QC_FPS);

const TEASER_START   = 0;                                const TEASER_DUR   = S(2);
const REVEAL_START   = TEASER_DUR;                       const REVEAL_DUR   = S(5);
const INSIGHTS_START = REVEAL_START + REVEAL_DUR;        const INSIGHTS_DUR = S(3.5);
const FRAME_START    = INSIGHTS_START + INSIGHTS_DUR;    const FRAME_DUR    = S(2);
const CTA_START      = FRAME_START + FRAME_DUR;          const CTA_DUR      = S(2.5);
export const QC_TOTAL = CTA_START + CTA_DUR; // 450f = 15s

function spr(frame: number, delay = 0, stiffness = 140) {
  return spring({ frame: frame - delay, fps: QC_FPS, config: { damping: 18, stiffness, mass: 1.1 } });
}

// ── Word-by-word reveal ───────────────────────────────────────

function WordReveal({ text, frame, startFrame, color, size, font, weight = 700, letterSpacing = -1 }: {
  text: string; frame: number; startFrame: number;
  color: string; size: number; font: string; weight?: number; letterSpacing?: number;
}) {
  const words = text.split(" ");
  const DELAY = Math.max(6, Math.floor(REVEAL_DUR * 0.7 / words.length));

  return (
    <span style={{ display: "inline" }}>
      {words.map((word, i) => {
        const wordFrame = frame - (startFrame + i * DELAY);
        const op  = interpolate(wordFrame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const y   = interpolate(spr(wordFrame, 0, 200), [0, 1], [20, 0]);
        const blur = interpolate(wordFrame, [0, 12], [8, 0], { extrapolateRight: "clamp" });

        return (
          <span key={i} style={{
            display: "inline-block",
            fontFamily: font, fontSize: size, fontWeight: weight, color,
            letterSpacing, lineHeight: 1.15, opacity: op,
            transform: `translateY(${y}px)`,
            filter: `blur(${blur}px)`,
            marginRight: size * 0.28,
          }}>
            {word}
          </span>
        );
      })}
    </span>
  );
}

// ── Scenes ────────────────────────────────────────────────────

function TeaserScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const fadeOut = interpolate(frame, [TEASER_DUR - 15, TEASER_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const s       = spr(frame, 5);
  const y       = interpolate(s, [0, 1], [60, 0]);

  return (
    <AbsoluteFill style={{ background: "#07070d", opacity: Math.min(opacity, fadeOut) }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={0} accentColor={primary} />
      {/* Subtle top gradient */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 400, background: `linear-gradient(180deg, ${primary}10 0%, transparent 100%)` }} />
      {/* Quote marks bg */}
      <div style={{ position: "absolute", top: 300, left: 60, fontFamily: PLAYFAIR, fontSize: 300, color: `${primary}08`, lineHeight: 1 }}>"</div>

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", transform: `translateY(${y}px)` }}>
        <div style={{ display: "inline-block", background: `${primary}15`, border: `1px solid ${primary}40`, borderRadius: 8, padding: "8px 20px", marginBottom: 24, alignSelf: "flex-start" }}>
          <p style={{ fontFamily: SPACE_GROTESK, fontSize: 16, fontWeight: 700, color: primary, letterSpacing: 5, textTransform: "uppercase" }}>
            {data.productIntro.productName || "Key Insight"}
          </p>
        </div>
        <h1 style={{ fontFamily: PLAYFAIR, fontSize: 72, fontWeight: 700, color: "#fff", lineHeight: 1.2, fontStyle: "italic" }}>
          {data.hook.painPointQuestion}
        </h1>
        <div style={{ marginTop: 32, height: 2, width: interpolate(frame, [10, 40], [0, 180], { extrapolateRight: "clamp" }), background: `linear-gradient(90deg, ${primary}, transparent)`, borderRadius: 1 }} />
      </div>
    </AbsoluteFill>
  );
}

function RevealScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [REVEAL_DUR - 15, REVEAL_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const quoteText = data.productIntro.tagline || data.hook.painPointQuestion;
  const bgGlow    = interpolate(frame, [30, 90], [0, 0.2], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#06060b", opacity: Math.min(opacity, fadeOut) }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={1} accentColor={primary} />
      {/* Giant decorative quote mark */}
      <div style={{ position: "absolute", top: 220, left: 40, fontFamily: PLAYFAIR, fontSize: 280, color: `${primary}${Math.round(bgGlow * 255).toString(16).padStart(2, "0")}`, lineHeight: 1, userSelect: "none" }}>"</div>

      {/* Horizontal rule */}
      <div style={{ position: "absolute", top: 200, left: 72, width: 4, height: interpolate(frame, [5, 35], [0, 80], { extrapolateRight: "clamp" }), background: primary, borderRadius: 2 }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px 0 92px" }}>
        <div style={{ lineHeight: 1.3 }}>
          <WordReveal
            text={quoteText}
            frame={frame}
            startFrame={8}
            color="#f0f0ff"
            size={72}
            font={PLAYFAIR}
            weight={700}
            letterSpacing={-0.5}
          />
        </div>

        {/* Attribution line */}
        <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 16, opacity: interpolate(frame, [REVEAL_DUR * 0.65, REVEAL_DUR * 0.85], [0, 1], { extrapolateRight: "clamp" }) }}>
          <div style={{ width: 40, height: 2, background: primary }} />
          <p style={{ fontFamily: SPACE_GROTESK, fontSize: 22, fontWeight: 600, color: `${primary}cc`, letterSpacing: 2, textTransform: "uppercase" }}>
            {data.productIntro.productName || "Ottoflow Insights"}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function InsightsScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame    = useCurrentFrame();
  const primary  = data.brandColors.primary;
  const accent   = data.brandColors.accent;
  const features = data.featureCallouts.features.slice(0, 3);
  const opacity  = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#06060c", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={2} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 100% 35% at 50% 0%, ${primary}12 0%, transparent 55%)` }} />

      <div style={{ position: "absolute", top: 200, left: 0, right: 0, padding: "0 80px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 56 }}>
          <div style={{ width: 6, height: 48, background: `linear-gradient(180deg, ${primary}, ${accent})`, borderRadius: 3 }} />
          <p style={{ fontFamily: SPACE_GROTESK, fontSize: 22, fontWeight: 700, color: `${primary}cc`, letterSpacing: 4, textTransform: "uppercase" }}>
            {data.featureCallouts.featureTitle || "What this means"}
          </p>
        </div>

        {features.map((feat, i) => {
          const delay = i * 20;
          const s   = spr(frame, delay);
          const y   = interpolate(s, [0, 1], [50, 0]);
          const op  = interpolate(frame, [delay, delay + 14], [0, 1], { extrapolateRight: "clamp" });
          const col = i === 0 ? primary : i === 1 ? accent : "#818cf8";

          return (
            <div key={i} style={{ display: "flex", gap: 24, marginBottom: 56, opacity: op, transform: `translateY(${y}px)` }}>
              <div style={{ paddingTop: 6, flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: col, boxShadow: `0 0 16px ${col}80` }} />
              </div>
              <div>
                <p style={{ fontFamily: PLAYFAIR, fontSize: 50, fontWeight: 700, color: "#e8e8ff", lineHeight: 1.2, fontStyle: i === 1 ? "italic" : "normal" }}>
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

function FrameScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const s       = spr(frame, 5);
  const scale   = interpolate(s, [0, 1], [0.88, 1]);
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [FRAME_DUR - 12, FRAME_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#05050a", display: "flex", alignItems: "center", justifyContent: "center", opacity: Math.min(opacity, fadeOut) }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={3} accentColor={primary} />
      <div style={{ transform: `scale(${scale})`, textAlign: "center", padding: "0 80px" }}>
        {/* Decorative frame border */}
        <div style={{ border: `1px solid ${primary}30`, borderRadius: 24, padding: "56px 64px", position: "relative" }}>
          <div style={{ position: "absolute", top: -2, left: "10%", right: "10%", height: 4, background: `linear-gradient(90deg, transparent, ${primary}, transparent)`, borderRadius: 2 }} />
          <div style={{ position: "absolute", bottom: -2, left: "10%", right: "10%", height: 4, background: `linear-gradient(90deg, transparent, ${primary}60, transparent)`, borderRadius: 2 }} />

          <p style={{ fontFamily: PLAYFAIR, fontSize: 32, fontStyle: "italic", color: `${primary}cc`, marginBottom: 24 }}>
            Remember this:
          </p>
          <p style={{ fontFamily: PLAYFAIR, fontSize: 58, fontWeight: 700, color: "#f0f0ff", lineHeight: 1.3 }}>
            {data.productIntro.tagline || data.hook.painPointQuestion}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function CtaScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const pulse   = interpolate(frame % 30, [0, 15, 30], [1, 1.03, 1]);
  const ctaY    = interpolate(spr(frame, 8), [0, 1], [60, 0]);

  return (
    <AbsoluteFill style={{ background: "#06060c", display: "flex", alignItems: "center", justifyContent: "center", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={4} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${primary}15 0%, transparent 70%)` }} />

      <div style={{ textAlign: "center", padding: "0 80px" }}>
        {/* Big quote mark */}
        <p style={{ fontFamily: PLAYFAIR, fontSize: 120, color: `${primary}40`, lineHeight: 0.8, marginBottom: -20 }}>"</p>
        <h2 style={{ fontFamily: PLAYFAIR, fontSize: 68, fontWeight: 700, color: "#fff", lineHeight: 1.2, fontStyle: "italic" }}>
          More insights daily. Follow for wisdom.
        </h2>

        <div style={{ marginTop: 52, transform: `translateY(${ctaY}px) scale(${pulse})` }}>
          <div style={{ display: "inline-block", padding: "20px 60px", borderRadius: 16, background: `linear-gradient(135deg, ${primary}, #4f46e5)`, boxShadow: `0 8px 40px ${primary}60` }}>
            <p style={{ fontFamily: BEBAS, fontSize: 36, color: "#fff", letterSpacing: 2 }}>
              {data.socialProofCta.ctaUrl}
            </p>
          </div>
        </div>

        {data.socialProofCta.socialProofNumber && (
          <p style={{ fontFamily: SPACE_GROTESK, fontSize: 22, color: "#5050a0", marginTop: 28 }}>
            {data.socialProofCta.socialProofNumber.toLocaleString()}+ subscribers already learning
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
}

// ── Main ──────────────────────────────────────────────────────

export function QuoteCardVideo({ data }: { data: ProductVideoData | null }) {
  if (!data) return <AbsoluteFill style={{ background: "#06060c" }} />;
  const bg: Backgrounds = { videos: data.backgrounds?.videos, photos: data.backgrounds?.photos };
  return (
    <AbsoluteFill>
      <Sequence from={TEASER_START}   durationInFrames={TEASER_DUR}>   <TeaserScene   data={data} bg={bg} /></Sequence>
      <Sequence from={REVEAL_START}   durationInFrames={REVEAL_DUR}>   <RevealScene   data={data} bg={bg} /></Sequence>
      <Sequence from={INSIGHTS_START} durationInFrames={INSIGHTS_DUR}><InsightsScene  data={data} bg={bg} /></Sequence>
      <Sequence from={FRAME_START}    durationInFrames={FRAME_DUR}>    <FrameScene    data={data} bg={bg} /></Sequence>
      <Sequence from={CTA_START}      durationInFrames={CTA_DUR}>      <CtaScene      data={data} bg={bg} /></Sequence>
    </AbsoluteFill>
  );
}
