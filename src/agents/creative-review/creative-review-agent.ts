/**
 * CREATIVE DIRECTOR REVIEW AGENT — Pre-render content quality gate
 *
 * Evaluates ProductVideoData BEFORE rendering to catch:
 *   - Weak hooks (generic, too long, not emotional)
 *   - Poor text quality (long, fluffy, not benefit-driven)
 *   - Feature callout issues (too few, too generic)
 *   - Missing visual backgrounds (Pexels)
 *   - Pacing / scene flow problems
 *
 * Returns a strict JSON verdict: approved (score 7+) or revise (score <7)
 * with specific issues and suggested fixes.
 */

import type { ProductVideoData } from "../../remotion/types";

// ─── Weak Hook Patterns ───────────────────────────────────────

const WEAK_HOOK_WORDS = [
  "amazing", "great", "awesome", "incredible", "perfect",
  "high quality", "top rated", "number one", "premium quality",
  "check out", "new arrival",
];

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

// ─── Types ────────────────────────────────────────────────────

export interface CreativeReviewResult {
  status: "approved" | "revise";
  score: number;
  issues: string[];
  fixes: {
    hook?: string;
    tagline?: string;
    cta?: string;
  };
  breakdown: {
    hook: number;
    content: number;
    features: number;
    visuals: number;
    flow: number;
  };
}

// ─── Hook Evaluator ───────────────────────────────────────────

function evaluateHook(hook: string): { score: number; issues: string[]; suggested?: string } {
  const issues: string[] = [];
  let score = 10;
  const words = hook.trim().split(/\s+/);

  if (words.length < 3) {
    issues.push(`Hook too short (${words.length} words) — needs 3-8 words for impact`);
    score -= 2;
  } else if (words.length > 12) {
    issues.push(`Hook too long (${words.length} words) — trim for better retention`);
    score -= 2;
  }

  const hookLower = hook.toLowerCase();
  const foundWeak = WEAK_HOOK_WORDS.filter((w) => hookLower.includes(w));
  if (foundWeak.length > 0) {
    issues.push(`Generic hook language: "${foundWeak.join('", "')}" — rewrite with emotion or a problem`);
    score -= 3;
  }

  const hasStrongPattern = STRONG_HOOK_PATTERNS.some((p) => p.test(hook));
  if (!hasStrongPattern) {
    issues.push("Hook lacks emotional trigger or problem framing — needs to stop scrolling instantly");
    score -= 2;
  }

  let suggested: string | undefined;
  if (score < 7) suggested = generateHookFix(hook);

  return { score: Math.max(1, Math.min(10, score)), issues, suggested };
}

function generateHookFix(original: string): string {
  const lower = original.toLowerCase();
  const productWords = lower
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => !["the", "a", "an", "is", "are", "for", "and", "or", "this", "that", "with", "your", "best", "great", "amazing"].includes(w));

  if (productWords.length > 0) {
    const core = productWords.slice(0, 2).join(" ");
    const templates = [
      `Stop Settling For Less`,
      `You Need To Know This About ${capitalize(core)}`,
      `Still Struggling With ${capitalize(core)}?`,
      `This Changes Everything`,
      `Why Nobody Talks About This`,
    ];
    return templates[original.length % templates.length];
  }
  return "Stop Scrolling — Watch This";
}

function capitalize(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Content Quality Evaluator ────────────────────────────────

function evaluateContent(data: ProductVideoData): { score: number; issues: string[]; fixes: Record<string, string> } {
  const issues: string[] = [];
  const fixes: Record<string, string> = {};
  let score = 10;

  // Tagline
  const tagline = data.productIntro.tagline || "";
  const taglineWords = tagline.trim().split(/\s+/).length;
  if (taglineWords > 12) {
    issues.push(`Tagline too long (${taglineWords} words) — keep to 8-10 words max`);
    score -= 2;
    fixes.tagline = tagline.split(/\s+/).slice(0, 8).join(" ");
  }
  if (taglineWords < 2) {
    issues.push("Tagline too vague — add a specific benefit or value statement");
    score -= 2;
  }

  // Demo result text
  const resultText = data.simulatedDemo.resultText || "";
  if (resultText.length > 80) {
    issues.push(`Demo result text too long (${resultText.length} chars) — keep under 60 for readability`);
    score -= 1;
  }

  // CTA
  const ctaUrl = data.socialProofCta.ctaUrl || "";
  if (ctaUrl.length > 50) {
    issues.push("CTA text too long — keep it punchy (under 40 chars)");
    score -= 1;
    fixes.cta = "Follow for more";
  }
  if (!ctaUrl.trim()) {
    issues.push("Missing CTA — add a call to action");
    score -= 2;
  }

  return { score: Math.max(1, Math.min(10, score)), issues, fixes };
}

// ─── Feature Callout Evaluator ────────────────────────────────

function evaluateFeatures(data: ProductVideoData): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10;

  const features = data.featureCallouts.features || [];

  if (features.length === 0) {
    issues.push("CRITICAL: No feature callouts — Feature scene will be empty");
    return { score: 1, issues };
  }
  if (features.length === 1) {
    issues.push("Only 1 feature — add at least 2-3 key points for persuasion");
    score -= 3;
  } else if (features.length > 4) {
    issues.push(`${features.length} features is too many — max 4 for mobile readability`);
    score -= 1;
  }

  for (const f of features) {
    const wordCount = f.text.trim().split(/\s+/).length;
    if (wordCount > 8) {
      issues.push(`Feature too verbose: "${f.text}" — max 7 words`);
      score -= 1;
    }
    if (wordCount < 2) {
      issues.push(`Feature too vague: "${f.text}" — needs more detail`);
      score -= 1;
    }
  }

  return { score: Math.max(1, Math.min(10, score)), issues };
}

