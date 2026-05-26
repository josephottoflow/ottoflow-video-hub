// v2 — V2 UGC video: dynamic storyboard renderer (3-5 scenes) + legacy 3-scene fallback

import React from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { V2Scene } from "./V2Scene";
import { V2_SCENES, VISUAL_STYLE_TOKENS } from "./types";
import { resolveImage } from "../engine/resolveImage";
import type { V2UGCProps } from "./types";

export const V2UGCVideo: React.FC<V2UGCProps> = ({ data }) => {
  if (!data) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;

  const { voiceoverUrl } = data;

  // ── Dynamic storyboard path (new) ────────────────────────────
  if (data.storyboard?.scenes?.length) {
    const { storyboard } = data;
    const tokens = VISUAL_STYLE_TOKENS[storyboard.visualStyle] ?? VISUAL_STYLE_TOKENS["dark-cinematic"];
    // Use first hex color from visualTheme.palette as highlight if available (matches Veo/Imagen3 prompts)
    const paletteHex = storyboard.visualTheme?.palette?.match(/#[0-9a-fA-F]{6}/)?.[0];
    const highlightColor = paletteHex ?? tokens.highlightColor;

    let frameOffset = 0;
    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>
        {storyboard.scenes.map((scene) => {
          const from = frameOffset;
          frameOffset += scene.frames;
          return (
            <Sequence key={scene.id} from={from} durationInFrames={scene.frames}>
              <V2Scene
                imagePath={scene.imagePath     ?? ""}
                videoClipPath={scene.videoClipPath}
                caption={scene.caption}
                keyWord={scene.keyWord}
                durationFrames={scene.frames}
                zoomDirection={scene.zoomDir}
                captionStyle={scene.captionStyle}
                highlightColor={highlightColor}
                overlayColor={tokens.overlayColor}
                overlayOpacity={tokens.overlayAlpha}
              />
            </Sequence>
          );
        })}
        {voiceoverUrl && <Audio src={resolveImage(voiceoverUrl)} volume={1} />}
      </AbsoluteFill>
    );
  }

  // ── Legacy 3-scene path (backward compat) ────────────────────
  const scenes = data.scenes;
  if (!scenes) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;

  const legacyTokens = VISUAL_STYLE_TOKENS["dark-cinematic"];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Sequence from={V2_SCENES.hook.start} durationInFrames={V2_SCENES.hook.frames}>
        <V2Scene
          imagePath={scenes.hook.imagePath}
          videoClipPath={scenes.hook.videoClipPath}
          caption={scenes.hook.caption}
          keyWord={scenes.hook.keyWord}
          durationFrames={V2_SCENES.hook.frames}
          zoomDirection="in"
          captionStyle="impact"
          highlightColor={legacyTokens.highlightColor}
          overlayColor={legacyTokens.overlayColor}
          overlayOpacity={legacyTokens.overlayAlpha}
        />
      </Sequence>
      <Sequence from={V2_SCENES.insight.start} durationInFrames={V2_SCENES.insight.frames}>
        <V2Scene
          imagePath={scenes.insight.imagePath}
          videoClipPath={scenes.insight.videoClipPath}
          caption={scenes.insight.caption}
          keyWord={scenes.insight.keyWord}
          durationFrames={V2_SCENES.insight.frames}
          zoomDirection="pan"
          captionStyle="impact"
          highlightColor={legacyTokens.highlightColor}
          overlayColor={legacyTokens.overlayColor}
          overlayOpacity={0.5}
        />
      </Sequence>
      <Sequence from={V2_SCENES.cta.start} durationInFrames={V2_SCENES.cta.frames}>
        <V2Scene
          imagePath={scenes.cta.imagePath}
          videoClipPath={scenes.cta.videoClipPath}
          caption={scenes.cta.caption}
          keyWord={scenes.cta.keyWord}
          durationFrames={V2_SCENES.cta.frames}
          zoomDirection="out"
          captionStyle="impact"
          highlightColor={legacyTokens.highlightColor}
          overlayColor={legacyTokens.overlayColor}
          overlayOpacity={0.55}
        />
      </Sequence>
      {voiceoverUrl && <Audio src={resolveImage(voiceoverUrl)} volume={1} />}
    </AbsoluteFill>
  );
};

export { v2UGCSchema } from "./types";
export type { V2UGCData, V2UGCProps } from "./types";
