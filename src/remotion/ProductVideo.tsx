/**
 * PRODUCT VIDEO — Main Composition
 * Sequences all 6 scenes with Remotion's <Sequence> component.
 * Each scene is data-driven from ProductVideoData props.
 * 25 seconds total @ 30fps = 750 frames.
 */

import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { z } from "zod";
import {
  ProductVideoDataSchema,
  FPS,
  SCENE_DURATIONS,
} from "./types";
import {
  HookSceneComponent,
  ProductIntroSceneComponent,
  SimulatedDemoSceneComponent,
  ImageShowcaseSceneComponent,
  FeatureCalloutsSceneComponent,
  SocialProofCtaSceneComponent,
} from "./scenes";

export const productVideoSchema = z.object({
  data: ProductVideoDataSchema.nullable(),
});

export const ProductVideo: React.FC<z.infer<typeof productVideoSchema>> = ({
  data,
}) => {
  if (!data) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a", justifyContent: "center", alignItems: "center" }}>
        <div style={{ color: "#fff", fontSize: 48, fontWeight: "bold" }}>Loading...</div>
      </AbsoluteFill>
    );
  }

  const hookFrames = SCENE_DURATIONS.hook * FPS;
  const introFrames = SCENE_DURATIONS.productIntro * FPS;
  const demoFrames = SCENE_DURATIONS.simulatedDemo * FPS;
  const showcaseFrames = SCENE_DURATIONS.imageShowcase * FPS;
  const calloutsFrames = SCENE_DURATIONS.featureCallouts * FPS;
  const ctaFrames = SCENE_DURATIONS.socialProofCta * FPS;

  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <Sequence from={offset} durationInFrames={hookFrames}>
        <HookSceneComponent data={data.hook} colors={data.brandColors} />
      </Sequence>
      {(offset += hookFrames) && null}

      <Sequence from={offset} durationInFrames={introFrames}>
        <ProductIntroSceneComponent data={data.productIntro} colors={data.brandColors} />
      </Sequence>
      {(offset += introFrames) && null}

      <Sequence from={offset} durationInFrames={demoFrames}>
        <SimulatedDemoSceneComponent data={data.simulatedDemo} colors={data.brandColors} />
      </Sequence>
      {(offset += demoFrames) && null}

      <Sequence from={offset} durationInFrames={showcaseFrames}>
        <ImageShowcaseSceneComponent data={data.imageShowcase} colors={data.brandColors} />
      </Sequence>
      {(offset += showcaseFrames) && null}

      <Sequence from={offset} durationInFrames={calloutsFrames}>
        <FeatureCalloutsSceneComponent data={data.featureCallouts} colors={data.brandColors} />
      </Sequence>
      {(offset += calloutsFrames) && null}

      <Sequence from={offset} durationInFrames={ctaFrames}>
        <SocialProofCtaSceneComponent data={data.socialProofCta} colors={data.brandColors} />
      </Sequence>

      {data.narrationAudioPath && (
        <Sequence from={0}>
          <Audio src={staticFile(data.narrationAudioPath)} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
