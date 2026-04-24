CREATE TABLE IF NOT EXISTS execution_kernel_batches (
  id TEXT PRIMARY KEY,
  initiative_id TEXT NOT NULL,
  task_graph_id TEXT NOT NULL,
  work_unit_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  concurrency_limit INTEGER NOT NULL CHECK (concurrency_limit > 0),
  status TEXT NOT NULL,
  recovery_state TEXT NOT NULL DEFAULT 'retryable',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_kernel_attempts (
  id TEXT PRIMARY KEY,
  work_unit_id TEXT NOT NULL,
  batch_id TEXT REFERENCES execution_kernel_batches(id) ON DELETE CASCADE,
  executor_type TEXT NOT NULL,
  status TEXT NOT NULL,
  recovery_state TEXT NOT NULL DEFAULT 'retryable',
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  summary TEXT,
  artifact_uris JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_code TEXT,
  error_summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_kernel_work_units_snapshot (
  work_unit_id TEXT PRIMARY KEY,
  snapshot_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_kernel_leases (
  resource_id TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_kernel_heartbeats (
  id TEXT PRIMARY KEY,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_kernel_events (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT,
  attempt_id TEXT,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_kernel_attempts_batch
  ON execution_kernel_attempts (batch_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_kernel_batches_status
  ON execution_kernel_batches (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_kernel_events_batch
  ON execution_kernel_events (batch_id, occurred_at DESC);
