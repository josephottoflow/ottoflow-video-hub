/**
 * SMART ANIMATION ENGINE — Shared Types
 * Core types for the cinematic product video system.
 */

// ─── Image Classification ────────────────────────────────────

export type ImageCategory = "hero" | "detail" | "lifestyle" | "angle";

export interface ClassifiedImage {
  src: string;
  category: ImageCategory;
  index: number;
  /** Confidence score 0-1 for the classification */
  confidence: number;
}

// ─── Scene Assignment ────────────────────────────────────────

export type SceneType = "hook" | "problem" | "hero" | "features" | "proof" | "cta";

export interface SceneAssignment {
  hook: ClassifiedImage;
  problem?: ClassifiedImage;
  hero: ClassifiedImage;
  features: ClassifiedImage[];
  proof: ClassifiedImage[];
  cta: ClassifiedImage;
}

// ─── Theme System ────────────────────────────────────────────

export type ThemePreset = "tech" | "luxury" | "outdoor" | "minimal" | "bold" | "neon";

export interface ThemeConfig {
  preset: ThemePreset;
  /** Primary brand color */
  color: string;
  /** Warm rim light color */
  rimWarm: string;
  /** Cool rim light color */
  rimCool: string;
  /** Ambient glow color */
  ambientGlow: string;
  /** Background gradient start */
  bgStart: string;
  /** Background gradient end */
  bgEnd: string;
  /** Particle color */
  particleColor: string;
  /** Light sweep color */
  sweepColor: string;
}

// ─── Animation Variants ──────────────────────────────────────

export interface AnimationVariant {
  /** Scale of floating animation (px) */
  floatAmplitude: number;
  /** Speed multiplier */
  floatSpeed: number;
  /** Rotation amount (deg) */
  rotateAmount: number;
  /** Zoom start/end scale */
  zoomFrom: number;
  zoomTo: number;
  /** Ken Burns pan distance (px) */
  panDistance: number;
  /** Glow intensity 0-1 */
  glowIntensity: number;
  /** Light sweep speed multiplier */
  sweepSpeed: number;
  /** Particle count */
  particleCount: number;
  /** Spring damping override */
  springDamping: number;
  /** Spring stiffness override */
  springStiffness: number;
}

// ─── Cinematic Video Props ───────────────────────────────────

export interface SocialProofData {
  /** Number to animate up to (e.g. 10000) */
  number: number;
  /** Label below the number (e.g. "happy customers") */
  label: string;
}

export interface CinematicVideoProps {
  images: string[];
  headline: string;
  subheadline: string;
  /** Problem/pain point text for scene 2 */
  problemText?: string;
  bulletPoints: string[];
  cta: string;
  /** Optional price for TikTok basket CTA */
  price?: string;
  theme: ThemePreset;
  colorHint: string;
  /** Optional social proof data — if omitted, scene uses default */
  socialProof?: SocialProofData;
  /** Optional Pexels background image URLs for atmospheric scene backgrounds */
  backgroundImages?: string[];
  /** CTA style: tiktok-basket (default) or classic */
  ctaStyle?: "tiktok-basket" | "classic";
}

// ─── Lighting ────────────────────────────────────────────────

export interface LightingConfig {
  rimWarmOpacity: number;
  rimCoolOpacity: number;
  rimWarmColor: string;
  rimCoolColor: string;
  ambientGlowColor: string;
  ambientGlowOpacity: number;
  ambientGlowRadius: number;
  shadowOpacity: number;
  shadowBlur: number;
  sweepColor: string;
  sweepWidth: number;
  sweepAngle: number;
}

// ─── Camera System ──────────────────────────────────────────

export type CameraMovement = "pushIn" | "pullOut" | "panLeft" | "panRight" | "drift" | "heroReveal";

export interface CameraConfig {
  /** Movement type for this scene */
  movement: CameraMovement;
  /** Scale at start of scene */
  scaleFrom: number;
  /** Scale at end of scene */
  scaleTo: number;
  /** Horizontal translate start (px) */
  translateXFrom: number;
  /** Horizontal translate end (px) */
  translateXTo: number;
  /** Vertical translate start (px) */
  translateYFrom: number;
  /** Vertical translate end (px) */
  translateYTo: number;
  /** Easing curve strength (0 = linear, higher = more ease) */
  easeStrength: number;
  /** Subtle drift amplitude for organic feel (px) */
  driftAmplitude: number;
  /** Drift speed multiplier */
  driftSpeed: number;
}

/** Default scene -> camera movement mapping */
export const SCENE_CAMERA_MAP: Record<SceneType, CameraMovement> = {
  hook: "pushIn",
  problem: "drift",
  hero: "heroReveal",
  features: "panRight",
  proof: "drift",
  cta: "pullOut",
} as const;

// ─── Transition System ──────────────────────────────────────

export type TransitionType = "cut" | "blurFade" | "whip" | "zoomBlur";

