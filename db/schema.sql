-- Ottoflow Video Hub — PostgreSQL Schema
-- Auto-applied on first `docker compose up` via /docker-entrypoint-initdb.d/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Content rows: mirrors Google Sheets (editor layer) ────────────────────────
CREATE TABLE IF NOT EXISTS content_rows (
  row_index   INTEGER     PRIMARY KEY,
  topic       TEXT        NOT NULL,
  style       TEXT,
  voice       TEXT,        -- from Sheets col F, e.g. "Female energetic"
  hook_a      TEXT,
  hook_b      TEXT,
  hook_c      TEXT,
  script      TEXT,
  synced_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Available Remotion templates ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS templates (
  id           TEXT    PRIMARY KEY,
  display_name TEXT    NOT NULL,
  enabled      BOOLEAN DEFAULT TRUE
);

INSERT INTO templates (id, display_name) VALUES
  ('cinematic',    'Cinematic'),
  ('listicle',     'Listicle'),
  ('stats-story',  'Stats Story'),
  ('tutorial',     'Tutorial'),
  ('myth-buster',  'Myth Buster'),
  ('quote-card',   'Quote Card'),
  ('product-video','Product Video'),
  ('product-demo', 'Product Demo'),
  ('unboxing',     'Unboxing'),
  ('before-after', 'Before & After')
ON CONFLICT (id) DO NOTHING;

-- ── Render jobs: operational state (Postgres is authoritative) ─────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  row_index    INTEGER     NOT NULL,
  topic        TEXT        NOT NULL,
  template     TEXT        NOT NULL REFERENCES templates(id),
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','processing','done','error')),
  error        TEXT,
  output_path  TEXT,
  output_link  TEXT,
  bull_job_id  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms  INTEGER,
  retry_count  INTEGER     DEFAULT 0
);

CREATE INDEX IF NOT EXISTS jobs_status_idx     ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_row_index_idx  ON jobs(row_index);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs(created_at DESC);
