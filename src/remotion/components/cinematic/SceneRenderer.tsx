/**
 * SCENE RENDERER - Master orchestrator for the 6-scene TikTok cinematic sequence
 *
 * Scene structure (28s total @ 30fps = 840 frames):
 *   1. Hook    (0-2s)   — bold centered text, fast scale animation
 *   2. Problem (2-5s)   — pain point / supporting text
 *   3. Hero    (5-10s)  — main product image with glow + camera movement
 *   4. Features(10-20s) — carousel of product images with fast transitions
 *   5. Proof   (20-25s) — lifestyle/angle shot + social proof
 *   6. CTA     (25-28s) — TikTok yellow basket + strong CTA
 *
 * Full pipeline: Image Selection → Classification → Scene Assignment →
 * Camera → Parallax → Lighting → Transitions → Hook → Text Engine
 */
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { CinematicVideoProps } from "../../engine/types";
import { CIN_SCENE_FRAMES } from "../../engine/types";
import { resolveTheme, getLighting } from "../../engine/lightingEngine";
import { generateVariant } from "../../engine/animationVariants";
import { generateAllCameraConfigs } from "../../engine/cameraEngine";
import { generateAllTransitionConfigs } from "../../engine/transitionEngine";
import { generateHookConfig } from "../../engine/hookEngine";
import { selectBestImagePaths } from "../../engine/imageSelector";
import { generateSceneTextConfig } from "../../engine/textEngine";
import { assignImagesToScenes } from "../../engine/assignScenes";
import { ParallaxLayer } from "./ParallaxLayer";
import { Camera } from "./Camera";
import { Transition } from "./Transition";
import { Angle } from "./Angle";
import { Hero } from "./Hero";
import { Detail } from "./Detail";
import { Lifestyle } from "./Lifestyle";
import { CtaScene } from "./CtaScene";
import { Problem } from "./Problem";
import { CinematicBackground } from "./CinematicBackground";

interface SceneRendererProps {
  props: CinematicVideoProps;
}

