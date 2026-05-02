/**
 * DEMO VIDEO TYPES & CONSTANTS
 * ClaudeVideoExport.com product demo — 7 scenes, ~33.5s
 */

export const DEMO_FPS = 30;
export const DEMO_WIDTH = 1080;
export const DEMO_HEIGHT = 1920;

export const BRAND = {
  green: "#1f7a4d",
  greenLight: "#2a9d5f",
  greenDark: "#165e3a",
  bg: "#0f1117",
  bgCard: "#1a1d27",
  bgBrowser: "#25282f",
  bgBrowserBar: "#2a2d37",
  text: "#ffffff",
  textMuted: "#8b8d97",
  textDim: "#555763",
  yellow: "#d4a017",
  yellowHighlight: "#fef3c7",
  border: "#333640",
  inputBg: "#1e2028",
  // Social platform colors
  youtube: "#ff0000",
  instagram: "#e4405f",
  facebook: "#1877f2",
} as const;

export const SCENE_FRAMES = {
  scene1: 90,   // 3s   — Text hook
  scene2: 240,  // 8s   — Claude Design browser
  scene3: 150,  // 5s   — Export form
  scene4: 120,  // 4s   — Progress bar
  scene5: 90,   // 3s   — File download
  scene6: 210,  // 7s   — Social upload drag & drop
  scene7: 105,  // 3.5s — CTA
} as const;

export const TOTAL_DEMO_FRAMES = Object.values(SCENE_FRAMES).reduce(
  (a, b) => a + b,
  0
); // 1005 frames = 33.5s
