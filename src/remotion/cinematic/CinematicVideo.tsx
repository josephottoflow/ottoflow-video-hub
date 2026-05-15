/**
 * CINEMATIC VIDEO — Main Remotion Composition
 * Apple-style premium product video with smart animation engine.
 *
 * 6 scenes: Hook → Problem → Hero → Features → Proof → CTA
 * 28s @ 30fps = 840 frames, 1080x1920 portrait.
 *
 * Can accept either:
 *   A. CinematicVideoProps directly (new format)
 *   B. ProductVideoData (legacy format — auto-converted)
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import type { CinematicVideoProps, ThemePreset } from "../engine/types";
import { ProductVideoDataSchema } from "../types";
import type { ProductVideoData } from "../types";
import { SceneRenderer } from "../components/cinematic/SceneRenderer";

// ─── Schema for Remotion ────────────────────────────────────

const cinematicDirectSchema = z.object({
  images: z.array(z.string()),
  headline: z.string(),
  subheadline: z.string(),
  problemText: z.string().optional(),
  bulletPoints: z.array(z.string()),
  cta: z.string(),
  price: z.string().optional(),
  theme: z.enum(["tech", "luxury", "outdoor", "minimal", "bold", "neon"]),
  colorHint: z.string(),
  socialProof: z.object({
    number: z.number(),
    label: z.string(),
  }).optional(),
  backgroundImages: z.array(z.string()).optional(),
  ctaStyle: z.enum(["tiktok-basket", "classic"]).optional(),
});

export const cinematicSchema = z.object({
  data: z.union([cinematicDirectSchema, ProductVideoDataSchema]).nullable(),
});

type CinematicCompositionProps = z.infer<typeof cinematicSchema>;

/**
 * Convert legacy ProductVideoData to CinematicVideoProps
 */
function convertFromLegacy(data: ProductVideoData): CinematicVideoProps {
  // Only treat paths as product images if they are NOT Pexels background photos.
  // Background photos live under /backgrounds/ — they should stay as scene backgrounds,
  // not float as foreground "product images" inside Hero/Angle/Detail scenes.
  const isBackgroundPath = (p: string) => p.includes("/backgrounds/") || p.includes("\\backgrounds\\");

  const realImages = data.imageShowcase.images
    .map((img) => img.path)
    .filter((p) => p && !isBackgroundPath(p));

  if (
    data.featureCallouts.productImagePath &&
    !isBackgroundPath(data.featureCallouts.productImagePath) &&
    !realImages.includes(data.featureCallouts.productImagePath)
  ) {
    realImages.unshift(data.featureCallouts.productImagePath);
  }

  // Detect theme from brand colors
  const primary = data.brandColors.primary.toLowerCase();
  let theme: ThemePreset = "tech";
  if (primary.includes("d4a") || primary.includes("c68")) theme = "luxury";
  else if (primary.includes("22c") || primary.includes("059")) theme = "outdoor";
  else if (primary.includes("ef4") || primary.includes("dc2")) theme = "bold";
  else if (primary.includes("a1a") || primary.includes("71717")) theme = "minimal";

  // Bridge backgrounds: prefer videos first, fill with photos
  // Each scene gets its own unique background for visual variety
  let backgroundImages: string[] | undefined;
  if (data.backgrounds) {
    const videos = data.backgrounds.videos || [];
    const photos = data.backgrounds.photos || [];
    const combined = [...videos, ...photos];
    backgroundImages = combined.length > 0 ? combined : undefined;
  }

  // Feature callout texts — clean up any truncation artifacts
  const bulletPoints = data.featureCallouts.features
    .map((f) => f.text)
    .filter((t) => t && t.trim().length > 3);

  return {
    images: realImages,
    headline: data.productIntro.productName,
    subheadline: data.productIntro.tagline,
    problemText: data.hook.painPointQuestion,
    bulletPoints,
    cta: data.socialProofCta.ctaUrl || "Follow for more",
    theme,
    colorHint: data.brandColors.primary,
    socialProof: data.socialProofCta.socialProofNumber
      ? {
          number: data.socialProofCta.socialProofNumber,
          label: data.socialProofCta.socialProofLabel || "people learned this",
        }
      : undefined,
    backgroundImages,
    featureTitle: data.featureCallouts.featureTitle,
    ctaStyle: "classic" as const,
  };
}

/**
 * Type guard: is this CinematicVideoProps?
 */
function isCinematicProps(data: unknown): data is CinematicVideoProps {
  return typeof data === "object" && data !== null && "images" in data && "theme" in data;
}

export const CinematicVideo: React.FC<CinematicCompositionProps> = ({ data }) => {
  if (!data) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#0B0B0F", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#ffffff", fontSize: 48, fontWeight: 800, fontFamily: "'Inter', sans-serif" }}>
          Loading...
        </div>
      </AbsoluteFill>
    );
  }

  // Convert if legacy format
  const props: CinematicVideoProps = isCinematicProps(data)
    ? data
    : convertFromLegacy(data as ProductVideoData);

  // Educational/explainer content has no product images — that is fine.
  // SceneRenderer handles the zero-images case via text-only Hero + steps Detail.
  return <SceneRenderer props={props} />;
};
