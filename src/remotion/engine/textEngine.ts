/**
 * TEXT ENGINE — Font System + Color Engine + Typography
 * Controls all text rendering: fonts, colors, styling, brand consistency.
 *
 * Font stack:
 *   Headlines: Inter (default), Montserrat (bold/outdoor), Poppins (playful)
 *   Body: Inter (default), Roboto (clean)
 *
 * Color engine: auto-generates text palettes per theme with high contrast.
 * Typography: Apple-style — tight letter-spacing, clean weights, minimal.
 */
import type {
  ThemePreset,
  ThemeConfig,
  SceneType,
  FontFamily,
  TextRole,
  TextStyleConfig,
  TextColorPalette,
  TextAnimConfig,
  TextAnimation,
  SceneTextConfig,
} from "./types";

// ─── Seeded random ─────────────────────────────────────────

function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const chr = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) | 0;
    return (hash >>> 0) / 4294967296;
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ─── Font System ───────────────────────────────────────────

/** Theme → headline font mapping */
const THEME_HEADLINE_FONTS: Record<ThemePreset, FontFamily> = {
  tech: "Space Grotesk",
  luxury: "Montserrat",
  outdoor: "Montserrat",
  minimal: "Space Grotesk",
  bold: "Space Grotesk",
  neon: "Space Grotesk",
};

/** Theme → body font mapping */
const THEME_BODY_FONTS: Record<ThemePreset, FontFamily> = {
  tech: "Inter",
  luxury: "Inter",
  outdoor: "Roboto",
  minimal: "Inter",
  bold: "Roboto",
  neon: "Inter",
};

export function getHeadlineFont(theme: ThemePreset): FontFamily {
  return THEME_HEADLINE_FONTS[theme];
}

export function getBodyFont(theme: ThemePreset): FontFamily {
  return THEME_BODY_FONTS[theme];
}

// ─── Color Engine ──────────────────────────────────────────

/** Theme-specific text color palettes */
const THEME_TEXT_PALETTES: Record<ThemePreset, TextColorPalette> = {
  tech: {
    primary: "#FFFFFF",
    secondary: "#A1A1AA",
    accent: "#8B5CF6",
    glow: "#8B5CF6",
    contrast: "#FFFFFF",
  },
  luxury: {
    primary: "#F9FAFB",
    secondary: "#D4D4D8",
    accent: "#EAB308",
    glow: "#EAB308",
    contrast: "#FFFFFF",
  },
  outdoor: {
    primary: "#FFFFFF",
    secondary: "#D1D5DB",
    accent: "#F59E0B",
    glow: "#F59E0B",
    contrast: "#FFFFFF",
  },
  minimal: {
    primary: "#FAFAFA",
    secondary: "#A1A1AA",
    accent: "#71717A",
    glow: "#71717A",
    contrast: "#FFFFFF",
  },
  bold: {
    primary: "#FFFFFF",
    secondary: "#FCA5A5",
    accent: "#EF4444",
    glow: "#EF4444",
    contrast: "#FFFFFF",
  },
  neon: {
    primary: "#FFFFFF",
    secondary: "#C4B5FD",
    accent: "#A78BFA",
    glow: "#A78BFA",
    contrast: "#FFFFFF",
  },
};

/**
 * Get text color palette for a theme.
 * If a colorHint is provided, derives accent from it.
 */
export function getTextPalette(theme: ThemePreset, colorHint?: string): TextColorPalette {
  const base = { ...THEME_TEXT_PALETTES[theme] };

  if (colorHint) {
    base.accent = colorHint;
    base.glow = colorHint;
  }

  return base;
}

/**
 * Compute relative luminance of a hex color (0 = black, 1 = white)
 */
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const toLinear = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Ensure text has sufficient contrast against background.
 * Returns white or dark text based on WCAG contrast ratio.
 */
export function ensureContrast(bgColor: string, preferredColor: string = "#FFFFFF"): string {
  const bgLum = luminance(bgColor);
  const textLum = luminance(preferredColor);
  const ratio = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);

  // WCAG AA requires 4.5:1 for normal text
  if (ratio >= 4.5) return preferredColor;
  // Flip to white or dark
  return bgLum > 0.5 ? "#0a0a0a" : "#FFFFFF";
}

