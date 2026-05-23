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
export type JobVersion = "v1" | "v2";

export interface DbJob {
  id:             string;
  row_index:      number;
  topic:          string;
  template:       string;
  status:         JobStatus;
  version:        JobVersion;
  render_variant?: string;
  hook_style?:    string;
  visual_style?:  string;
  sheet_name?:    string;
  music_vibe?:    string;
  music_track?:   string;
  script_text?:   string;
  quality_score?: number;
  needs_review?:  boolean;
  progress?:      number;
  error?:         string;
  output_path?:   string;
  output_link?:   string;
  bull_job_id?:   string;
  created_at:     Date;
  started_at?:    Date;
  completed_at?:  Date;
  duration_ms?:   number;
  retry_count:    number;
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

export interface DbTemplate {
  id:         string;
  name:       string;
  version:    JobVersion;
  config:     Record<string, unknown>;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DbStoryboard {
  id:           string;
  job_id:       string;
  topic:        string;
  visual_style?: string;
  music_mood?:  string;
  total_frames?: number;
  full_script?: string;
  scenes:       unknown[];
  created_at:   Date;
}

// ── Schema migration — runs once on startup ───────────────────────────────────
// Safe to call multiple times; all statements are idempotent.

export async function runMigrations(): Promise<void> {
  const db = getDb();
  await db.query(`
    -- Core jobs table
    CREATE TABLE IF NOT EXISTS jobs (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      row_index     INT NOT NULL,
      topic         TEXT NOT NULL,
      template      TEXT NOT NULL DEFAULT 'v2-ugc',
      status        TEXT NOT NULL DEFAULT 'pending',
      version       TEXT NOT NULL DEFAULT 'v1',
      render_variant TEXT,
      hook_style    TEXT,
      visual_style  TEXT,
      sheet_name    TEXT,
      error         TEXT,
      output_path   TEXT,
      output_link   TEXT,
      bull_job_id   TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at    TIMESTAMPTZ,
      completed_at  TIMESTAMPTZ,
      duration_ms   INT,
      retry_count   INT NOT NULL DEFAULT 0
    );

    -- Add new columns to existing jobs table (safe if already present)
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS version        TEXT NOT NULL DEFAULT 'v1';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS render_variant TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS hook_style     TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS visual_style   TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS sheet_name     TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS music_vibe     TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS music_track    TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS script_text    TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quality_score  FLOAT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS needs_review   BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS progress       INT NOT NULL DEFAULT 0;

    -- Content rows synced from Google Sheets
    CREATE TABLE IF NOT EXISTS content_rows (
      row_index  INT PRIMARY KEY,
      topic      TEXT NOT NULL,
      style      TEXT,
      voice      TEXT,
      hook_a     TEXT,
      hook_b     TEXT,
      hook_c     TEXT,
      script     TEXT,
      synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Template persistence (replaces lost-on-refresh UI state)
    CREATE TABLE IF NOT EXISTS templates (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      version     TEXT NOT NULL DEFAULT 'v2',
      config      JSONB NOT NULL DEFAULT '{}',
      is_default  BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Storyboard snapshots per job (for replay and debugging)
    CREATE TABLE IF NOT EXISTS storyboards (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      topic        TEXT NOT NULL,
      visual_style TEXT,
      music_mood   TEXT,
      total_frames INT,
      full_script  TEXT,
      scenes       JSONB NOT NULL DEFAULT '[]',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Worker heartbeat
    CREATE TABLE IF NOT EXISTS worker_heartbeat (
      id         TEXT PRIMARY KEY DEFAULT 'main',
      touched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      worker_host TEXT
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS jobs_status_idx       ON jobs(status);
    CREATE INDEX IF NOT EXISTS jobs_topic_idx        ON jobs(topic);
    CREATE INDEX IF NOT EXISTS jobs_created_at_idx   ON jobs(created_at DESC);
    CREATE INDEX IF NOT EXISTS storyboards_job_id_idx ON storyboards(job_id);
  `);
}

// ── Job helpers ────────────────────────────────────────────────────────────────

export async function createJob(
  rowIndex:  number,
  topic:     string,
  template:  string,
  meta: {
    version?:       JobVersion;
    renderVariant?: string;
    hookStyle?:     string;
    sheetName?:     string;
    musicVibe?:     string;
  } = {}
): Promise<DbJob> {
  const { rows } = await getDb().query<DbJob>(
    `INSERT INTO jobs (row_index, topic, template, version, render_variant, hook_style, sheet_name, music_vibe)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [rowIndex, topic, template, meta.version ?? "v1", meta.renderVariant ?? null, meta.hookStyle ?? null, meta.sheetName ?? null, meta.musicVibe ?? null]
  );
  return rows[0];
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
  fields: Partial<Pick<DbJob,
    "error" | "output_path" | "output_link" | "duration_ms" | "bull_job_id" |
    "started_at" | "completed_at" | "visual_style" | "script_text" |
    "music_track" | "progress" | "quality_score" | "needs_review"
  >> = {}
): Promise<void> {
  if (status === "processing" && !fields.started_at)   fields.started_at   = new Date();
  if ((status === "done" || status === "error") && !fields.completed_at) fields.completed_at = new Date();

  const sets: string[]    = ["status = $2"];
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

export async function getLastTemplatesForTopic(topic: string, limit = 3): Promise<string[]> {
  try {
    const { rows } = await getDb().query<{ template: string }>(
      `SELECT template FROM jobs WHERE topic = $1 AND status = 'done'
       ORDER BY completed_at DESC LIMIT $2`,
      [topic, limit]
    );
    return rows.map(r => r.template);
  } catch { return []; }
}

export async function killJob(id: string): Promise<boolean> {
  const result = await getDb().query(
    `UPDATE jobs
     SET status = 'error', error = 'Killed by user', completed_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'processing')
     RETURNING id`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function updateJobProgress(id: string, progress: number): Promise<void> {
  try {
    await getDb().query(`UPDATE jobs SET progress = $2 WHERE id = $1`, [id, progress]);
  } catch { /* non-fatal */ }
}

export async function getAvgRenderTimeMs(): Promise<number | null> {
  try {
    const { rows } = await getDb().query<{ avg: string }>(
      `SELECT AVG(duration_ms)::bigint AS avg FROM jobs
       WHERE status = 'done' AND duration_ms IS NOT NULL AND duration_ms > 0
         AND created_at > NOW() - INTERVAL '7 days'`
    );
    const v = parseInt(rows[0]?.avg ?? "", 10);
    return isNaN(v) ? null : v;
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

// ── Template helpers ───────────────────────────────────────────────────────────

export async function listTemplates(version?: JobVersion): Promise<DbTemplate[]> {
  const { rows } = version
    ? await getDb().query<DbTemplate>(`SELECT * FROM templates WHERE version = $1 ORDER BY is_default DESC, name ASC`, [version])
    : await getDb().query<DbTemplate>(`SELECT * FROM templates ORDER BY version, is_default DESC, name ASC`);
  return rows;
}

export async function getTemplate(id: string): Promise<DbTemplate | null> {
  const { rows } = await getDb().query<DbTemplate>(`SELECT * FROM templates WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function upsertTemplate(
  name:    string,
  version: JobVersion,
  config:  Record<string, unknown>,
  id?:     string
): Promise<DbTemplate> {
  if (id) {
    const { rows } = await getDb().query<DbTemplate>(
      `UPDATE templates SET name = $2, version = $3, config = $4, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id, name, version, JSON.stringify(config)]
    );
    if (rows[0]) return rows[0];
  }
  const { rows } = await getDb().query<DbTemplate>(
    `INSERT INTO templates (name, version, config) VALUES ($1, $2, $3) RETURNING *`,
    [name, version, JSON.stringify(config)]
  );
  return rows[0];
}

export async function deleteTemplate(id: string): Promise<void> {
  await getDb().query(`DELETE FROM templates WHERE id = $1`, [id]);
}

// ── Storyboard helpers ─────────────────────────────────────────────────────────

export async function saveStoryboard(
  jobId:  string,
  data: {
    topic:        string;
    visualStyle?: string;
    musicMood?:   string;
    totalFrames?: number;
    fullScript?:  string;
    scenes:       unknown[];
  }
): Promise<DbStoryboard> {
  const { rows } = await getDb().query<DbStoryboard>(
    `INSERT INTO storyboards (job_id, topic, visual_style, music_mood, total_frames, full_script, scenes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [jobId, data.topic, data.visualStyle ?? null, data.musicMood ?? null,
     data.totalFrames ?? null, data.fullScript ?? null, JSON.stringify(data.scenes)]
  );
  return rows[0];
}

export async function getStoryboardByJob(jobId: string): Promise<DbStoryboard | null> {
  const { rows } = await getDb().query<DbStoryboard>(
    `SELECT * FROM storyboards WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [jobId]
  );
  return rows[0] ?? null;
}

// ── Advanced pipeline schema migrations (idempotent, safe on each worker boot) ─

export async function runAdvancedMigrations(): Promise<void> {
  const db = getDb();

  // Column additions — each idempotent
  await db.query(`
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS memory_rss_mb         INT;
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS memory_heap_mb         INT;
    ALTER TABLE workers ADD COLUMN IF NOT EXISTS renders_this_session   INT NOT NULL DEFAULT 0;
    ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS retry_count          INT NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS queue_snapshots (
      id          BIGSERIAL   PRIMARY KEY,
      captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      waiting     INT,
      active      INT,
      delayed     INT,
      done_24h    INT,
      failed_24h  INT
    );
    CREATE INDEX IF NOT EXISTS queue_snapshots_captured_at_idx ON queue_snapshots(captured_at DESC);
  `);

  // Extend pipelines status constraint to include 'dead' — done separately
  // because DO blocks don't compose well in multi-statement query strings.
  await db.query(`
    DO $$
    DECLARE
      v_conname  TEXT;
      v_condef   TEXT;
    BEGIN
      SELECT c.conname, pg_get_constraintdef(c.oid)
      INTO   v_conname, v_condef
      FROM   pg_constraint c
      WHERE  c.conrelid = 'pipelines'::regclass
        AND  c.contype  = 'c'
        AND  pg_get_constraintdef(c.oid) LIKE '%status IN%'
      LIMIT  1;

      IF v_condef LIKE '%dead%' THEN
        RETURN;
      END IF;

      IF v_conname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE pipelines DROP CONSTRAINT %I', v_conname);
      END IF;

      ALTER TABLE pipelines
        ADD CONSTRAINT pipelines_status_check
        CHECK (status IN ('pending','queued','running','done','failed','cancelled','timed_out','dead'));
    END;
    $$;
  `);
}

// ── Worker heartbeat ───────────────────────────────────────────────────────────

export async function touchWorkerHeartbeat(workerHost?: string): Promise<void> {
  try {
    await getDb().query(`
      INSERT INTO worker_heartbeat (id, touched_at, worker_host)
      VALUES ('main', NOW(), $1)
      ON CONFLICT (id) DO UPDATE SET touched_at = NOW(), worker_host = EXCLUDED.worker_host
    `, [workerHost ?? process.env.RAILWAY_SERVICE_NAME ?? null]);
  } catch { /* non-fatal */ }
}

export async function getWorkerHeartbeat(): Promise<Date | null> {
  try {
    const { rows } = await getDb().query<{ touched_at: Date }>(
      `SELECT touched_at FROM worker_heartbeat WHERE id = 'main'`
    );
    return rows[0]?.touched_at ?? null;
  } catch { return null; }
}