// ─── Visual Completeness Evaluator ───────────────────────────

function evaluateVisuals(data: ProductVideoData): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10;

  const backgrounds = data.backgrounds;
  const photoCount = backgrounds?.photos?.length ?? 0;
  const videoCount = backgrounds?.videos?.length ?? 0;

  if (photoCount === 0 && videoCount === 0) {
    issues.push("No background media — fetch Pexels images for visual scenes before rendering");
    score -= 3;
  } else if (photoCount < 3) {
    issues.push(`Only ${photoCount} background photo(s) — scenes may reuse the same background`);
    score -= 1;
  }

  const showcaseImages = data.imageShowcase.images || [];
  if (showcaseImages.length === 0) {
    issues.push("Image Showcase scene has no images — it will be empty");
    score -= 3;
  }

  for (const img of showcaseImages) {
    const wordCount = img.headline.trim().split(/\s+/).length;
    if (wordCount > 6) {
      issues.push(`Showcase headline too long: "${img.headline}" — max 5 words`);
      score -= 0.5;
    }
  }

  return { score: Math.max(1, Math.min(10, score)), issues };
}

// ─── Flow / Pacing Evaluator ──────────────────────────────────

function evaluateFlow(data: ProductVideoData): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10;

  // Check hook-to-tagline coherence
  const hookLower = (data.hook.painPointQuestion || "").toLowerCase();
  const taglineLower = (data.productIntro.tagline || "").toLowerCase();
  const topicLower = (data.productIntro.productName || "").toLowerCase();

  const topicWords = topicLower.split(/\s+/).filter((w) => w.length > 3);
  const hookRelated = topicWords.some((w) => hookLower.includes(w) || taglineLower.includes(w));
  if (!hookRelated && topicWords.length > 0) {
    issues.push("Hook and tagline don't reference the topic — viewer may feel disconnected between scenes");
    score -= 2;
  }

  // Content signals for 25s video
  const contentSignals = [
    (data.featureCallouts.features || []).length >= 2,
    (data.imageShowcase.images || []).length >= 2,
    !!(data.simulatedDemo.resultText),
    !!(data.socialProofCta.ctaUrl),
    !!(data.socialProofCta.socialProofNumber),
  ].filter(Boolean).length;

  if (contentSignals < 3) {
    issues.push("Sparse content for a 25s video — some scenes may feel thin");
    score -= 2;
  }

  return { score: Math.max(1, Math.min(10, score)), issues };
}

// ─── Main Review Function ─────────────────────────────────────

export function creativeReview(data: ProductVideoData): CreativeReviewResult {
  const hookResult    = evaluateHook(data.hook.painPointQuestion || "");
  const contentResult = evaluateContent(data);
  const featureResult = evaluateFeatures(data);
  const visualResult  = evaluateVisuals(data);
  const flowResult    = evaluateFlow(data);

  const allIssues = [
    ...hookResult.issues,
    ...contentResult.issues,
    ...featureResult.issues,
    ...visualResult.issues,
    ...flowResult.issues,
  ];

  const fixes: CreativeReviewResult["fixes"] = {};
  if (hookResult.suggested)            fixes.hook    = hookResult.suggested;
  if (contentResult.fixes.tagline)     fixes.tagline = contentResult.fixes.tagline;
  if (contentResult.fixes.cta)         fixes.cta     = contentResult.fixes.cta;

  const weights = { hook: 0.30, content: 0.25, features: 0.20, visuals: 0.15, flow: 0.10 };

  const breakdown = {
    hook:     hookResult.score,
    content:  contentResult.score,
    features: featureResult.score,
    visuals:  visualResult.score,
    flow:     flowResult.score,
  };

  const weightedScore =
    breakdown.hook     * weights.hook     +
    breakdown.content  * weights.content  +
    breakdown.features * weights.features +
    breakdown.visuals  * weights.visuals  +
    breakdown.flow     * weights.flow;

  const finalScore = Math.round(weightedScore * 10) / 10;

  return {
    status:    finalScore >= 7 ? "approved" : "revise",
    score:     finalScore,
    issues:    allIssues,
    fixes,
    breakdown,
  };
}

export function logReview(result: CreativeReviewResult): void {
  const icon = result.status === "approved" ? "✅" : "🔴";
  console.log(`\n${icon} CREATIVE REVIEW: ${result.status.toUpperCase()} (${result.score}/10)`);
  console.log("─".repeat(50));

  console.log("Breakdown:");
  for (const [key, val] of Object.entries(result.breakdown)) {
    const bar = "█".repeat(Math.round(val)) + "░".repeat(10 - Math.round(val));
    console.log(`  ${key.padEnd(9)} ${bar} ${val}/10`);
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

export function quickCheck(data: ProductVideoData): boolean {
  return creativeReview(data).status === "approved";
}