// ─── Typography Rules ──────────────────────────────────────

/** Role-based typography defaults */
const ROLE_TYPOGRAPHY: Record<TextRole, Omit<TextStyleConfig, "color" | "textShadow" | "gradient">> = {
  hook: {
    fontFamily: "Bebas Neue",
    fontWeight: 400,
    fontSize: 110,
    letterSpacing: "0.04em",
    lineHeight: 1.0,
    opacity: 1.0,
    textTransform: "uppercase",
  },
  headline: {
    fontFamily: "Inter",
    fontWeight: 800,
    fontSize: 72,
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
    opacity: 1.0,
    textTransform: "none",
  },
  subheadline: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 38,
    letterSpacing: "-0.01em",
    lineHeight: 1.3,
    opacity: 0.85,
    textTransform: "none",
  },
  body: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 36,
    letterSpacing: "0em",
    lineHeight: 1.4,
    opacity: 0.8,
    textTransform: "none",
  },
  cta: {
    fontFamily: "Inter",
    fontWeight: 600,
    fontSize: 40,
    letterSpacing: "0.04em",
    lineHeight: 1.0,
    opacity: 1.0,
    textTransform: "uppercase",
  },
  bullet: {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: 36,
    letterSpacing: "0em",
    lineHeight: 1.3,
    opacity: 0.9,
    textTransform: "none",
  },
  label: {
    fontFamily: "Inter",
    fontWeight: 500,
    fontSize: 26,
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    opacity: 0.6,
    textTransform: "uppercase",
  },
};

/**
 * Generate a glow text-shadow for a given color and intensity.
 */
function glowShadow(color: string, intensity: number = 0.5): string {
  const hex = Math.round(intensity * 40).toString(16).padStart(2, "0");
  return `0 4px 24px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,1), 0 0 60px ${color}${hex}, 0 0 120px ${color}${Math.round(intensity * 20).toString(16).padStart(2, "0")}`;
}

/**
 * Generate a premium gradient CSS for text.
 */
function premiumGradient(accent: string, secondary: string): string {
  return `linear-gradient(135deg, #FFFFFF 0%, ${accent} 50%, ${secondary} 100%)`;
}

/**
 * Get complete text style for a role within a scene.
 */
export function getTextStyle(
  role: TextRole,
  theme: ThemePreset,
  palette: TextColorPalette,
  options?: { gradient?: boolean; glowIntensity?: number },
): TextStyleConfig {
  const base = { ...ROLE_TYPOGRAPHY[role] };
  const headlineFont = getHeadlineFont(theme);
  const bodyFont = getBodyFont(theme);

  // Apply theme-specific font
  if (role === "hook" || role === "headline" || role === "cta") {
    base.fontFamily = headlineFont;
  } else {
    base.fontFamily = bodyFont;
  }

  // Apply color based on role
  let color = palette.primary;
  if (role === "subheadline" || role === "body") color = palette.secondary;
  if (role === "cta") color = palette.contrast;
  if (role === "label") color = palette.secondary;

  // Build text shadow
  const glowIntensity = options?.glowIntensity ?? (role === "hook" || role === "cta" ? 0.6 : 0.3);
  const textShadow = glowShadow(palette.glow, glowIntensity);

  // Optional gradient
  const gradient = options?.gradient ? premiumGradient(palette.accent, palette.secondary) : undefined;

  return {
    ...base,
    color,
    textShadow,
    gradient,
  };
}

// ─── Animation Presets per Role ────────────────────────────

/** Default animation configs per text role + scene type */
const SCENE_TEXT_ANIMS: Record<SceneType, {
  headline: TextAnimation;
  subheadline: TextAnimation;
  cta: TextAnimation;
}> = {
  hook: { headline: "glitch", subheadline: "maskReveal", cta: "none" },
  problem: { headline: "maskReveal", subheadline: "fadeIn", cta: "none" },
  hero: { headline: "cascade", subheadline: "fadeSlideUp", cta: "none" },
  features: { headline: "fadeSlideUp", subheadline: "fadeIn", cta: "none" },
  proof: { headline: "cascade", subheadline: "fadeIn", cta: "none" },
  cta: { headline: "maskReveal", subheadline: "fadeIn", cta: "popIn" },
};

