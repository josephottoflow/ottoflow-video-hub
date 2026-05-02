/**
 * REMOTION ROOT - Composition Registry
 */
import React from "react";
import { Composition, getStaticFiles } from "remotion";
import { ProductVideo, productVideoSchema } from "./ProductVideo";
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT, TOTAL_FRAMES } from "./types";
import type { ProductVideoData } from "./types";
import { DemoVideo } from "./demo/DemoVideo";
import { DEMO_FPS, DEMO_WIDTH, DEMO_HEIGHT, TOTAL_DEMO_FRAMES } from "./demo/types";
import { ProductDemoVideo, productDemoSchema } from "./product-demo/ProductDemoVideo";
import { PD_FPS, PD_WIDTH, PD_HEIGHT, PD_TOTAL_FRAMES } from "./product-demo/types";
import { UnboxingVideo, unboxingSchema } from "./unboxing/UnboxingVideo";
import { UNB_FPS, UNB_WIDTH, UNB_HEIGHT, UNB_TOTAL_FRAMES } from "./unboxing/types";
import { BeforeAfterVideo, beforeafterSchema } from "./before-after/BeforeAfterVideo";
import { BEF_FPS, BEF_WIDTH, BEF_HEIGHT, BEF_TOTAL_FRAMES } from "./before-after/types";
import { CinematicVideo, cinematicSchema } from "./cinematic/CinematicVideo";
import { CIN_FPS, CIN_WIDTH, CIN_HEIGHT, CIN_TOTAL_FRAMES } from "./engine/types";

