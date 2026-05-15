// v2 — V2 UGC video: 3-scene Veo-animated (or AI-image fallback) cinematic, 450f = 15s

import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { V2Scene } from "./V2Scene";
import { V2_SCENES } from "./types";
import { resolveImage } from "../engine/resolveImage";
import type { V2UGCProps } from "./types";

export const V2UGCVideo: React.FC<V2UGCProps> = ({ data }) => {
  if (!data) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;

  const { scenes, voiceoverUrl } = data;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Hook — 5s (0-149f). Sequence makes frame=0 at the scene start */}
      <Sequence from={V2_SCENES.hook.start} durationInFrames={V2_SCENES.hook.frames}>
        <V2Scene
          imagePath={scenes.hook.imagePath}
          videoClipPath={scenes.hook.videoClipPath}
          caption={scenes.hook.caption}
          keyWord={scenes.hook.keyWord}
          durationFrames={V2_SCENES.hook.frames}
          zoomDirection="in"
        />
      </Sequence>

      {/* Insight — 11s (150-479f) */}
      <Sequence from={V2_SCENES.insight.start} durationInFrames={V2_SCENES.insight.frames}>
        <V2Scene
          imagePath={scenes.insight.imagePath}
          videoClipPath={scenes.insight.videoClipPath}
          caption={scenes.insight.caption}
          keyWord={scenes.insight.keyWord}
          durationFrames={V2_SCENES.insight.frames}
          zoomDirection="pan"
          overlayOpacity={0.5}
        />
      </Sequence>

      {/* CTA — 4s (480-599f) */}
      <Sequence from={V2_SCENES.cta.start} durationInFrames={V2_SCENES.cta.frames}>
        <V2Scene
          imagePath={scenes.cta.imagePath}
          videoClipPath={scenes.cta.videoClipPath}
          caption={scenes.cta.caption}
          keyWord={scenes.cta.keyWord}
          durationFrames={V2_SCENES.cta.frames}
          zoomDirection="out"
          overlayOpacity={0.55}
        />
      </Sequence>

      {/* Voiceover — plays from frame 0 across entire video */}
      {voiceoverUrl && (
        <Audio src={resolveImage(voiceoverUrl)} volume={1} />
      )}
    </AbsoluteFill>
  );
};

export { v2UGCSchema } from "./types";
export type { V2UGCData, V2UGCProps } from "./types";
