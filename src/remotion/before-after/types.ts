/**
 * BEFOREAFTER VIDEO — Types & Constants
 * BeforeAfter video template
 */
export const BEF_FPS = 30;
export const BEF_WIDTH = 1080;
export const BEF_HEIGHT = 1920;

export const BEF_SCENE_FRAMES = {
  scene1_hook: 90,
  scene2_productA: 150,
  scene3_productB: 150,
  scene4_comparison: 180,
  scene5_winner: 120,
  scene6_cTA: 105,
} as const;

export const BEF_TOTAL_FRAMES = Object.values(BEF_SCENE_FRAMES).reduce(
  (a, b) => a + b,
  0
);
