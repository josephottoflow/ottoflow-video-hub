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
    // Pick the first sufficiently bright hex from the palette as the highlight color.
    // Skips dark swatches (the palette often starts with the base dark tone).
    const paletteHex = (() => {
      const hexes = storyboard.visualTheme?.palette?.match(/#[0-9a-fA-F]{6}/g) ?? [];
      for (const h of hexes) {
        const r = parseInt(h.slice(1, 3), 16) / 255;
        const g = parseInt(h.slice(3, 5), 16) / 255;
        const b = parseInt(h.slice(5, 7), 16) / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum > 0.15) return h;
      }
      return null;
    })();
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