/**
 * Get animation config for a text role in a given scene.
 */
export function getTextAnim(
  role: "headline" | "subheadline" | "cta",
  scene: SceneType,
  seed: string,
): TextAnimConfig {
  const animation = SCENE_TEXT_ANIMS[scene][role];
  const rand = seededRandom(seed + "textAnim" + role + scene);

  // Base delays: headline first, sub delayed, cta delayed more
  const baseDelay = role === "headline" ? 8 : role === "subheadline" ? 20 : 25;

  const ANIM_DEFAULTS: Record<TextAnimation, Omit<TextAnimConfig, "animation" | "delay">> = {
    fadeSlideUp: { damping: 12, stiffness: 160, slideDistance: 30, scaleFrom: 1, scaleTo: 1 },
    punchScale:  { damping: 8,  stiffness: 280, slideDistance: 0,  scaleFrom: 0.3, scaleTo: 1.0 },
    glowPulse:   { damping: 14, stiffness: 140, slideDistance: 0,  scaleFrom: 0.95, scaleTo: 1.0 },
    popIn:       { damping: 10, stiffness: 200, slideDistance: 0,  scaleFrom: 0.5, scaleTo: 1.0 },
    fadeIn:      { damping: 16, stiffness: 120, slideDistance: 0,  scaleFrom: 1, scaleTo: 1 },
    maskReveal:  { damping: 14, stiffness: 200, slideDistance: 40, scaleFrom: 1, scaleTo: 1 },
    glitch:      { damping: 6,  stiffness: 400, slideDistance: 0,  scaleFrom: 0.9, scaleTo: 1.0 },
    cascade:     { damping: 10, stiffness: 240, slideDistance: 0,  scaleFrom: 0.7, scaleTo: 1.0 },
    none:        { damping: 12, stiffness: 160, slideDistance: 0,  scaleFrom: 1, scaleTo: 1 },
  };

  const base = ANIM_DEFAULTS[animation];

  return {
    animation,
    delay: baseDelay + Math.round(lerp(-3, 3, rand())),
    damping: base.damping * lerp(0.9, 1.1, rand()),
    stiffness: base.stiffness * lerp(0.9, 1.1, rand()),
    slideDistance: base.slideDistance * lerp(0.8, 1.2, rand()),
    scaleFrom: base.scaleFrom,
    scaleTo: base.scaleTo,
  };
}

// ─── Full Scene Text Config Generator ──────────────────────

/**
 * Generate complete text configuration for a scene.
 * This is the main entry point for the text engine.
 */
export function generateSceneTextConfig(
  scene: SceneType,
  theme: ThemePreset,
  colorHint: string,
  seed: string,
): SceneTextConfig {
  const palette = getTextPalette(theme, colorHint);

  // Scene-specific font size adjustments
  const hookSizeBoost = scene === "hook" ? 1.2 : 1.0;
  const ctaSizeBoost = scene === "cta" ? 1.1 : 1.0;

  const headline = getTextStyle("headline", theme, palette, { glowIntensity: scene === "hook" ? 0.7 : 0.4 });
  headline.fontSize = Math.round(headline.fontSize * hookSizeBoost);

  const subheadline = getTextStyle("subheadline", theme, palette);
  const cta = getTextStyle("cta", theme, palette, { glowIntensity: 0.5 });
  cta.fontSize = Math.round(cta.fontSize * ctaSizeBoost);
  const body = getTextStyle("body", theme, palette);

  return {
    headline,
    subheadline,
    cta,
    body,
    headlineAnim: getTextAnim("headline", scene, seed),
    subheadlineAnim: getTextAnim("subheadline", scene, seed),
    ctaAnim: getTextAnim("cta", scene, seed),
    layout: {
      position: "bottom",
      paddingX: 60,
      offsetY: 0,
      textAlign: "center",
      maxWidth: 960,
    },
    colors: palette,
  };
}
