/**
 * PRODUCT DEMO VIDEO — Types & Constants
 * 7-scene product video driven by Google Sheet data.
 * Reuses ProductVideoData from the main types.
 */
export const PD_FPS = 30;
export const PD_WIDTH = 1080;
export const PD_HEIGHT = 1920;

export const PD_SCENE_FRAMES = {
  scene1_hook: 90,       // 3s   — Text hook
  scene2_oldWay: 180,    // 6s   — The old/painful way
  scene3_reveal: 150,    // 5s   — Product reveal
  scene4_gallery: 180,   // 6s   — Image gallery showcase
  scene5_features: 150,  // 5s   — Feature callouts
  scene6_social: 150,    // 5s   — Social platforms + proof
  scene7_cta: 105,       // 3.5s — CTA
} as const;

export const PD_TOTAL_FRAMES = Object.values(PD_SCENE_FRAMES).reduce(
  (a, b) => a + b,
  0
); // 1005 frames = 33.5s

export const PD_COLORS = {
  bg: "#0a0a0a",
  bgCard: "#151518",
  bgBrowser: "#1e2028",
  bgBrowserBar: "#2a2d37",
  text: "#ffffff",
  textMuted: "#8b8d97",
  textDim: "#555763",
  border: "#2a2d33",
  inputBg: "#1a1c22",
  // Platform colors
  tiktok: "#00f2ea",
  instagram: "#e4405f",
  youtube: "#ff0000",
} as const;
