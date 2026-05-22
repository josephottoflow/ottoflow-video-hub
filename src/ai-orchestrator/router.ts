import type { TaskType, Tier, RouteConfig } from "./types";

// USD cost per 1M tokens (approximate 2026 pricing)
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash":          { input: 0.075, output: 0.30  },
  "gemini-2.5-flash":          { input: 0.15,  output: 0.60  },
  "claude-opus-4-7":           { input: 15.0,  output: 75.0  },
  "claude-sonnet-4-6":         { input: 3.0,   output: 15.0  },
  "claude-haiku-4-5-20251001": { input: 0.80,  output: 4.0   },
};

export function getCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rates = TOKEN_COSTS[model] ?? { input: 0.075, output: 0.30 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

// Task × tier → provider, model, generation params, cache TTL
//
// Design principles:
//   - topic-generate is a product differentiator → Claude Opus for advanced users
//   - script/hook/scene/caption → Gemini Flash for all tiers (fast, cheap, good enough)
//   - hook-generate advanced → Claude Haiku (sharper copy at ~10× lower cost than Sonnet)
//   - cacheTtlSeconds=0  means "never cache" (topics, quality scores)
//   - cacheTtlSeconds>0  enables prompt-hash dedup (idempotent tasks: scripts, hooks, scenes)
const ROUTES: Record<TaskType, { basic: RouteConfig; advanced: RouteConfig }> = {
  "topic-generate": {
    basic:    { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 2048, temperature: 0.9, cacheTtlSeconds: 0 },
    advanced: { provider: "claude", model: "claude-opus-4-7",            maxTokens: 2048, temperature: 0.9, cacheTtlSeconds: 0 },
  },
  "script-generate": {
    basic:    { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 512,  temperature: 0.7, cacheTtlSeconds: 86_400 },
    advanced: { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 512,  temperature: 0.8, cacheTtlSeconds: 86_400 },
  },
  "hook-generate": {
    basic:    { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 256,  temperature: 0.8, cacheTtlSeconds: 43_200 },
    advanced: { provider: "claude", model: "claude-haiku-4-5-20251001", maxTokens: 256,  temperature: 0.9, cacheTtlSeconds: 43_200 },
  },
  "scene-plan": {
    basic:    { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 1024, temperature: 0.5, cacheTtlSeconds: 86_400 },
    advanced: { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 1024, temperature: 0.6, cacheTtlSeconds: 86_400 },
  },
  "caption-generate": {
    basic:    { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 512,  temperature: 0.5, cacheTtlSeconds: 86_400 },
    advanced: { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 512,  temperature: 0.5, cacheTtlSeconds: 86_400 },
  },
  "metadata-generate": {
    basic:    { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 256,  temperature: 0.5, cacheTtlSeconds: 86_400 },
    advanced: { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 256,  temperature: 0.5, cacheTtlSeconds: 86_400 },
  },
  "quality-score": {
    basic:    { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 128,  temperature: 0.1, cacheTtlSeconds: 0 },
    advanced: { provider: "gemini", model: "gemini-2.0-flash",          maxTokens: 128,  temperature: 0.1, cacheTtlSeconds: 0 },
  },
};

// If the primary provider fails, try these in order
export const FALLBACK_CHAINS: Record<string, string[]> = {
  claude: ["claude", "gemini"],
  gemini: ["gemini"],
};

// Fallback model when we drop from Claude to Gemini
export const FALLBACK_MODEL_FOR_PROVIDER: Record<string, string> = {
  gemini: "gemini-2.0-flash",
};

export function resolveRoute(taskType: TaskType, tier: Tier = "basic"): RouteConfig {
  return ROUTES[taskType]?.[tier] ?? ROUTES["script-generate"].basic;
}
