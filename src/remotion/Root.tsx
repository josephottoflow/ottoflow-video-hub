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
import { ListicleVideo, listicleSchema, LIST_FPS, LIST_W, LIST_H, LIST_TOTAL } from "./listicle/ListicleVideo";
import { StatsStoryVideo, statsStorySchema, SS_FPS, SS_W, SS_H, SS_TOTAL } from "./stats-story/StatsStoryVideo";
import { TutorialVideo, tutorialSchema, TUT_FPS, TUT_W, TUT_H, TUT_TOTAL } from "./tutorial/TutorialVideo";
import { MythBusterVideo, mythBusterSchema, MB_FPS, MB_W, MB_H, MB_TOTAL } from "./myth-buster/MythBusterVideo";
import { QuoteCardVideo, quoteCardSchema, QC_FPS, QC_W, QC_H, QC_TOTAL } from "./quote-card/QuoteCardVideo";
import { V2UGCVideo, v2UGCSchema }                                        from "./v2-ugc/V2UGCVideo";
import { V2_FPS, V2_WIDTH, V2_HEIGHT, V2_TOTAL }                          from "./v2-ugc/types";

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
              const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
              const res = await fetch(
                base + "/api/video-data/" + productSlug
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

      {/* ── New templates ── */}

      {/* Listicle — numbered reveal list (educational breakdowns) */}
      <Composition
        id="listicle"
        component={ListicleVideo}
        fps={LIST_FPS}
        width={LIST_W}
        height={LIST_H}
        durationInFrames={LIST_TOTAL}
        schema={listicleSchema}
        defaultProps={{ data: null }}
      />

      {/* Stats Story — data-driven big number impact */}
      <Composition
        id="stats-story"
        component={StatsStoryVideo}
        fps={SS_FPS}
        width={SS_W}
        height={SS_H}
        durationInFrames={SS_TOTAL}
        schema={statsStorySchema}
        defaultProps={{ data: null }}
      />

      {/* Tutorial — step-by-step how-to with progress bar */}
      <Composition
        id="tutorial"
        component={TutorialVideo}
        fps={TUT_FPS}
        width={TUT_W}
        height={TUT_H}
        durationInFrames={TUT_TOTAL}
        schema={tutorialSchema}
        defaultProps={{ data: null }}
      />

      {/* Myth Buster — MYTH → REALITY dramatic reveal */}
      <Composition
        id="myth-buster"
        component={MythBusterVideo}
        fps={MB_FPS}
        width={MB_W}
        height={MB_H}
        durationInFrames={MB_TOTAL}
        schema={mythBusterSchema}
        defaultProps={{ data: null }}
      />

      {/* Quote Card — cinematic word-by-word quote reveal */}
      <Composition
        id="quote-card"
        component={QuoteCardVideo}
        fps={QC_FPS}
        width={QC_W}
        height={QC_H}
        durationInFrames={QC_TOTAL}
        schema={quoteCardSchema}
        defaultProps={{ data: null }}
      />

      {/* V2 UGC — Dynamic storyboard engine (3-5 scenes, variable duration) */}
      <Composition
        id="v2-ugc"
        component={V2UGCVideo}
        fps={V2_FPS}
        width={V2_WIDTH}
        height={V2_HEIGHT}
        durationInFrames={V2_TOTAL}
        schema={v2UGCSchema}
        defaultProps={{
          data: {
            topic: "V2 Preview",
            scenes: {
              hook:    { imagePath: "", caption: "Stop Scrolling Now",  keyWord: "STOP"  },
              insight: { imagePath: "", caption: "Here Is The Truth",   keyWord: "TRUTH" },
              cta:     { imagePath: "", caption: "Follow For More",     keyWord: "FOLLOW"},
            },
          },
        }}
        calculateMetadata={({ props }) => {
          // Use storyboard totalFrames when present — enables dynamic video length
          const storyboard = (props as { data?: { storyboard?: { totalFrames?: number } } })?.data?.storyboard;
          if (storyboard?.totalFrames && storyboard.totalFrames > 0) {
            return { durationInFrames: storyboard.totalFrames };
          }
          return { durationInFrames: V2_TOTAL };
        }}
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
            images: [],
            headline: "Ottoflow",
            subheadline: "AI-powered short-form video at scale",
            problemText: "Still making videos manually in 2025?",
            bulletPoints: [],
            cta: "Try Ottoflow",
            price: "",
            theme: "tech" as const,
            colorHint: "#6366f1",
            socialProof: {
              number: 10000,
              label: "videos generated",
            },
            backgroundImages: [
              "backgrounds/cinematic-smoke-test/bg-hook.mp4",
              "backgrounds/cinematic-smoke-test/bg-problem.mp4",
              "backgrounds/cinematic-smoke-test/bg-hero.mp4",
              "backgrounds/cinematic-smoke-test/bg-features.mp4",
              "backgrounds/cinematic-smoke-test/bg-proof.mp4",
              "backgrounds/cinematic-smoke-test/bg-hook.mp4",
            ],
            ctaStyle: "tiktok-basket" as const,
          },
        }}
      />
    </>
  );
};
