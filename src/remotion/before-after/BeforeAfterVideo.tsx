/**
 * BEFOREAFTER VIDEO — Main Composition
 * BeforeAfter video template
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { z } from "zod";
import { ProductVideoDataSchema } from "../types";
import type { ProductVideoData } from "../types";
import { BEF_SCENE_FRAMES } from "./types";

import { Bef1_Hook } from "./scenes/Bef1_Hook";
import { Bef2_ProductA } from "./scenes/Bef2_ProductA";
import { Bef3_ProductB } from "./scenes/Bef3_ProductB";
import { Bef4_Comparison } from "./scenes/Bef4_Comparison";
import { Bef5_Winner } from "./scenes/Bef5_Winner";
import { Bef6_CTA } from "./scenes/Bef6_CTA";

export const beforeafterSchema = z.object({
  data: ProductVideoDataSchema.nullable(),
});

export const BeforeAfterVideo: React.FC<z.infer<typeof beforeafterSchema>> = ({ data }) => {
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

  // Pexels backgrounds
  const bgPhotos = data.backgrounds?.photos || [];
  const bgHook = bgPhotos[0] || undefined;
  const bgCta = bgPhotos[1] || bgPhotos[0] || undefined;

  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: data.brandColors.background }}>
      <Sequence from={offset} durationInFrames={BEF_SCENE_FRAMES.scene1_hook}>
        <Bef1_Hook text={data.hook.painPointQuestion} colors={data.brandColors} backgroundSrc={bgHook} />
      </Sequence>
      {(offset += BEF_SCENE_FRAMES.scene1_hook) && null}

      <Sequence from={offset} durationInFrames={BEF_SCENE_FRAMES.scene2_productA}>
        <Bef2_ProductA imagePath={heroImagePath} title={data.productIntro.productName} subtitle={data.productIntro.tagline} colors={data.brandColors} />
      </Sequence>
      {(offset += BEF_SCENE_FRAMES.scene2_productA) && null}

      <Sequence from={offset} durationInFrames={BEF_SCENE_FRAMES.scene3_productB}>
        <Bef3_ProductB imagePath={heroImagePath} title={data.productIntro.productName} subtitle={data.productIntro.tagline} colors={data.brandColors} />
      </Sequence>
      {(offset += BEF_SCENE_FRAMES.scene3_productB) && null}

      <Sequence from={offset} durationInFrames={BEF_SCENE_FRAMES.scene4_comparison}>
        <Bef4_Comparison colors={data.brandColors} />
      </Sequence>
      {(offset += BEF_SCENE_FRAMES.scene4_comparison) && null}

      <Sequence from={offset} durationInFrames={BEF_SCENE_FRAMES.scene5_winner}>
        <Bef5_Winner features={data.featureCallouts.features} colors={data.brandColors} />
      </Sequence>
      {(offset += BEF_SCENE_FRAMES.scene5_winner) && null}

      <Sequence from={offset} durationInFrames={BEF_SCENE_FRAMES.scene6_cTA}>
        <Bef6_CTA productName={data.productIntro.productName} ctaText={data.socialProofCta.ctaUrl} colors={data.brandColors} backgroundSrc={bgCta} />
      </Sequence>
      {(offset += BEF_SCENE_FRAMES.scene6_cTA) && null}
    </AbsoluteFill>
  );
};
