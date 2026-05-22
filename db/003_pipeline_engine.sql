-- Pipeline Engine — full distributed pipeline state
-- Apply: psql $DATABASE_URL < db/003_pipeline_engine.sql

-- ── Workers ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workers (
  id          TEXT        PRIMARY KEY,          -- {hostname}:{pid}
  status      TEXT        NOT NULL DEFAULT 'online'
                          CHECK (status IN ('online','draining','offline','crashed')),
  tier        TEXT        NOT NULL DEFAULT 'advanced',
  concurrency INTEGER     NOT NULL DEFAULT 1,
  version     TEXT,                             -- GIT_SHA at boot
  hostname    TEXT        NOT NULL,
  pid         INTEGER     NOT NULL,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workers_status_idx    ON workers(status);
CREATE INDEX IF NOT EXISTS workers_last_seen_idx ON workers(last_seen);

-- ── Pipelines ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipelines (
  id              TEXT        PRIMARY KEY,      -- UUIDv4
  trace_id        TEXT,                         -- per-run trace (changes on resume)
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','queued','running','done','failed','cancelled','timed_out')),
  tier            TEXT        NOT NULL DEFAULT 'advanced' CHECK (tier IN ('basic','advanced')),
  -- Content
  topic           TEXT        NOT NULL,
  style           TEXT        NOT NULL DEFAULT 'Educational',
  render_variant  TEXT,
  hook_style      TEXT,
  music_vibe      TEXT,
  template        TEXT,
  -- Queue
  priority        INTEGER     NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  row_index       INTEGER,                      -- Sheet row if applicable
  sheet_name      TEXT,
  db_job_id       TEXT,                         -- links to legacy jobs table
  -- Ownership
  worker_id       TEXT REFERENCES workers(id),
  locked_at       TIMESTAMPTZ,
  -- Progress
  current_stage   TEXT,
  stages_done     TEXT[]      NOT NULL DEFAULT '{}',
  progress_pct    SMALLINT    NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  -- Payload
  artifacts       JSONB       NOT NULL DEFAULT '{}',
  config          JSONB       NOT NULL DEFAULT '{}',
  -- Result
  error           TEXT,
  output_link     TEXT,
  duration_ms     INTEGER,
  -- Timing
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  queued_at       TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pipelines_status_idx   ON pipelines(status);
CREATE INDEX IF NOT EXISTS pipelines_tier_idx     ON pipelines(tier, status);
CREATE INDEX IF NOT EXISTS pipelines_worker_idx   ON pipelines(worker_id) WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pipelines_created_idx  ON pipelines(created_at DESC);
CREATE INDEX IF NOT EXISTS pipelines_dbjob_idx    ON pipelines(db_job_id) WHERE db_job_id IS NOT NULL;

-- ── Pipeline stages ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id  TEXT        NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_name   TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','running','done','failed','skipped','cancelled')),
  attempt      INTEGER     NOT NULL DEFAULT 0,
  max_attempts INTEGER     NOT NULL DEFAULT 1,
  error        TEXT,
  artifacts    JSONB       NOT NULL DEFAULT '{}',
  metadata     JSONB       NOT NULL DEFAULT '{}',
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms  INTEGER,
  UNIQUE (pipeline_id, stage_name)
);

CREATE INDEX IF NOT EXISTS pipeline_stages_pid_idx ON pipeline_stages(pipeline_id);

-- ── Event log (append-only, used for SSE replay and observability) ────────────
CREATE TABLE IF NOT EXISTS pipeline_events (
  id           BIGSERIAL   PRIMARY KEY,
  pipeline_id  TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  stage_name   TEXT,
  payload      JSONB       NOT NULL DEFAULT '{}',
  worker_id    TEXT,
  emitted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pipeline_events_pid_idx ON pipeline_events(pipeline_id, emitted_at DESC);
CREATE INDEX IF NOT EXISTS pipeline_events_type_idx ON pipeline_events(event_type, emitted_at DESC);

-- ── Stage metrics (aggregate — not per-event) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS stage_metrics (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id  TEXT        NOT NULL,
  stage_name   TEXT        NOT NULL,
  duration_ms  INTEGER     NOT NULL,
  succeeded    BOOLEAN     NOT NULL,
  tier         TEXT        NOT NULL DEFAULT 'advanced',
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stage_metrics_name_idx ON stage_metrics(stage_name, recorded_at DESC);
