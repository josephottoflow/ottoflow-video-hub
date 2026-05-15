/**
 * DETAIL SCENE — Scene 4: Features / Key Points / Stats
 *
 * Three layout modes, auto-selected from featureTitle keywords:
 *   steps   — editorial left-bar reveals (no numbers) — default
 *   stats   — large bold numbers with labels      — "By The Numbers", "Proven Results"
 *   pillars — side-by-side concept cards          — "Core Pillars", "Key Principles"
 *
 * Image carousel mode activates when product images are supplied.
 */
import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { AnimationVariant, LightingConfig, ThemeConfig, SceneTextConfig } from "../../engine/types";
import { LightingOverlay } from "./LightingOverlay";
import { resolveImage } from "../../engine/resolveImage";

interface DetailProps {
  images: { src: string; label?: string }[];
  bulletPoints?: string[];
  featureTitle?: string;
  variant: AnimationVariant;
  lighting: LightingConfig;
  theme: ThemeConfig;
  textConfig?: SceneTextConfig;
}

type LayoutMode = "steps" | "stats" | "pillars";

function detectLayout(title: string, bullets: string[]): LayoutMode {
  const t = title.toLowerCase();
  if (/number|stat|result|proven|data|metric|figure/.test(t)) return "stats";
  if (/pillar|principle|key |core |foundation|secret/.test(t)) return "pillars";
  // Auto-detect from bullet content: numbers/percentages → stats
  if (bullets.filter(b => /\d+%|\d+x|\$\d/.test(b)).length >= 2) return "stats";
  return "steps";
}

// ── Point Card — editorial left-bar reveal, no numbering ───────
const PointCard: React.FC<{
  index: number; text: string; startFrame: number; theme: ThemeConfig; fontSize?: number;
}> = ({ index, text, startFrame, theme, fontSize = 42 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const barS  = spring({ frame: frame - startFrame,      fps, config: { damping: 18, stiffness: 220 } });
  const maskS = spring({ frame: frame - startFrame - 6,  fps, config: { damping: 14, stiffness: 200 } });
  const bgS   = spring({ frame: frame - startFrame,      fps, config: { damping: 20, stiffness: 160 } });

  return (
    <div style={{
      display: "flex", alignItems: "stretch",
      marginBottom: 28,
      opacity: Math.min(1, bgS * 1.5),
      transform: `translateX(${(1 - bgS) * -30}px)`,
    }}>
      {/* Glowing accent bar */}
      <div style={{
        width: 4,
        borderRadius: 4,
        background: `linear-gradient(180deg, ${theme.color}, ${theme.color}40)`,
        boxShadow: `0 0 16px ${theme.color}80, 0 0 6px ${theme.color}`,
        flexShrink: 0,
        transform: `scaleY(${barS})`,
        transformOrigin: "top center",
        marginRight: 24,
      }} />

      {/* Card body */}
      <div style={{
        flex: 1,
        padding: "18px 24px",
        background: `linear-gradient(100deg, ${theme.color}12 0%, ${theme.color}04 60%, transparent 100%)`,
        borderRadius: "0 16px 16px 0",
        clipPath: `inset(0 ${(1 - maskS) * 100}% 0 0 round 0 16px 16px 0)`,
      }}>
        <div style={{
          fontSize,
          fontWeight: 700,
          color: "#ffffff",
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          lineHeight: 1.25,
          letterSpacing: "-0.02em",
          textShadow: "0 2px 16px rgba(0,0,0,0.7)",
        }}>
          {text}
        </div>
      </div>
    </div>
  );
};

// ── Stats Card ────────────────────────────────────────────────
const StatCard: React.FC<{
  text: string; index: number; startFrame: number; theme: ThemeConfig;
}> = ({ text, index, startFrame, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 12, stiffness: 160 } });

  // Split "number + label" heuristic: first token that has digits, rest is label
  const tokens = text.trim().split(/\s+/);
  const numIdx = tokens.findIndex(t => /\d/.test(t));
  const bigNum = numIdx >= 0 ? tokens[numIdx] : "";
  const label  = tokens.filter((_, i) => i !== numIdx).join(" ") || text;

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      opacity: Math.min(1, s * 1.2), transform: `translateY(${(1 - s) * 30}px)`,
      padding: "20px 12px",
      background: `linear-gradient(160deg, ${theme.color}14 0%, transparent 70%)`,
      borderRadius: 20,
      border: `1px solid ${theme.color}30`,
    }}>
      {bigNum && (
        <div style={{
          fontSize: 72, fontWeight: 400, fontFamily: "'Bebas Neue', 'Space Grotesk', sans-serif",
          color: theme.color, lineHeight: 1,
          textShadow: `0 0 30px ${theme.color}60`,
          letterSpacing: "0.04em",
        }}>
          {bigNum}
        </div>
      )}
      <div style={{
        fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.80)",
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        textAlign: "center", lineHeight: 1.25, marginTop: 8,
      }}>
        {label}
      </div>
    </div>
  );
};

