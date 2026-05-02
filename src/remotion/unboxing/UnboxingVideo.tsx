/**
 * UNBOXING VIDEO — Main Composition
 * 7-scene product unboxing/reveal template.
 * 32.5s @ 30fps = 975 frames, 1080x1920 portrait.
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { z } from "zod";
import { ProductVideoDataSchema } from "../types";
import type { ProductVideoData } from "../types";
import { UNB_SCENE_FRAMES } from "./types";

import { Unb1_TextHook } from "./scenes/Unb1_TextHook";
import { Unb2_PackageReveal } from "./scenes/Unb2_PackageReveal";
import { Unb3_Unboxing } from "./scenes/Unb3_Unboxing";
import { Unb4_ProductShowcase } from "./scenes/Unb4_ProductShowcase";
import { Unb5_Features } from "./scenes/Unb5_Features";
import { Unb6_SocialProof } from "./scenes/Unb6_SocialProof";
import { Unb7_CTA } from "./scenes/Unb7_CTA";

export const unboxingSchema = z.object({
  data: ProductVideoDataSchema.nullable(),
});

export const UnboxingVideo: React.FC<z.infer<typeof unboxingSchema>> = ({ data }) => {
  if (!data) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#fff", fontSize: 48, fontWeight: "bold" }}>Loading...</div>
      </AbsoluteFill>
    );
  }

  const heroImagePath = data.imageShowcase.images.length > 0
    ? data.imageShowcase.images[0].path
    : data.featureCallouts.productImagePath;

  // Split images: first half for unboxing steps, second half for showcase
  const midpoint = Math.ceil(data.imageShowcase.images.length / 2);
  const unboxingImages = data.imageShowcase.images.slice(0, midpoint);
  const showcaseImages = data.imageShowcase.images.slice(midpoint);

  const hashtags = data.simulatedDemo.resultSubtext
    ? data.simulatedDemo.resultSubtext.split(/[\s#]+/).filter(Boolean)
    : [];

  // Pexels backgrounds — distribute across key scenes
  const bgPhotos = data.backgrounds?.photos || [];
  const bgHook = bgPhotos[0] || undefined;
  const bgFeatures = bgPhotos[1] || undefined;
  const bgCta = bgPhotos[2] || bgPhotos[0] || undefined;

  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: data.brandColors.background }}>
      <Sequence from={offset} durationInFrames={UNB_SCENE_FRAMES.scene1_textHook}>
        <Unb1_TextHook text={data.hook.painPointQuestion} colors={data.brandColors} backgroundSrc={bgHook} />
      </Sequence>
      {(offset += UNB_SCENE_FRAMES.scene1_textHook) && null}

      <Sequence from={offset} durationInFrames={UNB_SCENE_FRAMES.scene2_packageReveal}>
        <Unb2_PackageReveal imagePath={heroImagePath} productName={data.productIntro.productName} colors={data.brandColors} />
      </Sequence>
      {(offset += UNB_SCENE_FRAMES.scene2_packageReveal) && null}

      <Sequence from={offset} durationInFrames={UNB_SCENE_FRAMES.scene3_unboxing}>
        <Unb3_Unboxing images={unboxingImages.length ? unboxingImages : data.imageShowcase.images} colors={data.brandColors} />
      </Sequence>
      {(offset += UNB_SCENE_FRAMES.scene3_unboxing) && null}

      <Sequence from={offset} durationInFrames={UNB_SCENE_FRAMES.scene4_productShowcase}>
        <Unb4_ProductShowcase images={showcaseImages.length ? showcaseImages : data.imageShowcase.images} colors={data.brandColors} />
      </Sequence>
      {(offset += UNB_SCENE_FRAMES.scene4_productShowcase) && null}

      <Sequence from={offset} durationInFrames={UNB_SCENE_FRAMES.scene5_features}>
        <Unb5_Features features={data.featureCallouts.features} colors={data.brandColors} backgroundSrc={bgFeatures} />
      </Sequence>
      {(offset += UNB_SCENE_FRAMES.scene5_features) && null}

      <Sequence from={offset} durationInFrames={UNB_SCENE_FRAMES.scene6_socialProof}>
        <Unb6_SocialProof number={data.socialProofCta.socialProofNumber ?? 10000} label={data.socialProofCta.socialProofLabel ?? "happy customers"} colors={data.brandColors} />
      </Sequence>
      {(offset += UNB_SCENE_FRAMES.scene6_socialProof) && null}

      <Sequence from={offset} durationInFrames={UNB_SCENE_FRAMES.scene7_cta}>
        <Unb7_CTA productName={data.productIntro.productName} ctaText={data.socialProofCta.ctaUrl} hashtags={hashtags} colors={data.brandColors} backgroundSrc={bgCta} />
      </Sequence>
    </AbsoluteFill>
  );
};
