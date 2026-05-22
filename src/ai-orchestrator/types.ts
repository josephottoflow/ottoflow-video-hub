// AI Orchestrator — shared types

export type TaskType =
  | "topic-generate"    // Claude Opus (advanced) or Gemini Flash (basic)
  | "script-generate"   // Gemini Flash (both tiers)
  | "hook-generate"     // Claude Haiku (advanced) or Gemini Flash (basic)
  | "scene-plan"        // Gemini Flash (both tiers)
  | "caption-generate"  // Gemini Flash (both tiers)
  | "metadata-generate" // Gemini Flash (both tiers)
  | "quality-score";    // Gemini Flash (both tiers)

export type ProviderName = "gemini" | "claude";
export type Tier = "basic" | "advanced";

export interface AIRequest {
  taskType:        TaskType;
  prompt:          string;
  systemPrompt?:   string;
  tier?:           Tier;
  maxTokens?:      number;
  temperature?:    number;
  responseFormat?: "text" | "json";
  jobId?:          string;    // for cost tracking attribution
  skipCache?:      boolean;   // force fresh generation
}

export interface AIResponse {
  text:         string;
  provider:     ProviderName;
  model:        string;
  inputTokens:  number;
  outputTokens: number;
  latencyMs:    number;
  costUsd:      number;
  fromCache:    boolean;
  cacheKey?:    string;
}

export interface ProviderResult {
  text:         string;
  inputTokens:  number;
  outputTokens: number;
}

export interface AIProvider {
  readonly name: ProviderName;
  generate(
    model:        string,
    systemPrompt: string | undefined,
    userPrompt:   string,
    opts:         { maxTokens: number; temperature: number; json: boolean }
  ): Promise<ProviderResult>;
}

export interface RouteConfig {
  provider:        ProviderName;
  model:           string;
  maxTokens:       number;
  temperature:     number;
  cacheTtlSeconds: number;
}
