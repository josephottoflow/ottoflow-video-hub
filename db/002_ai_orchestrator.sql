-- AI Orchestrator tables
-- Apply: psql $DATABASE_URL < db/002_ai_orchestrator.sql

-- Prompt-hash deduplication cache
CREATE TABLE IF NOT EXISTS ai_response_cache (
  cache_key     TEXT          PRIMARY KEY,
  task_type     TEXT          NOT NULL,
  response_text TEXT          NOT NULL,
  input_tokens  INTEGER       NOT NULL DEFAULT 0,
  output_tokens INTEGER       NOT NULL DEFAULT 0,
  provider      TEXT          NOT NULL,
  model         TEXT          NOT NULL,
  hit_count     INTEGER       NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ   NOT NULL,
  last_hit_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ai_cache_expires_idx ON ai_response_cache(expires_at);
CREATE INDEX IF NOT EXISTS ai_cache_task_idx    ON ai_response_cache(task_type);

-- Per-call cost and token tracking
CREATE TABLE IF NOT EXISTS ai_requests (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type     TEXT          NOT NULL,
  provider      TEXT          NOT NULL,
  model         TEXT          NOT NULL,
  tier          TEXT          NOT NULL DEFAULT 'basic',
  input_tokens  INTEGER       NOT NULL DEFAULT 0,
  output_tokens INTEGER       NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(12,8) NOT NULL DEFAULT 0,
  latency_ms    INTEGER       NOT NULL DEFAULT 0,
  from_cache    BOOLEAN       NOT NULL DEFAULT false,
  cache_key     TEXT,
  job_id        TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_req_created_idx  ON ai_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS ai_req_task_idx     ON ai_requests(task_type);
CREATE INDEX IF NOT EXISTS ai_req_job_idx      ON ai_requests(job_id) WHERE job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ai_req_provider_idx ON ai_requests(provider, model);