export interface TransitionConfig {
  type: TransitionType;
  /** Duration in frames */
  durationFrames: number;
  /** Blur amount at peak (px) */
  blurPeak: number;
  /** Horizontal whip distance (px) - whip only */
  whipDistance: number;
  /** Zoom scale at peak - zoomBlur only */
  zoomPeak: number;
  /** Intensity 0-1 */
  intensity: number;
}

/** Default scene-exit -> transition mapping */
export const SCENE_TRANSITION_MAP: Record<SceneType, TransitionType> = {
  hook: "cut",
  problem: "blurFade",
  hero: "blurFade",
  features: "whip",
  proof: "blurFade",
  cta: "cut",
} as const;

/** Transition overlay duration (frames subtracted from scene end / added to next scene start) */
export const TRANSITION_OVERLAP = 12;

// ─── Hook Optimization ──────────────────────────────────────

export interface HookConfig {
  /** Generated scroll-stopping hook text */
  hookText: string;
  /** Scale animation: fast punch scale */
  scaleFrom: number;
  scaleTo: number;
  /** Shake amplitude (px) */
  shakeAmplitude: number;
  /** Shake speed */
  shakeSpeed: number;
  /** Text glow color */
  glowColor: string;
}

// ─── Image Selection ────────────────────────────────────────

export interface ImageSelection {
  /** Selected images in optimal order: [hero, detail, detail, lifestyle] */
  selected: ClassifiedImage[];
  /** Total images considered */
  totalConsidered: number;
  /** Images that were dropped */
  dropped: ClassifiedImage[];
}

// ─── Text Engine ────────────────────────────────────────────

export type FontFamily = "Inter" | "Montserrat" | "Poppins" | "Roboto";
export type TextRole = "hook" | "headline" | "subheadline" | "body" | "cta" | "bullet" | "label";
export type TextAnimation = "fadeSlideUp" | "punchScale" | "glowPulse" | "popIn" | "fadeIn" | "none";
export type TextPosition = "top" | "bottom" | "center" | "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "centerLeft" | "centerRight";

export interface TextStyleConfig {
  /** Font family */
  fontFamily: FontFamily;
  /** Font weight 100-900 */
  fontWeight: number;
  /** Font size in px */
  fontSize: number;
  /** Letter spacing in em */
  letterSpacing: string;
  /** Line height multiplier */
  lineHeight: number;
  /** Text color */
  color: string;
  /** Text opacity 0-1 */
  opacity: number;
  /** Text transform */
  textTransform: "none" | "uppercase" | "capitalize";
  /** Text shadow CSS */
  textShadow: string;
  /** Optional gradient CSS for premium text */
  gradient?: string;
}

export interface TextAnimConfig {
  /** Animation type */
  animation: TextAnimation;
  /** Delay in frames before animation starts */
  delay: number;
  /** Spring damping */
  damping: number;
  /** Spring stiffness */
  stiffness: number;
  /** Slide distance in px (for fadeSlideUp) */
  slideDistance: number;
  /** Scale range (for punchScale) */
  scaleFrom: number;
  scaleTo: number;
}

export interface TextLayoutConfig {
  /** Where to place the text block */
  position: TextPosition;
  /** Horizontal padding (px) */
  paddingX: number;
  /** Vertical offset from position anchor (px) */
  offsetY: number;
  /** Text alignment */
  textAlign: "left" | "center" | "right";
  /** Max width (px) - prevents text from covering product */
  maxWidth: number;
}

export interface TextColorPalette {
  /** Primary text color (headlines) */
  primary: string;
  /** Secondary text color (subheadlines, body) */
  secondary: string;
  /** Accent color (CTA, highlights) */
  accent: string;
  /** Glow/shadow color */
  glow: string;
  /** High contrast for readability */
  contrast: string;
}

export interface SceneTextConfig {
  /** Full typography style */
  headline: TextStyleConfig;
  subheadline: TextStyleConfig;
  cta: TextStyleConfig;
  body: TextStyleConfig;
  /** Animation configs */
  headlineAnim: TextAnimConfig;
  subheadlineAnim: TextAnimConfig;
  ctaAnim: TextAnimConfig;
  /** Layout positioning */
  layout: TextLayoutConfig;
  /** Color palette for this scene */
  colors: TextColorPalette;
}

// ─── Constants ───────────────────────────────────────────────

export const CIN_FPS = 30;
export const CIN_WIDTH = 1080;
export const CIN_HEIGHT = 1920;

/** Scene durations in frames @ 30fps */
export const CIN_SCENE_FRAMES = {
  hook: 60,        // 2s  - bold attention grab
  problem: 90,     // 3s  - pain point / supporting text
  hero: 150,       // 5s  - main product showcase + glow
  features: 300,   // 10s - carousel of product images
  proof: 150,      // 5s  - lifestyle / social proof
  cta: 90,         // 3s  - TikTok basket CTA
} as const;

export const CIN_TOTAL_FRAMES = Object.values(CIN_SCENE_FRAMES).reduce(
  (a, b) => a + b,
  0
); // 840 frames = 28s
