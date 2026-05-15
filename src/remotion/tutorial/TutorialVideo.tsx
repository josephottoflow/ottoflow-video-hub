/**
 * TUTORIAL TEMPLATE — Step-by-step how-to format
 * Best for: workflow tutorials, "how to do X in 3 steps", process breakdowns
 * Font: Montserrat (clean, professional, modern)
 * Style: Dark bg with indigo progress bar across top, steps stack in sequentially
 */

import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame } from "remotion";
import { z } from "zod";
import type { ProductVideoData } from "../types";
import { MONTSERRAT, BEBAS } from "../fonts";
import { SceneBackground } from "../components/SceneBackground";
type Backgrounds = { videos?: string[]; photos?: string[] };

export const tutorialSchema = z.object({ data: z.any() });

// ── Timing ────────────────────────────────────────────────────
export const TUT_FPS   = 30;
export const TUT_W     = 1080;
export const TUT_H     = 1920;
const S = (s: number) => Math.round(s * TUT_FPS);

const HOOK_START   = 0;                               const HOOK_DUR   = S(2.5);
const INTRO_START  = HOOK_DUR;                        const INTRO_DUR  = S(1.5);
const STEPS_START  = INTRO_START + INTRO_DUR;         const STEPS_DUR  = S(6);
const RESULT_START = STEPS_START + STEPS_DUR;         const RESULT_DUR = S(2.5);
const CTA_START    = RESULT_START + RESULT_DUR;       const CTA_DUR    = S(2.5);
export const TUT_TOTAL = CTA_START + CTA_DUR; // 450f = 15s

function spr(frame: number, delay = 0, config = { damping: 14, stiffness: 160, mass: 0.9 }) {
  return spring({ frame: frame - delay, fps: TUT_FPS, config });
}

// ── Progress bar component ────────────────────────────────────

function ProgressBar({ progress, color }: { progress: number; color: string }) {
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: `${color}20` }}>
      <div style={{ height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg, ${color}, #818cf8)`, borderRadius: "0 3px 3px 0", boxShadow: `0 0 12px ${color}80`, transition: "width 0.1s" }} />
    </div>
  );
}

// ── Scenes ────────────────────────────────────────────────────

function HookScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const fadeOut = interpolate(frame, [HOOK_DUR - 15, HOOK_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s       = spr(frame, 5);
  const y       = interpolate(s, [0, 1], [80, 0]);
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#080820", opacity: Math.min(opacity, fadeOut) }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={0} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 40%, ${primary}15 0%, transparent 65%)` }} />
      <ProgressBar progress={0.05} color={primary} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
        <div style={{ transform: `translateY(${y}px)`, textAlign: "center" }}>
          <div style={{ display: "inline-block", background: `${primary}20`, border: `1px solid ${primary}40`, borderRadius: 12, padding: "8px 24px", marginBottom: 28 }}>
            <p style={{ fontFamily: MONTSERRAT, fontSize: 18, fontWeight: 700, color: primary, letterSpacing: 4, textTransform: "uppercase" }}>TUTORIAL</p>
          </div>
          <h1 style={{ fontFamily: MONTSERRAT, fontSize: 80, fontWeight: 900, color: "#fff", lineHeight: 1.05, letterSpacing: -2 }}>
            {data.hook.painPointQuestion}
          </h1>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function IntroScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const fadeOut = interpolate(frame, [INTRO_DUR - 12, INTRO_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const s       = spr(frame);
  const scale   = interpolate(s, [0, 1], [0.85, 1]);
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const stepCount = Math.min(data.featureCallouts.features.length, 4);

  return (
    <AbsoluteFill style={{ background: "#07071f", opacity: Math.min(opacity, fadeOut) }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={1} accentColor={primary} />
      <ProgressBar progress={0.2} color={primary} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 80px" }}>
        <div style={{ transform: `scale(${scale})`, textAlign: "center" }}>
          <p style={{ fontFamily: MONTSERRAT, fontSize: 24, fontWeight: 600, color: `${primary}cc`, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>Here&apos;s how</p>
          <h2 style={{ fontFamily: MONTSERRAT, fontSize: 74, fontWeight: 900, color: "#fff", lineHeight: 1.05, letterSpacing: -1.5 }}>
            {data.productIntro.productName || "Master This in"}
          </h2>
          <div style={{ margin: "24px auto", display: "flex", gap: 16, justifyContent: "center" }}>
            {Array.from({ length: stepCount }, (_, i) => (
              <div key={i} style={{ width: 56, height: 56, borderRadius: "50%", border: `2px solid ${primary}60`, display: "flex", alignItems: "center", justifyContent: "center", background: `${primary}15` }}>
                <span style={{ fontFamily: MONTSERRAT, fontSize: 22, fontWeight: 800, color: primary }}>{i + 1}</span>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: MONTSERRAT, fontSize: 28, fontWeight: 400, color: "#7070b0" }}>
            {stepCount} simple steps
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function StepsScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame    = useCurrentFrame();
  const primary  = data.brandColors.primary;
  const accent   = data.brandColors.accent;
  const features = data.featureCallouts.features.slice(0, 4);
  const opacity  = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const progress = interpolate(frame, [0, STEPS_DUR], [0.2, 0.85]);

  const STEP_DELAY = S(1.6);

  return (
    <AbsoluteFill style={{ background: "#060618", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={2} accentColor={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 100% 30% at 50% 0%, ${primary}10 0%, transparent 50%)` }} />
      <ProgressBar progress={progress} color={primary} />

      <div style={{ position: "absolute", top: 120, left: 0, right: 0, padding: "0 72px" }}>
        <p style={{ fontFamily: MONTSERRAT, fontSize: 20, fontWeight: 700, color: `${primary}aa`, letterSpacing: 5, textTransform: "uppercase", marginBottom: 40 }}>
          {data.featureCallouts.featureTitle || "Step by Step"}
        </p>

        {features.map((feat, i) => {
          const stepFrame = frame - i * STEP_DELAY;
          const s   = spr(stepFrame, 0, { damping: 16, stiffness: 140, mass: 1 });
          const op  = interpolate(stepFrame, [0, 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          const y   = interpolate(s, [0, 1], [70, 0]);
          const col = i % 2 === 0 ? primary : accent;

          return (
            <div key={i} style={{ display: "flex", gap: 28, marginBottom: 44, opacity: op, transform: `translateY(${y}px)` }}>
              {/* Step number */}
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 68, height: 68, borderRadius: 18,
                  background: `linear-gradient(135deg, ${col}30, ${col}10)`,
                  border: `2px solid ${col}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 4px 20px ${col}40`,
                }}>
                  <span style={{ fontFamily: BEBAS, fontSize: 36, color: col }}>{i + 1}</span>
                </div>
                {i < features.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 32, background: `linear-gradient(180deg, ${col}60, transparent)`, marginTop: 8 }} />
                )}
              </div>

              {/* Step content */}
              <div style={{ paddingTop: 8, flex: 1 }}>
                <p style={{ fontFamily: MONTSERRAT, fontSize: 46, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: -0.5 }}>
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

function ResultScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const s       = spr(frame, 5);
  const scale   = interpolate(s, [0, 1], [0.8, 1]);
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [RESULT_DUR - 12, RESULT_DUR], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#050515", display: "flex", alignItems: "center", justifyContent: "center", opacity: Math.min(opacity, fadeOut) }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={3} accentColor={primary} />
      <ProgressBar progress={0.9} color={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${primary}20 0%, transparent 70%)` }} />

      <div style={{ textAlign: "center", padding: "0 80px", transform: `scale(${scale})` }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>✅</div>
        <h2 style={{ fontFamily: MONTSERRAT, fontSize: 80, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: -1 }}>
          That&apos;s it!
        </h2>
        <p style={{ fontFamily: MONTSERRAT, fontSize: 34, fontWeight: 400, color: "#8080c0", marginTop: 20, lineHeight: 1.4 }}>
          {data.productIntro.tagline || "Now you know how to do it"}
        </p>
      </div>
    </AbsoluteFill>
  );
}

function CtaScene({ data, bg }: { data: ProductVideoData; bg: Backgrounds }) {
  const frame   = useCurrentFrame();
  const primary = data.brandColors.primary;
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const pulse   = interpolate(frame % 30, [0, 15, 30], [1, 1.04, 1]);
  const ctaY    = interpolate(spr(frame, 8), [0, 1], [60, 0]);

  return (
    <AbsoluteFill style={{ background: "#050515", display: "flex", alignItems: "center", justifyContent: "center", opacity }}>
      <SceneBackground videos={bg.videos} photos={bg.photos} sceneIndex={4} accentColor={primary} />
      <ProgressBar progress={1} color={primary} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${primary}20 0%, transparent 70%)` }} />

      <div style={{ textAlign: "center", padding: "0 80px" }}>
        <p style={{ fontFamily: MONTSERRAT, fontSize: 26, fontWeight: 700, color: `${primary}cc`, letterSpacing: 3, textTransform: "uppercase", marginBottom: 20 }}>
          Want more tutorials?
        </p>
        <h2 style={{ fontFamily: MONTSERRAT, fontSize: 72, fontWeight: 900, color: "#fff", lineHeight: 1.05, letterSpacing: -1 }}>
          Follow for daily how-to guides
        </h2>

        <div style={{ marginTop: 52, transform: `translateY(${ctaY}px) scale(${pulse})` }}>
          <div style={{ display: "inline-block", padding: "22px 64px", borderRadius: 16, background: `linear-gradient(135deg, ${primary}, #4f46e5)`, boxShadow: `0 8px 32px ${primary}60` }}>
            <p style={{ fontFamily: MONTSERRAT, fontSize: 30, fontWeight: 800, color: "#fff" }}>
              {data.socialProofCta.ctaUrl}
            </p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ── Main ──────────────────────────────────────────────────────

export function TutorialVideo({ data }: { data: ProductVideoData | null }) {
  if (!data) return <AbsoluteFill style={{ background: "#060618" }} />;
  const bg: Backgrounds = { videos: data.backgrounds?.videos, photos: data.backgrounds?.photos };
  return (
    <AbsoluteFill>
      <Sequence from={HOOK_START}   durationInFrames={HOOK_DUR}>   <HookScene   data={data} bg={bg} /></Sequence>
      <Sequence from={INTRO_START}  durationInFrames={INTRO_DUR}>  <IntroScene  data={data} bg={bg} /></Sequence>
      <Sequence from={STEPS_START}  durationInFrames={STEPS_DUR}>  <StepsScene  data={data} bg={bg} /></Sequence>
      <Sequence from={RESULT_START} durationInFrames={RESULT_DUR}><ResultScene  data={data} bg={bg} /></Sequence>
      <Sequence from={CTA_START}    durationInFrames={CTA_DUR}>    <CtaScene    data={data} bg={bg} /></Sequence>
    </AbsoluteFill>
  );
}
