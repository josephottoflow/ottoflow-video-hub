// DB query helpers — reuses the app's pool config (SSL, max, etc.)
import "dotenv/config";
import { getDb } from "../../../src/lib/db";

export async function dbQuery<T extends Record<string, unknown>>(
  sql:    string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await getDb().query<T>(sql, params);
  return rows;
}

export async function dbOne<T extends Record<string, unknown>>(
  sql:    string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await dbQuery<T>(sql, params);
  return rows[0] ?? null;
}

// Pipeline helpers

export async function getPipeline(id: string) {
  return dbOne<{
    id:           string;
    status:       string;
    current_stage: string | null;
    progress_pct: number;
    worker_id:    string | null;
    retry_count:  number;
    error:        string | null;
    queued_at:    Date;
    started_at:   Date | null;
    completed_at: Date | null;
  }>(
    `SELECT id, status, current_stage, progress_pct, worker_id, retry_count,
            error, queued_at, started_at, completed_at
     FROM pipelines WHERE id = $1`,
    [id]
  );
}

export async function getStages(pipelineId: string) {
  return dbQuery<{
    stage_name:   string;
    status:       string;
    attempt:      number;
    duration_ms:  number | null;
    error:        string | null;
    started_at:   Date | null;
    completed_at: Date | null;
  }>(
    `SELECT stage_name, status, attempt, duration_ms, error, started_at, completed_at
     FROM pipeline_stages WHERE pipeline_id = $1 ORDER BY started_at NULLS LAST`,
    [pipelineId]
  );
}

export async function getWorker() {
  return dbOne<{
    id:                    string;
    status:                string;
    memory_rss_mb:         number;
    memory_heap_mb:        number;
    renders_this_session:  number;
    last_seen:             Date;
    heartbeat_age_s:       number;
  }>(
    `SELECT id, status, memory_rss_mb, memory_heap_mb, renders_this_session, last_seen,
            EXTRACT(EPOCH FROM (NOW() - last_seen))::int AS heartbeat_age_s
     FROM workers WHERE status = 'online' ORDER BY last_seen DESC LIMIT 1`
  );
}

export async function pollUntil<T>(
  fn:            () => Promise<T | null>,
  predicate:     (v: T) => boolean,
  timeoutMs:     number,
  intervalMs =   3_000
): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v && predicate(v)) return v;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, deadline - Date.now())));
  }
  return null;
}
