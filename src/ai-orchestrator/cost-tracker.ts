import { getDb } from "../lib/db";
import type { AIResponse } from "./types";

/** Write a single AI call record to ai_requests (fire-and-forget, non-fatal). */
export async function trackRequest(
  taskType: string,
  tier:     string,
  response: AIResponse,
  jobId?:   string
): Promise<void> {
  try {
    await getDb().query(
      `INSERT INTO ai_requests
         (task_type, provider, model, tier, input_tokens, output_tokens,
          cost_usd, latency_ms, from_cache, cache_key, job_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        taskType,
        response.provider,
        response.model,
        tier,
        response.inputTokens,
        response.outputTokens,
        response.costUsd,
        response.latencyMs,
        response.fromCache,
        response.cacheKey ?? null,
        jobId ?? null,
      ]
    );
  } catch {
    // Never let cost tracking break a render
  }
}

/** Aggregate spend by provider/model for a time window (UI dashboard use). */
export async function getSpendSummary(windowHours = 24): Promise<{
  provider:      string;
  model:         string;
  calls:         number;
  cacheHits:     number;
  inputTokens:   number;
  outputTokens:  number;
  totalCostUsd:  number;
}[]> {
  try {
    const { rows } = await getDb().query(
      `SELECT
         provider,
         model,
         COUNT(*)::int                        AS calls,
         SUM(from_cache::int)::int            AS cache_hits,
         SUM(input_tokens)::int               AS input_tokens,
         SUM(output_tokens)::int              AS output_tokens,
         ROUND(SUM(cost_usd)::numeric, 6)     AS total_cost_usd
       FROM ai_requests
       WHERE created_at > now() - ($1 * interval '1 hour')
       GROUP BY provider, model
       ORDER BY total_cost_usd DESC`,
      [windowHours]
    );
    return rows.map((r) => ({
      provider:     r.provider,
      model:        r.model,
      calls:        Number(r.calls),
      cacheHits:    Number(r.cache_hits),
      inputTokens:  Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      totalCostUsd: Number(r.total_cost_usd),
    }));
  } catch {
    return [];
  }
}
