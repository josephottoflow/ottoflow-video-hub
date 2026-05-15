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
