import { GeminiProvider } from "./providers/gemini";

/** Extract parseable JSON from an AI response that may contain preamble/markdown */
function extractJSON(raw: string): string | null {
  if (!raw) return null;
  // 1. Strip markdown fences
  const stripped = raw.replace(/^```json?\n?/m, "").replace(/\n?```$/m, "").trim();
  // 2. Try direct parse
  try { JSON.parse(stripped); return stripped; } catch { /* fall through */ }
  // 3. Find first { ... last } substring
  const start = stripped.indexOf("{");
  const end   = stripped.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const candidate = stripped.slice(start, end + 1);
    try { JSON.parse(candidate); return candidate; } catch { /* fall through */ }
  }
  // 4. Find first [ ... last ] substring (array responses)
  const aStart = stripped.indexOf("[");
  const aEnd   = stripped.lastIndexOf("]");
  if (aStart !== -1 && aEnd > aStart) {
    const candidate = stripped.slice(aStart, aEnd + 1);
    try { JSON.parse(candidate); return candidate; } catch { /* fall through */ }
  }
  return null;
}
import { resolveRoute, getCostUsd, FALLBACK_CHAINS, FALLBACK_MODEL_FOR_PROVIDER } from "./router";
import { buildCacheKey, getCached, setCached } from "./cache";
import { trackRequest } from "./cost-tracker";
import type { AIRequest, AIResponse, AIProvider } from "./types";

export type { AIRequest, AIResponse, TaskType, Tier } from "./types";
export { getSpendSummary } from "./cost-tracker";
export { evictExpired as evictAICache } from "./cache";

export class AIOrchestrator {
  private providers = new Map<string, AIProvider>();

  constructor() {
    if (process.env.GOOGLE_API_KEY) {
      try { this.providers.set("gemini", new GeminiProvider()); } catch (e) {
        console.warn("[ai-orchestrator] Gemini init failed:", (e as Error).message);
      }
    }
    const active = [...this.providers.keys()];
    console.log(`[ai-orchestrator] Active providers: ${active.length ? active.join(", ") : "NONE — check GOOGLE_API_KEY"}`);
  }

  async generate(req: AIRequest): Promise<AIResponse> {
    const tier  = req.tier ?? "basic";
    const route = resolveRoute(req.taskType, tier);

    // ── Cache lookup ────────────────────────────────────────────────────────────
    if (!req.skipCache && route.cacheTtlSeconds > 0) {
      const key    = buildCacheKey(req.taskType, route.model, req.systemPrompt, req.prompt);
      const cached = await getCached(key);
      if (cached) {
        const hit: AIResponse = {
          text:         cached.responseText,
          provider:     cached.provider as AIResponse["provider"],
          model:        cached.model,
          inputTokens:  cached.inputTokens,
          outputTokens: cached.outputTokens,
          latencyMs:    0,
          costUsd:      0,
          fromCache:    true,
          cacheKey:     key,
        };
        void trackRequest(req.taskType, tier, hit, req.jobId);
        return hit;
      }
    }

    // ── Provider fallback chain ─────────────────────────────────────────────────
    const chain   = FALLBACK_CHAINS[route.provider] ?? ["gemini"];
    let lastError: Error | null = null;

    for (const providerName of chain) {
      const provider = this.providers.get(providerName);
      if (!provider) {
        console.warn(`[ai-orchestrator] provider "${providerName}" not available — skipping`);
        continue;
      }

      // When falling back to a different provider, use its default flash model
      const model = providerName !== route.provider
        ? (FALLBACK_MODEL_FOR_PROVIDER[providerName] ?? "gemini-2.5-flash")
        : route.model;

      const t0 = Date.now();
      try {
        const result = await provider.generate(model, req.systemPrompt, req.prompt, {
          maxTokens:   req.maxTokens   ?? route.maxTokens,
          temperature: req.temperature ?? route.temperature,
          json:        req.responseFormat === "json",
        });

        // When JSON format is requested, validate the response is parseable before
        // treating it as a success. Applies multi-stage extraction to handle:
        //   1. Raw JSON (ideal)
        //   2. Markdown code fences (```json ... ```)
        //   3. Preamble text before the JSON object
        //   4. Truncated responses — fail fast so next provider handles it
        if (req.responseFormat === "json" && result.text !== undefined) {
          const extracted = extractJSON(result.text);
          if (extracted === null) {
            const preview = result.text.slice(0, 120);
            console.warn(`[ai-orchestrator] ${providerName}/${model} returned invalid JSON (len=${result.text.length} preview=${JSON.stringify(preview)}) — trying next provider`);
            lastError = new Error(`Invalid JSON from ${providerName}: ${(result.text || "(empty)").slice(0, 80)}`);
            continue;
          }
          // Replace the text with the clean extracted JSON so downstream parsing works
          result.text = extracted;
        }

        const latencyMs  = Date.now() - t0;
        const costUsd    = getCostUsd(model, result.inputTokens, result.outputTokens);

        let cacheKey: string | undefined;
        if (route.cacheTtlSeconds > 0 && !req.skipCache) {
          cacheKey = buildCacheKey(req.taskType, model, req.systemPrompt, req.prompt);
          void setCached(cacheKey, req.taskType, {
            responseText: result.text,
            inputTokens:  result.inputTokens,
            outputTokens: result.outputTokens,
            provider:     providerName,
            model,
          }, route.cacheTtlSeconds);
        }

        const response: AIResponse = {
          text:         result.text,
          provider:     providerName as AIResponse["provider"],
          model,
          inputTokens:  result.inputTokens,
          outputTokens: result.outputTokens,
          latencyMs,
          costUsd,
          fromCache:    false,
          cacheKey,
        };

        void trackRequest(req.taskType, tier, response, req.jobId);

        if (providerName !== route.provider) {
          console.warn(`[ai-orchestrator] fell back to ${providerName}/${model} for task "${req.taskType}"`);
        }

        return response;

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[ai-orchestrator] ${providerName}/${model} failed (${lastError.message}) — trying next provider`);
      }
    }

    throw lastError ?? new Error(`All AI providers exhausted for task: ${req.taskType}`);
  }
}

// Module-level singleton — one instance per worker process / Next.js function instance
let _instance: AIOrchestrator | null = null;

export function getAIOrchestrator(): AIOrchestrator {
  if (!_instance) _instance = new AIOrchestrator();
  return _instance;
}
