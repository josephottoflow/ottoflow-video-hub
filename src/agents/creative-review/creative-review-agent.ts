/**
 * CREATIVE DIRECTOR REVIEW AGENT — Pre-render content quality gate
 *
 * Evaluates video data BEFORE rendering to catch:
 *   - Weak hooks (generic, too long, not emotional)
 *   - Off-brand colors / themes
 *   - Poor text quality (long, fluffy, not benefit-driven)
 *   - Image issues (too few, no variation, wrong order)
 *   - Layout / readability concerns
 *   - Pacing / scene flow problems
 *
 * Returns a strict JSON verdict: approved (score 7+) or revise (score <7)
 * with specific issues and suggested fixes.
 *
 * Usage:
 *   const result = creativeReview(videoProps);
 *   if (result.status === "revise") { applyFixes(result.fixes); }
 */

import type { CinematicVideoProps, ThemePreset } from "../../remotion/engine/types";

// ─── TikTok Affiliate Marketing Policy ────────────────────
// Source: https://seller-us.tiktok.com/university/essay?knowledge_id=2244964886103809
//
// Key rules enforced in this agent:
//   1. NO "Link in Bio" — affiliates use TikTok's yellow basket (product link
//      is attached directly to the video). Any mention of bio links, external
//      URLs, or off-platform redirection violates affiliate policy.
//   2. CTA must drive to TikTok Shop basket — not external sites.
//   3. Product claims must be substantiable — no "best", "#1", "guaranteed"
//      without proof (fair trading policy / IP violations risk disqualification).
//   4. No misleading pricing — price shown must match TikTok Shop listing.
//   5. No prohibited content cues — counterfeit signals, health claims without
//      disclaimers, or "limited stock" pressure tactics that violate fair trading.
//   6. Creator content quality — TikTok requires "sustained ability to create
//      high quality content" for affiliate eligibility; low-effort videos risk
//      creator disqualification.
//   7. Shop Performance Score must stay ≥ 3.5 — poor product representation
//      in videos (misleading images, wrong color, exaggerated features) drives
//      negative reviews which tank SPS and trigger affiliate disqualification.
//   8. Negative Review Rate — product NRR > 2x category average = warning,
//      > 3x = disqualification. Videos must accurately represent the product.

/** Phrases that violate TikTok affiliate policy (off-platform redirection) */
const AFFILIATE_BANNED_PHRASES = [
  "link in bio",
  "link in description",
  "check bio",
  "tap bio",
  "visit our website",
  "go to our site",
  "use code",
  "discount code",
  "promo code",
  "coupon code",
  "swipe up",
  "click the link",
  "dm to order",
  "dm for price",
  "comment to buy",
  "whatsapp",
  "telegram order",
];

