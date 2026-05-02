/**
 * ADVANCED LIGHTING ENGINE — Apple-Style Cinematic Lighting
 *
 * Implements 5 lighting layers:
 *   A. Rim Lighting — warm orange (left) + cool purple (right)
 *   B. Ambient Glow — theme-aware radial glow
 *   C. Depth Lighting — product shadow + darker background
 *   D. Light Sweep — animated streak across product
 *   E. Scene-Aware Intensity — CTA scene gets boosted glow
 */
import type { ThemePreset, ThemeConfig, LightingConfig, SceneType } from "./types";

// ─── Theme Definitions ──────────────────────────────────────

const THEME_CONFIGS: Record<ThemePreset, ThemeConfig> = {
  tech: {
    preset: "tech",
    color: "#6366f1",
    rimWarm: "#f97316",
    rimCool: "#818cf8",
    ambientGlow: "#6366f1",
    bgStart: "#0a0a12",
    bgEnd: "#050508",
    particleColor: "#818cf8",
    sweepColor: "#a5b4fc",
  },
  luxury: {
    preset: "luxury",
    color: "#d4a574",
    rimWarm: "#d4a574",
    rimCool: "#c084fc",
    ambientGlow: "#d4a574",
    bgStart: "#0f0a05",
    bgEnd: "#050302",
    particleColor: "#d4a574",
    sweepColor: "#fbbf24",
  },
  outdoor: {
    preset: "outdoor",
    color: "#22c55e",
    rimWarm: "#fb923c",
    rimCool: "#38bdf8",
    ambientGlow: "#22c55e",
    bgStart: "#050f08",
    bgEnd: "#020805",
    particleColor: "#4ade80",
    sweepColor: "#86efac",
  },
  minimal: {
    preset: "minimal",
    color: "#a1a1aa",
    rimWarm: "#d4d4d8",
    rimCool: "#71717a",
    ambientGlow: "#fafafa",
    bgStart: "#09090b",
    bgEnd: "#050505",
    particleColor: "#d4d4d8",
    sweepColor: "#e4e4e7",
  },
  bold: {
    preset: "bold",
    color: "#ef4444",
    rimWarm: "#f97316",
    rimCool: "#ec4899",
    ambientGlow: "#ef4444",
    bgStart: "#0f0505",
    bgEnd: "#080202",
    particleColor: "#f87171",
    sweepColor: "#fca5a5",
  },
  neon: {
    preset: "neon",
    color: "#00f5d4",
    rimWarm: "#fee440",
    rimCool: "#00bbf9",
    ambientGlow: "#00f5d4",
    bgStart: "#020812",
    bgEnd: "#010410",
    particleColor: "#00f5d4",
    sweepColor: "#9b5de5",
  },
};

/**
 * Get full theme config from preset name or color hint
 */
export function resolveTheme(preset: ThemePreset, colorHint?: string): ThemeConfig {
  const base = THEME_CONFIGS[preset] || THEME_CONFIGS.tech;

  if (colorHint && colorHint.startsWith("#")) {
    return {
      ...base,
      color: colorHint,
      ambientGlow: colorHint,
    };
  }

  return base;
}

/**
 * Generate per-scene lighting configuration
 * CTA scene gets boosted intensity for conversion impact
 */
export function getLighting(theme: ThemeConfig, sceneType: SceneType): LightingConfig {
  const isCta = sceneType === "cta";
  const isHero = sceneType === "hero";
  const isHook = sceneType === "hook";

  // Base intensities
  let rimWarmOpacity = 0.15;
  let rimCoolOpacity = 0.12;
  let ambientGlowOpacity = 0.08;
  let ambientGlowRadius = 45;
  let shadowOpacity = 0.5;
  let sweepWidth = 120;

  // Scene-aware boosts
  if (isCta) {
    rimWarmOpacity = 0.25;
    rimCoolOpacity = 0.2;
    ambientGlowOpacity = 0.18;
    ambientGlowRadius = 55;
    sweepWidth = 180;
  } else if (isHero) {
    rimWarmOpacity = 0.2;
    rimCoolOpacity = 0.16;
    ambientGlowOpacity = 0.12;
    ambientGlowRadius = 50;
  } else if (isHook) {
    rimWarmOpacity = 0.18;
    rimCoolOpacity = 0.14;
    ambientGlowOpacity = 0.1;
  }

  return {
    rimWarmColor: theme.rimWarm,
    rimCoolColor: theme.rimCool,
    rimWarmOpacity,
    rimCoolOpacity,
    ambientGlowColor: theme.ambientGlow,
    ambientGlowOpacity,
    ambientGlowRadius,
    shadowOpacity,
    shadowBlur: 60,
    sweepColor: theme.sweepColor,
    sweepWidth,
    sweepAngle: -20,
  };
}

/**
 * Generate CSS for radial ambient glow
 */
export function ambientGlowCSS(config: LightingConfig, cx = "50%", cy = "45%"): string {
  return `radial-gradient(ellipse at ${cx} ${cy}, ${config.ambientGlowColor}${Math.round(config.ambientGlowOpacity * 255).toString(16).padStart(2, "0")} 0%, transparent ${config.ambientGlowRadius}%)`;
}

/**
 * Generate CSS for product drop shadow
 */
export function depthShadowCSS(config: LightingConfig): string {
  return `0 ${config.shadowBlur / 2}px ${config.shadowBlur}px rgba(0,0,0,${config.shadowOpacity})`;
}

export { THEME_CONFIGS };
