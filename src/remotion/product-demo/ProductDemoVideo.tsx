/**
 * PRODUCT DEMO VIDEO — Main Composition
 * 7-scene product video driven by ProductVideoData from Google Sheet.
 * 33.5s @ 30fps = 1005 frames, 1080x1920 portrait.
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { z } from "zod";
import { ProductVideoDataSchema } from "../types";
import type { ProductVideoData } from "../types";
import { PD_SCENE_FRAMES, PD_COLORS } from "./types";

import { PD1_TextHook } from "./scenes/PD1_TextHook";
import { PD2_OldWay } from "./scenes/PD2_OldWay";
import { PD3_ProductReveal } from "./scenes/PD3_ProductReveal";
import { PD4_ImageGallery } from "./scenes/PD4_ImageGallery";
import { PD5_Features } from "./scenes/PD5_Features";
import { PD6_Social } from "./scenes/PD6_Social";
import { PD7_CTA } from "./scenes/PD7_CTA";

export const productDemoSchema = z.object({
  data: ProductVideoDataSchema.nullable(),
});

export const ProductDemoVideo: React.FC<z.infer<typeof productDemoSchema>> = ({ data }) => {
  if (!data) {
    return (
      <AbsoluteFill style={{ backgroundColor: PD_COLORS.bg, justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#fff", fontSize: 48, fontWeight: "bold" }}>Loading...</div>
      </AbsoluteFill>
    );
  }

  // Extract hashtags from the data
  const hashtags = data.simulatedDemo.resultSubtext
    ? data.simulatedDemo.resultSubtext.split(/[\s#]+/).filter(Boolean)
    : [];

  // Get hero image path
  const heroImagePath = data.imageShowcase.images.length > 0
    ? data.imageShowcase.images[0].path
    : data.featureCallouts.productImagePath;

  // Pexels backgrounds
  const bgPhotos = data.backgrounds?.photos || [];
  const bgHook = bgPhotos[0] || undefined;
  const bgCta = bgPhotos[1] || bgPhotos[0] || undefined;

  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: PD_COLORS.bg }}>
      <Sequence from={offset} durationInFrames={PD_SCENE_FRAMES.scene1_hook}>
        <PD1_TextHook data={data.hook} colors={data.brandColors} backgroundSrc={bgHook} />
      </Sequence>
      {(offset += PD_SCENE_FRAMES.scene1_hook) && null}

      <Sequence from={offset} durationInFrames={PD_SCENE_FRAMES.scene2_oldWay}>
        <PD2_OldWay productName={data.productIntro.productName} colors={data.brandColors} />
      </Sequence>
      {(offset += PD_SCENE_FRAMES.scene2_oldWay) && null}

      <Sequence from={offset} durationInFrames={PD_SCENE_FRAMES.scene3_reveal}>
        <PD3_ProductReveal data={data.productIntro} heroImagePath={heroImagePath} colors={data.brandColors} />
      </Sequence>
      {(offset += PD_SCENE_FRAMES.scene3_reveal) && null}

      <Sequence from={offset} durationInFrames={PD_SCENE_FRAMES.scene4_gallery}>
        <PD4_ImageGallery data={data.imageShowcase} colors={data.brandColors} />
      </Sequence>
      {(offset += PD_SCENE_FRAMES.scene4_gallery) && null}

      <Sequence from={offset} durationInFrames={PD_SCENE_FRAMES.scene5_features}>
        <PD5_Features data={data.featureCallouts} colors={data.brandColors} />
      </Sequence>
      {(offset += PD_SCENE_FRAMES.scene5_features) && null}

      <Sequence from={offset} durationInFrames={PD_SCENE_FRAMES.scene6_social}>
        <PD6_Social data={data.socialProofCta} productName={data.productIntro.productName} colors={data.brandColors} />
      </Sequence>
      {(offset += PD_SCENE_FRAMES.scene6_social) && null}

      <Sequence from={offset} durationInFrames={PD_SCENE_FRAMES.scene7_cta}>
        <PD7_CTA data={data.socialProofCta} productName={data.productIntro.productName} hashtags={hashtags} colors={data.brandColors} backgroundSrc={bgCta} />
      </Sequence>
    </AbsoluteFill>
  );
};