/** Claims that risk fair trading / IP violations without substantiation */
const UNSUBSTANTIATED_CLAIM_PATTERNS = [
  /\b#1\b/i,
  /\bnumber one\b/i,
  /\bbest[\s-]selling\b/i,
  /\bguaranteed\b/i,
  /\bclinically[\s-]proven\b/i,
  /\bfda[\s-]approved\b/i,
  /\bdoctor[\s-]recommended\b/i,
  /\bcures?\b/i,
  /\btreat(?:s|ment)?\b/i,
  /\bonly\s+\d+\s+left\b/i,
  /\blimited\s+stock\b/i,
  /\bbuy\s+before\s+(?:it's|its)\s+gone\b/i,
  /\bselling\s+out\s+fast\b/i,
  /\boriginal\s+(?:brand|product)\b/i,
  /\bauthentic\s+(?:brand|product)\b/i,
];

// ─── Brand Constants ───────────────────────────────────────

const BRAND = {
  background: "#0B0B0F",
  accentPurple: "#6A4BFF",
  accentBlue: "#4BC9FE",
  textWhite: "#F7F7FB",
  /** Approved theme presets for premium look */
  approvedThemes: ["tech", "luxury", "minimal", "neon"] as ThemePreset[],
  /** Themes that need extra scrutiny */
  riskyThemes: ["bold", "outdoor"] as ThemePreset[],
} as const;

// ─── Types ─────────────────────────────────────────────────

export interface CreativeReviewResult {
  status: "approved" | "revise";
  score: number;
  issues: string[];
  fixes: {
    hook?: string;
    headline?: string;
    subheadline?: string;
    problemText?: string;
    cta?: string;
  };
  breakdown: {
    hook: number;
    brand: number;
    text: number;
    images: number;
    layout: number;
    flow: number;
    affiliate: number;
  };
}

interface HookAnalysis {
  score: number;
  issues: string[];
  suggested?: string;
}

interface TextAnalysis {
  score: number;
  issues: string[];
  fixes: Record<string, string>;
}

// ─── Hook Evaluator ────────────────────────────────────────

/** Words that signal generic / weak hooks */
const WEAK_HOOK_WORDS = [
  "best", "amazing", "great", "awesome", "incredible", "perfect",
  "high quality", "top rated", "number one", "premium quality",
  "buy now", "check out", "new arrival", "hot sale",
];

/** Patterns that indicate strong emotional/problem hooks */
const STRONG_HOOK_PATTERNS = [
  /^stop\s/i,
  /^you['']?re\s/i,
  /^don['']?t\s/i,
  /^why\s/i,
  /^how\s/i,
  /^tired\sof/i,
  /^still\s/i,
  /^never\s/i,
  /^this\s(changed|fixed|solved)/i,
  /^wait\s/i,
  /^imagine\s/i,
  /\?$/,
  /^i\s(wish|can't|couldn't)/i,
  /^what\sif/i,
  /^the\s(secret|truth|problem|reason)/i,
];

function evaluateHook(hook: string): HookAnalysis {
  const issues: string[] = [];
  let score = 10;
  const words = hook.trim().split(/\s+/);
  const wordCount = words.length;

  // ── Length check (3-6 words ideal) ──
  if (wordCount < 3) {
    issues.push(`Hook too short (${wordCount} words) — needs 3-6 words for impact`);
    score -= 2;
  } else if (wordCount > 6) {
    issues.push(`Hook too long (${wordCount} words) — trim to 3-6 words max`);
    score -= Math.min(4, wordCount - 6); // penalize harder as it gets longer
  }

  // ── Weak / generic language ──
  const hookLower = hook.toLowerCase();
  const foundWeak = WEAK_HOOK_WORDS.filter((w) => hookLower.includes(w));
  if (foundWeak.length > 0) {
    issues.push(`Generic hook language: "${foundWeak.join('", "')}" — rewrite with emotion or problem`);
    score -= 3;
  }

  // ── Emotional / problem-based check ──
  const hasStrongPattern = STRONG_HOOK_PATTERNS.some((p) => p.test(hook));
  if (!hasStrongPattern) {
    issues.push("Hook lacks emotional trigger or problem framing — should stop scrolling instantly");
    score -= 2;
  }

  // ── All caps check (good for hooks) ──
  const isAllCaps = hook === hook.toUpperCase() && hook !== hook.toLowerCase();
  if (!isAllCaps && wordCount <= 6) {
    // Not an issue, just noting — uppercase is preferred for hooks but not required
  }

  // ── Generate fix if score is low ──
  let suggested: string | undefined;
  if (score < 7) {
    suggested = generateHookFix(hook);
  }

  return { score: Math.max(1, Math.min(10, score)), issues, suggested };
}

function generateHookFix(original: string): string {
  const lower = original.toLowerCase();

  // Try to extract the core product/benefit
  const productWords = lower
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => !["the", "a", "an", "is", "are", "was", "for", "and", "or", "this", "that", "with", "your", "our", "my", "best", "great", "amazing", "high", "quality", "top", "new"].includes(w));

  if (productWords.length > 0) {
    const core = productWords.slice(0, 2).join(" ");
    const templates = [
      `Stop Settling For Less`,
      `You Need This ${capitalize(core)}`,
      `Still Using That Old ${capitalize(core)}?`,
      `This Changes Everything`,
      `Why Nobody Told You This`,
    ];
    // Pick based on original length to get variety
    return templates[original.length % templates.length];
  }

  return "Stop Scrolling — Watch This";
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Text Quality Evaluator ───────────────────────────────

function evaluateText(props: CinematicVideoProps): TextAnalysis {
  const issues: string[] = [];
  const fixes: Record<string, string> = {};
  let score = 10;

  // ── Headline ──
  const headlineWords = props.headline.trim().split(/\s+/).length;
  if (headlineWords > 5) {
    issues.push(`Headline too long (${headlineWords} words) — keep to 2-5 words`);
    score -= 2;
    fixes.headline = props.headline.split(/\s+/).slice(0, 4).join(" ");
  }
  if (/[.!]{2,}|!!!/.test(props.headline)) {
    issues.push("Headline has excessive punctuation — looks spammy");
    score -= 1;
  }

  // ── Subheadline ──
  const subWords = props.subheadline.trim().split(/\s+/).length;
  if (subWords > 10) {
    issues.push(`Subheadline too wordy (${subWords} words) — condense to max 8-10`);
    score -= 1;
  }
  if (subWords < 3) {
    issues.push("Subheadline too vague — add a specific benefit");
    score -= 1;
  }

  // ── Problem text ──
  if (props.problemText) {
    if (!props.problemText.includes("?") && !STRONG_HOOK_PATTERNS.some((p) => p.test(props.problemText!))) {
      issues.push("Problem text should be a question or emotional statement");
      score -= 1;
    }
    const problemWords = props.problemText.split(/\s+/).length;
    if (problemWords > 12) {
      issues.push(`Problem text too long (${problemWords} words) — keep under 10`);
      score -= 1;
    }
  }

  // ── CTA ──
  const ctaLower = props.cta.toLowerCase();
  if (ctaLower.length > 30) {
    issues.push("CTA too long — should be punchy (under 25 chars)");
    score -= 1;
    fixes.cta = "Shop Now";
  }
  if (!ctaLower.includes("shop") && !ctaLower.includes("buy") && !ctaLower.includes("get") && !ctaLower.includes("order") && !ctaLower.includes("grab") && !ctaLower.includes("add")) {
    issues.push("CTA missing action verb — needs 'Shop', 'Get', 'Buy', 'Add', or 'Order'");
    score -= 1;
  }

  // ── Bullet points (if present) ──
  if (props.bulletPoints && props.bulletPoints.length > 0) {
    for (const bullet of props.bulletPoints) {
      if (bullet.split(/\s+/).length > 6) {
        issues.push(`Bullet too long: "${bullet}" — max 6 words`);
        score -= 0.5;
      }
    }
    if (props.bulletPoints.length > 4) {
      issues.push(`Too many bullets (${props.bulletPoints.length}) — max 3-4 for readability`);
      score -= 1;
    }
  }

  return { score: Math.max(1, Math.min(10, score)), issues, fixes };
}

// ─── Brand Evaluator ──────────────────────────────────────

function evaluateBrand(props: CinematicVideoProps): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10;

  // ── Theme check ──
  if (BRAND.riskyThemes.includes(props.theme)) {
    issues.push(`Theme "${props.theme}" may look too casual — consider "tech" or "luxury" for premium feel`);
    score -= 1;
  }

  // ── Color hint contrast ──
  if (props.colorHint) {
    const lum = hexLuminance(props.colorHint);
    if (lum < 0.05) {
      issues.push("colorHint too dark — will be invisible on #0B0B0F background");
      score -= 3;
    }
    if (lum > 0.85) {
      issues.push("colorHint near-white — won't create contrast against text");
      score -= 1;
    }
  }

  // ── CTA style check ──
  if (props.ctaStyle === "classic") {
    issues.push("Classic CTA button is off-brand for TikTok — use tiktok-basket");
    score -= 1;
  }

  return { score: Math.max(1, Math.min(10, score)), issues };
}

