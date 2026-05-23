-- Production Hardening — run AFTER 003_pipeline_engine.sql
-- Apply: psql $DATABASE_URL < db/004_production_hardening.sql

-- ── Worker memory monitoring ──────────────────────────────────────────────────
ALTER TABLE workers ADD COLUMN IF NOT EXISTS memory_rss_mb   INT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS memory_heap_mb  INT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS renders_this_session INT NOT NULL DEFAULT 0;

-- ── Pipeline dead-letter queue + retry tracking ───────────────────────────────
ALTER TABLE pipelines
  DROP CONSTRAINT IF EXISTS pipelines_status_check;
ALTER TABLE pipelines
  ADD CONSTRAINT pipelines_status_check
  CHECK (status IN ('pending','queued','running','done','failed','cancelled','timed_out','dead'));

ALTER TABLE pipelines ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

-- ── Queue depth history (snapshots for sparkline / analytics) ─────────────────
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

-- Retain only 7 days of snapshots (manual or via pg_cron if available)
-- DELETE FROM queue_snapshots WHERE captured_at < NOW() - INTERVAL '7 days';
