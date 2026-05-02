/**
 * DEMO VIDEO — Main Composition
 * ClaudeVideoExport.com product demo
 * 7 scenes, ~33.5s @ 30fps = 1005 frames
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { SCENE_FRAMES, BRAND } from "./types";
import { Scene1_TextHook } from "./scenes/Scene1_TextHook";
import { Scene2_ClaudeDesign } from "./scenes/Scene2_ClaudeDesign";
import { Scene3_ExportForm } from "./scenes/Scene3_ExportForm";
import { Scene4_Progress } from "./scenes/Scene4_Progress";
import { Scene5_FileDownload } from "./scenes/Scene5_FileDownload";
import { Scene6_SocialUpload } from "./scenes/Scene6_SocialUpload";
import { Scene7_CTA } from "./scenes/Scene7_CTA";

export const DemoVideo: React.FC = () => {
  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.bg }}>
      <Sequence from={offset} durationInFrames={SCENE_FRAMES.scene1}>
        <Scene1_TextHook />
      </Sequence>
      {(offset += SCENE_FRAMES.scene1) && null}

      <Sequence from={offset} durationInFrames={SCENE_FRAMES.scene2}>
        <Scene2_ClaudeDesign />
      </Sequence>
      {(offset += SCENE_FRAMES.scene2) && null}

      <Sequence from={offset} durationInFrames={SCENE_FRAMES.scene3}>
        <Scene3_ExportForm />
      </Sequence>
      {(offset += SCENE_FRAMES.scene3) && null}

      <Sequence from={offset} durationInFrames={SCENE_FRAMES.scene4}>
        <Scene4_Progress />
      </Sequence>
      {(offset += SCENE_FRAMES.scene4) && null}

      <Sequence from={offset} durationInFrames={SCENE_FRAMES.scene5}>
        <Scene5_FileDownload />
      </Sequence>
      {(offset += SCENE_FRAMES.scene5) && null}

      <Sequence from={offset} durationInFrames={SCENE_FRAMES.scene6}>
        <Scene6_SocialUpload />
      </Sequence>
      {(offset += SCENE_FRAMES.scene6) && null}

      <Sequence from={offset} durationInFrames={SCENE_FRAMES.scene7}>
        <Scene7_CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
