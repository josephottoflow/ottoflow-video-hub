import type { TaskType, Tier, RouteConfig } from "./types";

// USD cost per 1M tokens (approximate 2026 pricing)
const TOKEN_COSTS: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.15,  output: 0.60 },
};

export function getCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const rates = TOKEN_COSTS[model] ?? { input: 0.075, output: 0.30 };
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
}

// Gemini Flash handles all task types — single provider, all tiers.
// cacheTtlSeconds=0  → never cache (fresh output every time: topics, quality)
// cacheTtlSeconds>0  → prompt-hash dedup (deterministic tasks: scripts, hooks, scenes)
const ROUTES: Record<TaskType, { basic: RouteConfig; advanced: RouteConfig }> = {
  "topic-generate": {
    basic:    { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 2048, temperature: 0.9, cacheTtlSeconds: 0 },
    advanced: { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 2048, temperature: 0.9, cacheTtlSeconds: 0 },
  },
  "script-generate": {
    basic:    { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 2048, temperature: 0.7, cacheTtlSeconds: 86_400 },
    advanced: { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 2048, temperature: 0.8, cacheTtlSeconds: 86_400 },
  },
  "hook-generate": {
    basic:    { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 1024, temperature: 0.8, cacheTtlSeconds: 43_200 },
    advanced: { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 1024, temperature: 0.9, cacheTtlSeconds: 43_200 },
  },
  "scene-plan": {
    basic:    { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 2048, temperature: 0.5, cacheTtlSeconds: 86_400 },
    advanced: { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 2048, temperature: 0.6, cacheTtlSeconds: 86_400 },
  },
  "caption-generate": {
    basic:    { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 512,  temperature: 0.5, cacheTtlSeconds: 86_400 },
    advanced: { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 512,  temperature: 0.5, cacheTtlSeconds: 86_400 },
  },
  "metadata-generate": {
    basic:    { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 256,  temperature: 0.5, cacheTtlSeconds: 86_400 },
    advanced: { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 256,  temperature: 0.5, cacheTtlSeconds: 86_400 },
  },
  "quality-score": {
    basic:    { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 128,  temperature: 0.1, cacheTtlSeconds: 0 },
    advanced: { provider: "gemini", model: "gemini-2.5-flash", maxTokens: 128,  temperature: 0.1, cacheTtlSeconds: 0 },
  },
};

export const FALLBACK_CHAINS: Record<string, string[]> = {
  gemini: ["gemini"],
};

export const FALLBACK_MODEL_FOR_PROVIDER: Record<string, string> = {
  gemini: "gemini-2.5-flash",
};

export function resolveRoute(taskType: TaskType, tier: Tier = "basic"): RouteConfig {
  return ROUTES[taskType]?.[tier] ?? ROUTES["script-generate"].basic;
}