function hexLuminance(hex: string): number {
  const c = hex.replace("#", "");
  if (c.length < 6) return 0.5; // can't parse, assume mid
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  const toLinear = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

// ─── Image Evaluator ──────────────────────────────────────

function evaluateImages(props: CinematicVideoProps): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10;
  const count = props.images.length;

  // ── Count ──
  if (count === 0) {
    issues.push("CRITICAL: No images provided — video will be empty");
    return { score: 1, issues };
  }
  if (count === 1) {
    issues.push("Only 1 image — needs minimum 3-4 for scene variety (hero, detail, lifestyle)");
    score -= 3;
  } else if (count === 2) {
    issues.push("Only 2 images — features and proof scenes will repeat the same images");
    score -= 2;
  } else if (count > 8) {
    issues.push(`${count} images is excessive — engine selects best 6, but noisy input may pick wrong ones`);
    score -= 1;
  }

  // ── Duplicate detection ──
  const unique = new Set(props.images);
  if (unique.size < count) {
    const dupes = count - unique.size;
    issues.push(`${dupes} duplicate image path(s) — remove duplicates before render`);
    score -= 2;
  }

  // ── Format check ──
  const badFormats = props.images.filter((img) => {
    const ext = img.split(".").pop()?.toLowerCase() || "";
    return !["png", "jpg", "jpeg", "webp"].includes(ext) && !img.startsWith("http");
  });
  if (badFormats.length > 0) {
    issues.push(`Unsupported image format(s): ${badFormats.map((f) => f.split("/").pop()).join(", ")}`);
    score -= 1;
  }

  // ── Background images ──
  if (!props.backgroundImages || props.backgroundImages.length === 0) {
    issues.push("No background images/videos — scenes will have flat dark backgrounds");
    score -= 1;
  } else if (props.backgroundImages.length < 3) {
    issues.push("Fewer than 3 backgrounds — some scenes will reuse the same background");
    score -= 0.5;
  }

  return { score: Math.max(1, Math.min(10, score)), issues };
}

