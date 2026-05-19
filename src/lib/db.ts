import { Pool } from "pg";

let pool: Pool | null = null;

export function getDb(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || "postgresql://ottoflow:ottoflow@localhost:5432/ottoflow";
    pool = new Pool({
      connectionString: url,
      max:                  url.includes("neon") || process.env.VERCEL ? 3 : 10,
      idleTimeoutMillis:    10_000,
      connectionTimeoutMillis: 5_000,
      ssl: url.includes("neon") || url.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : false,
    });
    pool.on("error", (err) => console.error("[db] Pool error:", err.message));
  }
  return pool;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "processing" | "done" | "error";

export interface DbJob {
  id:           string;
  row_index:    number;
  topic:        string;
  template:     string;
  status:       JobStatus;
  error?:       string;
  output_path?: string;
  output_link?: string;
  bull_job_id?: string;
  created_at:   Date;
  started_at?:  Date;
  completed_at?: Date;
  duration_ms?: number;
  retry_count:  number;
}

export interface DbContentRow {
  row_index:  number;
  topic:      string;
  style?:     string;
  voice?:     string;
  hook_a?:    string;
  hook_b?:    string;
  hook_c?:    string;
  script?:    string;
  synced_at:  Date;
}

// ── Job helpers ────────────────────────────────────────────────────────────────

export async function createJob(rowIndex: number, topic: string, template: string): Promise<DbJob> {
  const { rows } = await getDb().query<DbJob>(
    `INSERT INTO jobs (row_index, topic, template)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [rowIndex, topic, template]
  );
  return rows[0];
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
  fields: Partial<Pick<DbJob, "error" | "output_path" | "output_link" | "duration_ms" | "bull_job_id" | "started_at" | "completed_at">> = {}
): Promise<void> {
  if (status === "processing" && !fields.started_at)   fields.started_at   = new Date();
  if ((status === "done" || status === "error") && !fields.completed_at) fields.completed_at = new Date();

  const sets: string[]   = ["status = $2"];
  const values: unknown[] = [id, status];
  let i = 3;

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined) { sets.push(`${key} = $${i++}`); values.push(val); }
  }

  await getDb().query(`UPDATE jobs SET ${sets.join(", ")} WHERE id = $1`, values);
}

export async function upsertContentRow(row: Omit<DbContentRow, "synced_at">): Promise<void> {
  await getDb().query(
    `INSERT INTO content_rows (row_index, topic, style, voice, hook_a, hook_b, hook_c, script, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (row_index) DO UPDATE SET
       topic     = EXCLUDED.topic,
       style     = EXCLUDED.style,
       voice     = EXCLUDED.voice,
       hook_a    = EXCLUDED.hook_a,
       hook_b    = EXCLUDED.hook_b,
       hook_c    = EXCLUDED.hook_c,
       script    = EXCLUDED.script,
       synced_at = NOW()`,
    [row.row_index, row.topic, row.style, row.voice, row.hook_a, row.hook_b, row.hook_c, row.script]
  );
}

export async function listJobs(limit = 50): Promise<DbJob[]> {
  const { rows } = await getDb().query<DbJob>(
    `SELECT * FROM jobs ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getJob(id: string): Promise<DbJob | null> {
  const { rows } = await getDb().query<DbJob>(`SELECT * FROM jobs WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getStuckJobs(olderThanMs = 15 * 60 * 1000): Promise<DbJob[]> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const { rows } = await getDb().query<DbJob>(
    `SELECT * FROM jobs WHERE status = 'processing' AND started_at < $1 ORDER BY started_at`,
    [cutoff]
  );
  return rows;
}

export async function markStuckJobsError(olderThanMs = 15 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await getDb().query(
    `UPDATE jobs
     SET status = 'error',
         error = 'Job timed out — worker may have crashed',
         completed_at = NOW()
     WHERE status = 'processing' AND started_at < $1`,
    [cutoff]
  );
  return result.rowCount ?? 0;
}

export async function updateJobOutputLink(id: string, outputLink: string): Promise<void> {
  await getDb().query(`UPDATE jobs SET output_link = $2 WHERE id = $1`, [id, outputLink]);
}

// ── Worker heartbeat ───────────────────────────────────────────────────────────
// The render worker calls touchWorkerHeartbeat() every 30s.
// /api/worker-status reads it to confirm the worker is live — more reliable than BullMQ heartbeats
// which expire during long renders.

async function ensureHeartbeatTable(): Promise<void> {
  await getDb().query(`
    CREATE TABLE IF NOT EXISTS worker_heartbeat (
      id         TEXT PRIMARY KEY DEFAULT 'main',
      touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

let _heartbeatTableReady = false;

export async function touchWorkerHeartbeat(): Promise<void> {
  try {
    if (!_heartbeatTableReady) { await ensureHeartbeatTable(); _heartbeatTableReady = true; }
    await getDb().query(`
      INSERT INTO worker_heartbeat (id, touched_at) VALUES ('main', NOW())
      ON CONFLICT (id) DO UPDATE SET touched_at = NOW()
    `);
  } catch { /* non-fatal — heartbeat is best-effort */ }
}

export async function getWorkerHeartbeat(): Promise<Date | null> {
  try {
    if (!_heartbeatTableReady) { await ensureHeartbeatTable(); _heartbeatTableReady = true; }
    const { rows } = await getDb().query<{ touched_at: Date }>(
      `SELECT touched_at FROM worker_heartbeat WHERE id = 'main'`
    );
    return rows[0]?.touched_at ?? null;
  } catch { return null; }
}

export async function hasProcessingJob(withinMs = 10 * 60 * 1000): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - withinMs);
    const { rows } = await getDb().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM jobs WHERE status = 'processing' AND started_at > $1`,
      [cutoff]
    );
    return parseInt(rows[0]?.count ?? "0", 10) > 0;
  } catch { return false; }
}