export const SceneRenderer: React.FC<SceneRendererProps> = ({ props }) => {
  const {
    images, headline, subheadline, problemText, bulletPoints,
    cta, price, theme, colorHint, socialProof, backgroundImages, ctaStyle,
  } = props;

  // 1. Image Selection: pick best 6 from all available
  const selectedImages = images.length > 6 ? selectBestImagePaths(images, 6) : images;

  // 2. Theme + Classification + Scene Assignment
  const themeConfig = resolveTheme(theme, colorHint);
  const scenes = assignImagesToScenes(selectedImages);

  // 2b. Background images — distribute across 6 scenes
  const bgImages = backgroundImages || [];
  const hookBg = bgImages[0];
  const problemBg = bgImages[1] || bgImages[0];
  const heroBg = bgImages[2] || bgImages[1];
  const featuresBg = bgImages[3] || bgImages[2];
  const proofBg = bgImages[4] || bgImages[0];
  const ctaBg = bgImages[5] || bgImages[1] || bgImages[0];

  // 3. Deterministic seed
  const seed = selectedImages[0] || "default";

  // 4. Per-scene animation variants
  const hookVariant = generateVariant(seed + "hook", scenes.hook.category);
  const problemVariant = generateVariant(seed + "problem", "angle");
  const heroVariant = generateVariant(seed + "hero", "hero");
  const detailVariant = generateVariant(seed + "detail", "detail");
  const lifestyleVariant = generateVariant(seed + "proof", "lifestyle");
  const ctaVariant = generateVariant(seed + "cta", "hero");

  // 5. Per-scene camera configs
  const cameraConfigs = generateAllCameraConfigs(seed);

  // 6. Per-scene transition configs
  const transitionConfigs = generateAllTransitionConfigs(seed);

  // 7. Hook optimization
  const hookConfig = generateHookConfig(headline, seed, themeConfig.color);

  // 8. Per-scene lighting
  const hookLighting = getLighting(themeConfig, "hook");
  const problemLighting = getLighting(themeConfig, "problem");
  const heroLighting = getLighting(themeConfig, "hero");
  const featuresLighting = getLighting(themeConfig, "features");
  const proofLighting = getLighting(themeConfig, "proof");
  const ctaLighting = getLighting(themeConfig, "cta");

  // 9. Text Engine: per-scene typography + colors + anims
  const hookText = generateSceneTextConfig("hook", theme, colorHint, seed);
  const problemTextConfig = generateSceneTextConfig("problem", theme, colorHint, seed);
  const heroText = generateSceneTextConfig("hero", theme, colorHint, seed);
  const featuresText = generateSceneTextConfig("features", theme, colorHint, seed);
  const proofText = generateSceneTextConfig("proof", theme, colorHint, seed);
  const ctaText = generateSceneTextConfig("cta", theme, colorHint, seed);

  // Auto-generate problem text if not provided
  const resolvedProblemText = problemText || `Still searching for the perfect ${headline.toLowerCase()}?`;

  let offset = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B0B0F" }}>

      {/* ── Scene 1: HOOK (2s) — Bold grab, fast scale ── */}
      <Sequence from={offset} durationInFrames={CIN_SCENE_FRAMES.hook}>
        <CinematicBackground src={hookBg} theme={themeConfig} overlay={0.15} panDirection="right" />
        <Camera config={cameraConfigs.hook}>
          <ParallaxLayer theme={themeConfig} variant={hookVariant} seed={seed + "hook"}>
            <Angle
              src={scenes.hook.src}
              text={hookConfig.hookText}
              variant={hookVariant}
              lighting={hookLighting}
              theme={themeConfig}
              textConfig={hookText}
              slideFrom="bottom"
            />
          </ParallaxLayer>
        </Camera>
        <Transition config={transitionConfigs.hook} accentColor={themeConfig.color} />
      </Sequence>
      {(offset += CIN_SCENE_FRAMES.hook) && null}

      {/* ── Scene 2: PROBLEM (3s) — Pain point text ── */}
      <Sequence from={offset} durationInFrames={CIN_SCENE_FRAMES.problem}>
        <CinematicBackground src={problemBg} theme={themeConfig} overlay={0.25} panDirection="none" />
        <Camera config={cameraConfigs.problem}>
          <Problem
            text={resolvedProblemText}
            subtext={subheadline}
            variant={problemVariant}
            lighting={problemLighting}
            theme={themeConfig}
            textConfig={problemTextConfig}
          />
        </Camera>
        <Transition config={transitionConfigs.problem} accentColor={themeConfig.color} />
      </Sequence>
      {(offset += CIN_SCENE_FRAMES.problem) && null}

      {/* ── Scene 3: HERO (5s) — Main product showcase ── */}
      <Sequence from={offset} durationInFrames={CIN_SCENE_FRAMES.hero}>
        <CinematicBackground src={heroBg} theme={themeConfig} overlay={0.15} panDirection="left" />
        <Camera config={cameraConfigs.hero}>
          <ParallaxLayer theme={themeConfig} variant={heroVariant} seed={seed + "hero"}>
            <Hero
              src={scenes.hero.src}
              headline={headline}
              subheadline={subheadline}
              variant={heroVariant}
              lighting={heroLighting}
              theme={themeConfig}
              textConfig={heroText}
            />
          </ParallaxLayer>
        </Camera>
        <Transition config={transitionConfigs.hero} accentColor={themeConfig.color} />
      </Sequence>
      {(offset += CIN_SCENE_FRAMES.hero) && null}

      {/* ── Scene 4: FEATURES (10s) — Fast image carousel ── */}
      <Sequence from={offset} durationInFrames={CIN_SCENE_FRAMES.features}>
        <CinematicBackground src={featuresBg} theme={themeConfig} overlay={0.18} panDirection="right" />
        <Camera config={cameraConfigs.features}>
          <ParallaxLayer theme={themeConfig} variant={detailVariant} seed={seed + "features"}>
            <Detail
              images={scenes.features.map((f) => ({ src: f.src }))}
              bulletPoints={bulletPoints}
              variant={detailVariant}
              lighting={featuresLighting}
              theme={themeConfig}
              textConfig={featuresText}
            />
          </ParallaxLayer>
        </Camera>
        <Transition config={transitionConfigs.features} accentColor={themeConfig.color} />
      </Sequence>
      {(offset += CIN_SCENE_FRAMES.features) && null}

      {/* ── Scene 5: PROOF (5s) — Social proof + lifestyle ── */}
      <Sequence from={offset} durationInFrames={CIN_SCENE_FRAMES.proof}>
        <CinematicBackground src={proofBg} theme={themeConfig} overlay={0.15} panDirection="left" />
        <Camera config={cameraConfigs.proof}>
          <ParallaxLayer theme={themeConfig} variant={lifestyleVariant} seed={seed + "proof"}>
            <Lifestyle
              images={scenes.proof.map((p) => ({ src: p.src }))}
              socialProofNumber={socialProof?.number}
              socialProofText={socialProof?.label}
              variant={lifestyleVariant}
              lighting={proofLighting}
              theme={themeConfig}
              textConfig={proofText}
            />
          </ParallaxLayer>
        </Camera>
        <Transition config={transitionConfigs.proof} accentColor={themeConfig.color} />
      </Sequence>
      {(offset += CIN_SCENE_FRAMES.proof) && null}

      {/* ── Scene 6: CTA (3s) — TikTok Yellow Basket ── */}
      <Sequence from={offset} durationInFrames={CIN_SCENE_FRAMES.cta}>
        <CinematicBackground src={ctaBg} theme={themeConfig} overlay={0.2} zoom={1.12} panDirection="none" />
        <Camera config={cameraConfigs.cta}>
          <ParallaxLayer theme={themeConfig} variant={ctaVariant} seed={seed + "cta"}>
            <CtaScene
              src={scenes.cta.src}
              headline={headline}
              ctaText={cta}
              variant={ctaVariant}
              lighting={ctaLighting}
              theme={themeConfig}
              textConfig={ctaText}
              price={price}
              ctaStyle={ctaStyle || "tiktok-basket"}
            />
          </ParallaxLayer>
        </Camera>
      </Sequence>
    </AbsoluteFill>
  );
};
lProofNumber={socialProof?.number}
              socialProofText={socialProof?.label}
              variant={lifestyleVariant}
              lighting={proofLighting}
              theme={themeConfig}
              textConfig={proofText}
            />
          </ParallaxLayer>
        </Camera>
        <Transition config={transitionConfigs.proof} accentColor={themeConfig.color} />
      </Sequence>
      {(offset += CIN_SCENE_FRAMES.proof) && null}

      {/* ── Scene 6: CTA (3s) — TikTok Yellow Basket ── */}
      <Sequence from={offset} durationInFrames={CIN_SCENE_FRAMES.cta}>
        <CinematicBackground src={ctaBg} theme={themeConfig} overlay={0.2} zoom={1.12} panDirection="none" />
        <Camera config={cameraConfigs.cta}>
          <ParallaxLayer theme={themeConfig} variant={ctaVariant} seed={seed + "cta"}>
            <CtaScene
              src={scenes.cta.src}
              headline={headline}
              ctaText={cta}
              variant={ctaVariant}
              lighting={ctaLighting}
              theme={themeConfig}
              textConfig={ctaText}
              price={price}
              ctaStyle={ctaStyle || "tiktok-basket"}
            />
          </ParallexLayer>
        </Camera>
      </Sequence>
    </AbsoluteFill>
  );
};
