import * as crypto from "crypto";
import { getDb } from "../lib/db";

export function buildCacheKey(
  taskType:     string,
  model:        string,
  systemPrompt: string | undefined,
  userPrompt:   string
): string {
  const payload = `${taskType}|${model}|${systemPrompt ?? ""}|${userPrompt}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export interface CacheEntry {
  responseText: string;
  inputTokens:  number;
  outputTokens: number;
  provider:     string;
  model:        string;
}

export async function getCached(cacheKey: string): Promise<CacheEntry | null> {
  try {
    const { rows } = await getDb().query<{
      response_text: string;
      input_tokens:  number;
      output_tokens: number;
      provider:      string;
      model:         string;
    }>(
      `UPDATE ai_response_cache
         SET hit_count   = hit_count + 1,
             last_hit_at = now()
       WHERE cache_key = $1 AND expires_at > now()
       RETURNING response_text, input_tokens, output_tokens, provider, model`,
      [cacheKey]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      responseText: r.response_text,
      inputTokens:  r.input_tokens,
      outputTokens: r.output_tokens,
      provider:     r.provider,
      model:        r.model,
    };
  } catch {
    return null; // non-fatal — treat as cache miss
  }
}

export async function setCached(
  cacheKey:  string,
  taskType:  string,
  entry:     CacheEntry,
  ttlSeconds: number
): Promise<void> {
  if (ttlSeconds <= 0) return;
  try {
    await getDb().query(
      `INSERT INTO ai_response_cache
         (cache_key, task_type, response_text, input_tokens, output_tokens, provider, model, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() + ($8 * interval '1 second'))
       ON CONFLICT (cache_key) DO UPDATE
         SET response_text = EXCLUDED.response_text,
             hit_count     = 0,
             expires_at    = EXCLUDED.expires_at,
             last_hit_at   = NULL`,
      [cacheKey, taskType, entry.responseText, entry.inputTokens, entry.outputTokens, entry.provider, entry.model, ttlSeconds]
    );
  } catch {
    // Non-fatal — cache write failure never blocks a render
  }
}

/** Purge expired entries — call from a periodic maintenance job */
export async function evictExpired(): Promise<number> {
  try {
    const { rowCount } = await getDb().query(
      `DELETE FROM ai_response_cache WHERE expires_at < now()`
    );
    return rowCount ?? 0;
  } catch {
    return 0;
  }
}