// ─── Layout Evaluator ─────────────────────────────────────

function evaluateLayout(props: CinematicVideoProps): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10;

  // ── Text length vs mobile readability ──
  if (props.headline.length > 25) {
    issues.push("Headline over 25 chars — may wrap awkwardly on 1080px portrait");
    score -= 1;
  }

  // ── Bullet + image overlap risk ──
  if (props.bulletPoints && props.bulletPoints.length > 0 && props.images.length >= 4) {
    const longBullets = props.bulletPoints.filter((b) => b.length > 30);
    if (longBullets.length > 0) {
      issues.push("Long bullet text may overlap product images in Features scene");
      score -= 1;
    }
  }

  // ── Social proof presence ──
  if (!props.socialProof) {
    issues.push("No social proof data — Proof scene will lack credibility number");
    score -= 1;
  } else {
    if (props.socialProof.number < 100) {
      issues.push(`Social proof number (${props.socialProof.number}) is too low — looks unconvincing`);
      score -= 1;
    }
    if (props.socialProof.label.split(/\s+/).length > 4) {
      issues.push("Social proof label too long — keep to 2-3 words");
      score -= 0.5;
    }
  }

  return { score: Math.max(1, Math.min(10, score)), issues };
}

// ─── Flow / Pacing Evaluator ──────────────────────────────

function evaluateFlow(props: CinematicVideoProps): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10;

  // ── Hook → Problem coherence ──
  if (props.problemText) {
    // Problem should relate to headline
    const headlineLower = props.headline.toLowerCase();
    const problemLower = props.problemText.toLowerCase();
    const headlineWords = headlineLower.split(/\s+/).filter((w) => w.length > 3);
    const hasOverlap = headlineWords.some((w) => problemLower.includes(w));
    if (!hasOverlap) {
      issues.push("Problem text doesn't reference the product — viewer may feel disconnected");
      score -= 1;
    }
  } else {
    // Auto-generated problem text is fine, but flag if headline is also generic
    const headlineLower = props.headline.toLowerCase();
    if (WEAK_HOOK_WORDS.some((w) => headlineLower.includes(w))) {
      issues.push("No custom problemText + generic headline = weak Problem scene");
      score -= 1;
    }
  }

  // ── Enough content for 28s ──
  const contentSignals = [
    props.images.length >= 3,
    !!props.socialProof,
    props.bulletPoints && props.bulletPoints.length > 0,
    !!props.problemText,
    !!props.price,
  ].filter(Boolean).length;

  if (contentSignals < 3) {
    issues.push("Sparse content for 28s video — some scenes may feel empty or repetitive");
    score -= 2;
  }

  return { score: Math.max(1, Math.min(10, score)), issues };
}

// ─── TikTok Affiliate Compliance Evaluator ───────────────

/**
 * Evaluates video props against TikTok's Affiliate Marketing Policy.
 * Catches: off-platform redirection, unsubstantiated claims, misleading
 * pricing, pressure tactics, and content quality signals that risk
 * affiliate disqualification or enforcement action.
 *
 * Policy: https://seller-us.tiktok.com/university/essay?knowledge_id=2244964886103809
 */
