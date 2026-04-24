ALTER TABLE execution_kernel_attempts
  ADD COLUMN IF NOT EXISTS lease_holder TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_execution_kernel_attempts_lease_expiry
  ON execution_kernel_attempts (status, lease_expires_at);
