ALTER TABLE execution_kernel_attempts
  ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_attempt_id TEXT,
  ADD COLUMN IF NOT EXISTS retry_reason TEXT,
  ADD COLUMN IF NOT EXISTS retry_backoff_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_execution_kernel_attempts_lineage
  ON execution_kernel_attempts (batch_id, work_unit_id, attempt_number);