export const RemotionRoot: React.FC = () => {
  const staticFiles = getStaticFiles();
  const products = staticFiles
    .filter((file) => file.name.endsWith("video-data.json"))
    .map((file) => {
      const parts = file.name.split("/");
      return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    });

  return (
    <>
      {/* Dynamic compositions from discovered products */}
      {products.map((productSlug) => (
        <Composition
          key={productSlug}
          id={productSlug}
          component={ProductVideo}
          fps={FPS}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
          durationInFrames={TOTAL_FRAMES}
          schema={productVideoSchema}
          defaultProps={{ data: null }}
          calculateMetadata={async () => {
            try {
              const res = await fetch(
                "http://localhost:3000/api/video-data/" + productSlug
              );
              if (res.ok) {
                const data = (await res.json()) as ProductVideoData;
                return { props: { data } };
              }
            } catch {}
            try {
              const staticRes = await fetch(
                "/content/" + productSlug + "/video-data.json"
              );
              if (staticRes.ok) {
                const data = (await staticRes.json()) as ProductVideoData;
                return { props: { data } };
              }
            } catch {}
            return { props: { data: null } };
          }}
        />
      ))}

      {/* Original 6-scene product video */}
      <Composition
        id="product-video"
        component={ProductVideo}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        durationInFrames={TOTAL_FRAMES}
        schema={productVideoSchema}
        defaultProps={{ data: null }}
      />

      {/* 7-scene product demo - pipeline render target */}
      <Composition
        id="product-demo"
        component={ProductDemoVideo}
        fps={PD_FPS}
        width={PD_WIDTH}
        height={PD_HEIGHT}
        durationInFrames={PD_TOTAL_FRAMES}
        schema={productDemoSchema}
        defaultProps={{ data: null }}
      />

      {/* Unboxing / Product Reveal template */}
      <Composition
        id="unboxing"
        component={UnboxingVideo}
        fps={UNB_FPS}
        width={UNB_WIDTH}
        height={UNB_HEIGHT}
        durationInFrames={UNB_TOTAL_FRAMES}
        schema={unboxingSchema}
        defaultProps={{ data: null }}
      />

      {/* ClaudeVideoExport.com standalone demo */}
      <Composition
        id="demo-video"
        component={DemoVideo}
        fps={DEMO_FPS}
        width={DEMO_WIDTH}
        height={DEMO_HEIGHT}
        durationInFrames={TOTAL_DEMO_FRAMES}
      />

      {/* Preview with sample data */}
      <Composition
        id="preview"
        component={ProductVideo}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        durationInFrames={TOTAL_FRAMES}
        schema={productVideoSchema}
        defaultProps={{
          data: {
            productSlug: "sample-product",
            brandColors: {
              primary: "#6366f1",
              secondary: "#8b5cf6",
              accent: "#f59e0b",
              background: "#0a0a0a",
              text: "#ffffff",
            },
            hook: {
              painPointQuestion:
                "Still wasting time on boring product photos?",
            },
            productIntro: {
              productName: "Sample Product",
              tagline: "The future of product videos",
            },
            simulatedDemo: {
              inputPlaceholder: "Drop your product link...",
              typedText: "tiktok.com/shop/amazing-product",
              buttonText: "Generate Video",
              resultText: "Video ready in 30 seconds!",
              resultSubtext: "Auto-generated with AI narration",
            },
            imageShowcase: {
              images: [
                { path: "sample/product-1.png", headline: "Premium Quality" },
                { path: "sample/product-2.png", headline: "Viral Ready" },
              ],
            },
            featureCallouts: {
              productImagePath: "sample/product-1.png",
              features: [
                { icon: "lightning", text: "Auto-generated in seconds" },
                { icon: "star", text: "TikTok-optimized format" },
                { icon: "check", text: "SEO titles and hashtags included" },
              ],
            },
            socialProofCta: {
              socialProofNumber: 50000,
              socialProofLabel: "videos created",
              ctaUrl: "Link in bio",
            },
          },
        }}
      />

      {/* BeforeAfter template */}
      <Composition
        id="before-after"
        component={BeforeAfterVideo}
        fps={BEF_FPS}
        width={BEF_WIDTH}
        height={BEF_HEIGHT}
        durationInFrames={BEF_TOTAL_FRAMES}
        schema={beforeafterSchema}
        defaultProps={{ data: null }}
      />

      {/* Cinematic - Apple-style premium product video */}
      <Composition
        id="cinematic"
        component={CinematicVideo}
        fps={CIN_FPS}
        width={CIN_WIDTH}
        height={CIN_HEIGHT}
        durationInFrames={CIN_TOTAL_FRAMES}
        schema={cinematicSchema}
        defaultProps={{
          data: {
            images: [
              // Clean product photos first (hero + hook priority)
              "content/ultralight-foldable-camping-chair/images/frame-05.png",  // Clean khaki chair — HERO
              "content/ultralight-foldable-camping-chair/images/frame-06.png",  // Lifestyle carry bag — HOOK
              // Infographic images last (features/proof fallback only)
              "content/ultralight-foldable-camping-chair/images/frame-04.png",  // Detail pocket shot
              "content/ultralight-foldable-camping-chair/images/frame-02.png",  // Color variants
            ],
            headline: "Ultralight Camping Chair",
            subheadline: "Sets up in seconds — sturdy aluminum frame",
            problemText: "Still searching for the perfect camping chair?",
            bulletPoints: [],
            cta: "Shop Now",
            price: "$29.99",
            theme: "outdoor" as const,
            colorHint: "#22c55e",
            socialProof: {
              number: 10000,
              label: "happy customers",
            },
            backgroundImages: [
              "https://videos.pexels.com/video-files/19281575/19281575-hd_1080_1920_30fps.mp4",   // Hook
              "https://videos.pexels.com/video-files/34142319/14476178_1080_1920_60fps.mp4",   // Problem
              "https://videos.pexels.com/video-files/30009146/12875267_1080_1920_30fps.mp4",   // Hero
              "https://videos.pexels.com/video-files/37218116/15766888_1080_1920_30fps.mp4",   // Features
              "https://videos.pexels.com/video-files/28265425/12344352_1080_1920_60fps.mp4",   // Proof
              "https://videos.pexels.com/video-files/19281575/19281575-hd_1080_1920_30fps.mp4",   // CTA
            ],
            ctaStyle: "tiktok-basket" as const,
          },
        }}
      />
    </>
  );
};