function evaluateAffiliateCompliance(props: CinematicVideoProps): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10;

  // Collect all text fields to scan
  const allText = [
    props.headline,
    props.subheadline,
    props.cta,
    props.problemText || "",
    ...(props.bulletPoints || []),
  ].join(" ").toLowerCase();

  // ── 1. Off-platform redirection (CRITICAL — violates affiliate terms) ──
  const bannedFound = AFFILIATE_BANNED_PHRASES.filter((phrase) => allText.includes(phrase));
  if (bannedFound.length > 0) {
    issues.push(`AFFILIATE VIOLATION: Off-platform redirection detected — "${bannedFound.join('", "')}" — TikTok affiliates must use the yellow basket, never redirect off-platform`);
    score -= 5; // severe penalty
  }

  // ── 2. CTA must point to TikTok Shop (not external) ──
  const ctaLower = props.cta.toLowerCase();
  if (ctaLower.includes("website") || ctaLower.includes("http") || ctaLower.includes(".com") || ctaLower.includes("bio")) {
    issues.push("AFFILIATE VIOLATION: CTA references external destination — must use TikTok Shop basket only");
    score -= 4;
  }
  if (props.ctaStyle !== "tiktok-basket") {
    issues.push("Affiliate videos should use ctaStyle 'tiktok-basket' — the yellow basket is the purchase mechanism");
    score -= 2;
  }

  // ── 3. Unsubstantiated claims (fair trading / IP violation risk) ──
  const claimsFound = UNSUBSTANTIATED_CLAIM_PATTERNS.filter((p) => p.test(allText));
  if (claimsFound.length > 0) {
    // Extract the matched text for the warning
    const matches: string[] = [];
    for (const pattern of claimsFound) {
      const m = allText.match(pattern);
      if (m) matches.push(m[0]);
    }
    issues.push(`Fair trading risk: Unsubstantiated claims — "${matches.join('", "')}" — these can trigger IP/fair trading violations which disqualify products from affiliate marketing`);
    score -= Math.min(3, claimsFound.length);
  }

  // ── 4. Misleading pricing signals ──
  if (props.price) {
    const priceStr = props.price.toLowerCase();
    if (priceStr.includes("free") || priceStr.includes("$0")) {
      issues.push("Price shown as free/$0 — if product has a cost on TikTok Shop, this is misleading and risks negative reviews (NRR spike → affiliate disqualification)");
      score -= 3;
    }
    // Check for fake discount patterns
    if (/was\s*\$\d+/i.test(allText) || /\d+%\s*off/i.test(allText)) {
      issues.push("Discount/sale claims in video must match actual TikTok Shop pricing — mismatches drive negative reviews and risk affiliate disqualification");
      score -= 1;
    }
  }

  // ── 5. Pressure / scarcity tactics (violate fair trading) ──
  if (/only\s+\d+\s+left/i.test(allText) || /selling\s+out/i.test(allText) || /last\s+chance/i.test(allText) || /hurry/i.test(allText)) {
    issues.push("Artificial scarcity/pressure tactics violate TikTok Shop fair trading policy — remove urgency language unless backed by real inventory data");
    score -= 2;
  }

  // ── 6. Content quality signals (creator eligibility) ──
  // TikTok requires "sustained ability to create high quality content"
  const totalTextLength = allText.trim().length;
  if (totalTextLength < 20) {
    issues.push("Very sparse text content — TikTok requires high-quality content for affiliate eligibility; add meaningful product information");
    score -= 1;
  }
  if (props.images.length < 2) {
    issues.push("Minimal imagery — low-effort affiliate content risks creator disqualification (Performance Score drop)");
    score -= 1;
  }

  // ── 7. Product representation accuracy (NRR prevention) ──
  // Can't fully check without actual product data, but flag common risks
  if (props.headline.toUpperCase() === props.headline && props.headline.length > 10) {
    issues.push("ALL CAPS headline may appear spammy — clean presentation protects Shop Performance Score and prevents negative reviews");
    score -= 0.5;
  }

  return { score: Math.max(1, Math.min(10, score)), issues };
}

// ─── Main Review Function ─────────────────────────────────

/**
 * Run a full Creative Director review on video props before render.
 *
 * Returns structured verdict with score, issues, and fixes.
 * Score 7+ = approved, <7 = revise.
 */
