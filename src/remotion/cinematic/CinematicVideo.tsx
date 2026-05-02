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
  const images = data.imageShowcase.images.map((img) => img.path);

  // Add hero image if not already in the list
  if (data.featureCallouts.productImagePath && !images.includes(data.featureCallouts.productImagePath)) {
    images.unshift(data.featureCallouts.productImagePath);
  }

  // Detect theme from brand colors
  const primary = data.brandColors.primary.toLowerCase();
  let theme: ThemePreset = "tech";
  if (primary.includes("d4a") || primary.includes("c68")) theme = "luxury";
  else if (primary.includes("22c") || primary.includes("059")) theme = "outdoor";
  else if (primary.includes("ef4") || primary.includes("dc2")) theme = "bold";
  else if (primary.includes("a1a") || primary.includes("71717")) theme = "minimal";

  // Bridge backgrounds from pipeline data → cinematic props
  // Pipeline stores { photos: string[], videos: string[] } — prefer videos, fall back to photos
  let backgroundImages: string[] | undefined;
  if (data.backgrounds) {
    const videos = data.backgrounds.videos || [];
    const photos = data.backgrounds.photos || [];
    // Prefer videos for cinematic feel, fill remaining with photos
    backgroundImages = [...videos, ...photos].length > 0
      ? [...videos, ...photos]
      : undefined;
  }

  return {
    images,
    headline: data.productIntro.productName,
    subheadline: data.productIntro.tagline,
    bulletPoints: data.featureCallouts.features.map((f) => f.text),
    cta: data.socialProofCta.ctaUrl || "Shop Now",
    theme,
    colorHint: data.brandColors.primary,
    socialProof: data.socialProofCta.socialProofNumber
      ? {
          number: data.socialProofCta.socialProofNumber,
          label: data.socialProofCta.socialProofLabel || "happy customers",
        }
      : undefined,
    backgroundImages,
    ctaStyle: "tiktok-basket" as const,
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

  // Safety: need at least 1 image
  if (props.images.length === 0) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#0B0B0F", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#ef4444", fontSize: 32, fontWeight: 700, fontFamily: "'Inter', sans-serif" }}>
          No images provided
        </div>
      </AbsoluteFill>
    );
  }

  return <SceneRenderer props={props} />;
};
