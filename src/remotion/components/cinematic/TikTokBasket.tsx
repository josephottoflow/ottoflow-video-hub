/**
 * TIKTOK BASKET CTA — Yellow shopping basket affiliate button
 *
 * Replicates the TikTok Shop yellow basket UI:
 *  - Yellow (#FFE135) rounded basket icon
 *  - "Add to Cart" or custom CTA text
 *  - Bounce-in animation with pulse glow
 *  - Basket icon drawn as SVG (no external deps)
 *  - Shine sweep across button
 *  - Optional price tag
 */
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ThemeConfig } from "../../engine/types";

// TikTok Shop yellow
const BASKET_YELLOW = "#FFE135";
const BASKET_ORANGE = "#FF8C00";
const BASKET_DARK = "#1A1A1A";

interface TikTokBasketProps {
  /** CTA text — default "Add to Cart" */
  text?: string;
  /** Optional price display */
  price?: string;
  /** Theme for glow effects */
  theme: ThemeConfig;
  /** Delay before animation starts (frames) */
  delay?: number;
  /** Style variant — basket (default) or shop-now bag icon */
  variant?: "basket" | "shop-now";
}

/**
 * SVG Shopping Basket Icon — TikTok style
 */
const BasketIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Basket body */}
    <path
      d="M4 8h16l-1.5 9a2 2 0 01-2 1.7H7.5a2 2 0 01-2-1.7L4 8z"
      fill={BASKET_DARK}
      stroke={BASKET_YELLOW}
      strokeWidth="1.5"
    />
    {/* Handle */}
    <path
      d="M8 8V6a4 4 0 018 0v2"
      stroke={BASKET_YELLOW}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
    />
    {/* Plus sign */}
    <path d="M12 12v4M10 14h4" stroke={BASKET_YELLOW} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

/**
 * Cart/Shopping bag icon — alternative style
 */
const ShopBagIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="7" width="18" height="14" rx="2" fill={BASKET_DARK} stroke={BASKET_YELLOW} strokeWidth="1.5" />
    <path d="M8 7V5a4 4 0 018 0v2" stroke={BASKET_YELLOW} strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

export const TikTokBasket: React.FC<TikTokBasketProps> = ({
  text = "Add to Cart",
  price,
  theme,
  delay = 20,
  variant = "basket",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animFrame = Math.max(0, frame - delay);

  // Bounce-in entry
  const entry = spring({
    frame: animFrame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.8 },
  });

  // Scale from below
  const scaleY = interpolate(entry, [0, 1], [0.3, 1]);
  const slideUp = interpolate(entry, [0, 1], [60, 0]);

  // Pulse glow cycle (50-frame loop)
  const pulse = interpolate(animFrame % 50, [0, 25, 50], [1, 1.05, 1], { extrapolateRight: "clamp" });

  // Shine sweep
  const shine = interpolate(animFrame, [15, 55], [-250, 700], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Basket icon bounce (slight delay after button)
  const iconBounce = spring({
    frame: Math.max(0, animFrame - 8),
    fps,
    config: { damping: 6, stiffness: 300 },
  });

  // Price tag slide-in
  const priceEntry = spring({
    frame: Math.max(0, animFrame - 15),
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  if (frame < delay) return null;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16,
      transform: `translateY(${slideUp}px)`,
      opacity: entry,
    }}>
      {/* Price tag (optional) */}
      {price && (
        <div style={{
          fontSize: 36,
          fontWeight: 800,
          color: BASKET_YELLOW,
          fontFamily: "'Inter', sans-serif",
          textShadow: `0 0 30px ${BASKET_YELLOW}40, 0 4px 15px rgba(0,0,0,0.5)`,
          opacity: priceEntry,
          transform: `translateY(${(1 - priceEntry) * 20}px)`,
          letterSpacing: "-0.02em",
        }}>
          {price}
        </div>
      )}

      {/* Main CTA button — TikTok yellow */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "18px 48px",
        borderRadius: 50,
        background: `linear-gradient(135deg, ${BASKET_YELLOW}, ${BASKET_ORANGE})`,
        transform: `scaleY(${scaleY}) scale(${entry * pulse})`,
        position: "relative",
        overflow: "hidden",
        boxShadow: `
          0 8px 30px ${BASKET_YELLOW}50,
          0 0 60px ${BASKET_YELLOW}20,
          inset 0 1px 0 rgba(255,255,255,0.3)
        `,
      }}>
        {/* Basket icon */}
        <div style={{
          transform: `scale(${iconBounce})`,
          display: "flex",
          alignItems: "center",
        }}>
          {variant === "basket" ? <BasketIcon size={32} /> : <ShopBagIcon size={32} />}
        </div>

        {/* CTA text */}
        <span style={{
          fontSize: 28,
          fontWeight: 800,
          color: BASKET_DARK,
          fontFamily: "'Inter', system-ui, sans-serif",
          letterSpacing: "0.02em",
          textTransform: "uppercase" as const,
          position: "relative",
          zIndex: 1,
        }}>
          {text}
        </span>

        {/* Shine sweep */}
        <div style={{
          position: "absolute",
          top: 0,
          left: shine,
          width: 100,
          height: "100%",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
          transform: "skewX(-20deg)",
          zIndex: 2,
        }} />
      </div>

      {/* "TikTok Shop" label beneath */}
      {variant === "basket" && (
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          fontFamily: "'Inter', sans-serif",
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          opacity: priceEntry,
          marginTop: -4,
        }}>
          TikTok Shop
        </div>
      )}

    </div>
  );
};