export function creativeReview(props: CinematicVideoProps): CreativeReviewResult {
  // Run all evaluators
  const hookResult = evaluateHook(props.headline);
  const textResult = evaluateText(props);
  const brandResult = evaluateBrand(props);
  const imageResult = evaluateImages(props);
  const layoutResult = evaluateLayout(props);
  const flowResult = evaluateFlow(props);
  const affiliateResult = evaluateAffiliateCompliance(props);

  // Aggregate issues
  const allIssues = [
    ...hookResult.issues,
    ...textResult.issues,
    ...brandResult.issues,
    ...imageResult.issues,
    ...layoutResult.issues,
    ...flowResult.issues,
    ...affiliateResult.issues,
  ];

  // Build fixes
  const fixes: CreativeReviewResult["fixes"] = {};
  if (hookResult.suggested) fixes.hook = hookResult.suggested;
  if (textResult.fixes.headline) fixes.headline = textResult.fixes.headline;
  if (textResult.fixes.subheadline) fixes.subheadline = textResult.fixes.subheadline;
  if (textResult.fixes.cta) fixes.cta = textResult.fixes.cta;
  if (textResult.fixes.problemText) fixes.problemText = textResult.fixes.problemText;

  // Weighted score (hook matters most for TikTok, affiliate compliance is critical)
  const weights = {
    hook: 0.20,
    brand: 0.10,
    text: 0.15,
    images: 0.10,
    layout: 0.10,
    flow: 0.10,
    affiliate: 0.25, // highest weight — policy violations = account death
  };

  const breakdown = {
    hook: hookResult.score,
    brand: brandResult.score,
    text: textResult.score,
    images: imageResult.score,
    layout: layoutResult.score,
    flow: flowResult.score,
    affiliate: affiliateResult.score,
  };

  const weightedScore =
    breakdown.hook * weights.hook +
    breakdown.brand * weights.brand +
    breakdown.text * weights.text +
    breakdown.images * weights.images +
    breakdown.layout * weights.layout +
    breakdown.flow * weights.flow +
    breakdown.affiliate * weights.affiliate;

  const finalScore = Math.round(weightedScore * 10) / 10;

  return {
    status: finalScore >= 7 ? "approved" : "revise",
    score: finalScore,
    issues: allIssues,
    fixes,
    breakdown,
  };
}

/**
 * Apply fixes from a review result back to props.
 * Returns a new props object with fixes applied (does NOT mutate original).
 */
export function applyCreativeFixes(
  props: CinematicVideoProps,
  fixes: CreativeReviewResult["fixes"],
): CinematicVideoProps {
  return {
    ...props,
    headline: fixes.headline || props.headline,
    subheadline: fixes.subheadline || props.subheadline,
    problemText: fixes.problemText || props.problemText,
    cta: fixes.cta || props.cta,
  };
}

/**
 * Run review → apply fixes → re-review loop (max 2 iterations).
 * Returns final props + final review result.
 */
export function reviewAndFix(
  props: CinematicVideoProps,
  maxIterations: number = 2,
): { props: CinematicVideoProps; review: CreativeReviewResult; iterations: number } {
  let current = { ...props };
  let review = creativeReview(current);
  let iterations = 1;

  while (review.status === "revise" && iterations < maxIterations) {
    // Apply suggested fixes
    if (Object.keys(review.fixes).length > 0) {
      current = applyCreativeFixes(current, review.fixes);
    } else {
      break; // No auto-fixes available, needs human input
    }
    review = creativeReview(current);
    iterations++;
  }

  return { props: current, review, iterations };
}

/**
 * Quick pass/fail check — returns true if props would pass review.
 */
export function quickCheck(props: CinematicVideoProps): boolean {
  return creativeReview(props).status === "approved";
}

/**
 * Log review result to console in a readable format.
 */
export function logReview(result: CreativeReviewResult): void {
  const icon = result.status === "approved" ? "✅" : "🔴";
  console.log(`\n${icon} CREATIVE REVIEW: ${result.status.toUpperCase()} (${result.score}/10)`);
  console.log("─".repeat(50));

  console.log("Breakdown:");
  for (const [key, val] of Object.entries(result.breakdown)) {
    const bar = "█".repeat(Math.round(val)) + "░".repeat(10 - Math.round(val));
    console.log(`  ${key.padEnd(8)} ${bar} ${val}/10`);
  }

  if (result.issues.length > 0) {
    console.log(`\nIssues (${result.issues.length}):`);
    for (const issue of result.issues) {
      console.log(`  ⚠ ${issue}`);
    }
  }

  if (Object.keys(result.fixes).length > 0) {
    console.log("\nSuggested Fixes:");
    for (const [key, val] of Object.entries(result.fixes)) {
      console.log(`  ${key}: "${val}"`);
    }
  }

  console.log("─".repeat(50));
}