// ── Pillar Card ───────────────────────────────────────────────
const PillarCard: React.FC<{
  text: string; index: number; startFrame: number; theme: ThemeConfig;
}> = ({ text, index, startFrame, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - startFrame, fps, config: { damping: 13, stiffness: 200 } });
  const icons = ["◆", "▲", "●", "■"];
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      opacity: Math.min(1, s), transform: `translateY(${(1 - s) * 50}px)`,
      padding: "24px 16px",
      background: `linear-gradient(180deg, ${theme.color}18 0%, ${theme.color}06 100%)`,
      borderRadius: 18,
      border: `1.5px solid ${theme.color}40`,
      margin: "0 8px",
    }}>
      <div style={{
        fontSize: 34, color: theme.color, marginBottom: 12,
        textShadow: `0 0 20px ${theme.color}80`,
      }}>
        {icons[index % icons.length]}
      </div>
      <div style={{
        fontSize: 30, fontWeight: 700, color: "#ffffff",
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        textAlign: "center", lineHeight: 1.3,
        textShadow: "0 2px 10px rgba(0,0,0,0.6)",
      }}>
        {text}
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────
export const Detail: React.FC<DetailProps> = ({
  images, bulletPoints, featureTitle, variant, lighting, theme, textConfig,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const sceneOpacity = interpolate(
    frame, [0, 10, durationInFrames - 10, durationInFrames], [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const hasImages = images.length > 0 && images[0].src.trim().length > 0;

  // ── EXPLAINER MODE (no product images) ──
  if (!hasImages && bulletPoints && bulletPoints.length > 0) {
    const title  = featureTitle || "Key Takeaways";
    const layout = detectLayout(title, bulletPoints);
    const steps  = bulletPoints.slice(0, layout === "pillars" ? 3 : 4);
    const stepInterval = Math.min(70, Math.floor((durationInFrames - 20) / steps.length));

    const headerS = spring({ frame: frame - 6, fps, config: { damping: 14, stiffness: 130 } });

    return (
      <AbsoluteFill style={{ opacity: sceneOpacity }}>
        <LightingOverlay config={lighting} glowCenter="50% 30%" />

        {/* Section header */}
        <div style={{
          position: "absolute", top: 120, left: 56, right: 56,
          opacity: headerS, transform: `translateY(${(1 - headerS) * 20}px)`,
        }}>
          <div style={{
            fontSize: 22, fontWeight: 700, color: theme.color,
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6,
          }}>
            {title}
          </div>
          <div style={{
            width: 48, height: 3, background: theme.color, borderRadius: 2,
            boxShadow: `0 0 12px ${theme.color}60`,
          }} />
        </div>

        {/* STEPS layout — editorial left-bar cards */}
        {layout === "steps" && (
          <div style={{ position: "absolute", top: 210, left: 40, right: 40 }}>
            {steps.map((point, i) => (
              <PointCard
                key={i} index={i} text={point}
                startFrame={20 + i * stepInterval} theme={theme}
                fontSize={textConfig?.body.fontSize ?? 42}
              />
            ))}
          </div>
        )}

        {/* STATS layout */}
        {layout === "stats" && (
          <div style={{
            position: "absolute", top: 200, left: 40, right: 40,
            display: "flex", flexDirection: "column", gap: 20,
          }}>
            {steps.map((point, i) => (
              <StatCard
                key={i} text={point} index={i}
                startFrame={18 + i * stepInterval} theme={theme}
              />
            ))}
          </div>
        )}

        {/* PILLARS layout */}
        {layout === "pillars" && (
          <div style={{
            position: "absolute", top: 210, left: 24, right: 24,
            display: "flex", flexDirection: "row", alignItems: "stretch",
          }}>
            {steps.map((point, i) => (
              <PillarCard
                key={i} text={point} index={i}
                startFrame={16 + i * stepInterval} theme={theme}
              />
            ))}
          </div>
        )}

        <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 30%)", pointerEvents: "none" }} />
      </AbsoluteFill>
    );
  }

  // ── IMAGE CAROUSEL MODE ──
  const imageCount = Math.max(1, images.length);
  const crossfadeDuration = imageCount > 1 ? 15 : 0;
  const framesPerImage = imageCount > 1
    ? Math.floor((durationInFrames + crossfadeDuration * (imageCount - 1)) / imageCount)
    : durationInFrames;

  return (
    <AbsoluteFill style={{ opacity: sceneOpacity }}>
      <LightingOverlay config={lighting} glowCenter="50% 40%" />

      {images.map((img, i) => {
        const startF = i * (framesPerImage - crossfadeDuration);
        const endF   = startF + framesPerImage;
        const localF = frame - startF;

        const imgOpacity = imageCount === 1 ? 1 : interpolate(
          frame,
          [startF, startF + crossfadeDuration, Math.min(endF - crossfadeDuration, durationInFrames), Math.min(endF, durationInFrames)],
          [i === 0 ? 1 : 0, 1, 1, i === imageCount - 1 ? 1 : 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        if (imgOpacity <= 0) return null;

        const zoom  = interpolate(localF, [0, framesPerImage], [variant.zoomFrom, variant.zoomTo], { extrapolateRight: "clamp" });
        const panX  = interpolate(localF, [0, framesPerImage], [0, variant.panDistance * (i % 2 === 0 ? 1 : -1)], { extrapolateRight: "clamp" });
        const panY  = interpolate(localF, [0, framesPerImage], [0, variant.panDistance * 0.5], { extrapolateRight: "clamp" });
        const brite = interpolate(localF, [10, framesPerImage * 0.4], [0.9, 1.1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

        return (
          <AbsoluteFill key={i} style={{ opacity: imgOpacity }}>
            <Img
              src={resolveImage(img.src)}
              style={{
                width: "100%", height: "100%", objectFit: "cover",
                transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
                filter: `brightness(${brite})`,
              }}
            />
            <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 40%, rgba(0,0,0,0.05) 100%)" }} />
          </AbsoluteFill>
        );
      })}

      {/* Bullet points overlay */}
      {bulletPoints && bulletPoints.length > 0 && (
        <div style={{ position: "absolute", bottom: 180, left: 60, right: 60 }}>
          {bulletPoints.slice(0, 3).map((point, i) => {
            const s = spring({ frame: frame - (20 + i * 18), fps, config: { damping: 14, stiffness: 140 } });
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, opacity: s, transform: `translateX(${(1 - s) * 80}px)` }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: theme.color, boxShadow: `0 0 12px ${theme.color}60, 0 0 24px ${theme.color}30`, flexShrink: 0 }} />
                <div style={{
                  fontSize: textConfig?.body.fontSize ?? 26,
                  fontWeight: textConfig?.body.fontWeight ?? 600,
                  color: textConfig?.colors.primary ?? "#ffffff",
                  fontFamily: `'Space Grotesk', '${textConfig?.body.fontFamily ?? "Inter"}', sans-serif`,
                  textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                }}>
                  {point}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AbsoluteFill>
  );
};
