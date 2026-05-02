/**
 * UNBOXING VIDEO — Types & Constants
 * Product unboxing/reveal template driven by ProductVideoData.
 */
export const UNB_FPS = 30;
export const UNB_WIDTH = 1080;
export const UNB_HEIGHT = 1920;

export const UNB_SCENE_FRAMES = {
  scene1_textHook: 90,          // 3s
  scene2_packageReveal: 150,    // 5s
  scene3_unboxing: 180,         // 6s
  scene4_productShowcase: 180,  // 6s
  scene5_features: 150,         // 5s
  scene6_socialProof: 120,      // 4s
  scene7_cta: 105,              // 3.5s
} as const;

export const UNB_TOTAL_FRAMES = Object.values(UNB_SCENE_FRAMES).reduce(
  (a, b) => a + b,
  0
); // 975 frames = 32.5s
