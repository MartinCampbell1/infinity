CREATE TABLE IF NOT EXISTS shell_control_plane_schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shell_control_plane_state (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS execution_sessions (
  id TEXT PRIMARY KEY,
  external_session_id TEXT,
  project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  group_id TEXT,
  workspace_id TEXT,
  account_id TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  phase TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  last_message_at TIMESTAMPTZ,
  last_tool_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  pending_approvals INTEGER NOT NULL DEFAULT 0,
  tool_activity_count INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  recovery_state TEXT NOT NULL DEFAULT 'none',
  quota_pressure TEXT NOT NULL DEFAULT 'unknown',
  unread_operator_signals INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS execution_session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES execution_sessions(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  group_id TEXT,
  source TEXT NOT NULL,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT,
  phase TEXT,
  event_ts TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB NOT NULL,
  raw JSONB
);

CREATE INDEX IF NOT EXISTS idx_execution_session_events_session_ts
  ON execution_session_events (session_id, event_ts DESC);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  external_session_id TEXT,
  project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  group_id TEXT,
  account_id TEXT,
  workspace_id TEXT,
  provider TEXT NOT NULL,
  request_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL,
  decision TEXT,
  requested_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  expires_at TIMESTAMPTZ,
  revision INTEGER NOT NULL,
  raw JSONB
);

CREATE TABLE IF NOT EXISTS recovery_incidents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES execution_sessions(id) ON DELETE CASCADE,
  external_session_id TEXT,
  project_id TEXT NOT NULL,
  project_name TEXT NOT NULL,
  group_id TEXT,
  account_id TEXT,
  workspace_id TEXT,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  recovery_action_kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  root_cause TEXT,
  recommended_action TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  opened_at TIMESTAMPTZ NOT NULL,
  last_observed_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  revision INTEGER NOT NULL,
  raw JSONB
);

CREATE TABLE IF NOT EXISTS account_quota_snapshots (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  auth_mode TEXT NOT NULL,
  source TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  buckets JSONB NOT NULL,
  raw JSONB
);

CREATE INDEX IF NOT EXISTS idx_account_quota_snapshots_account_observed
  ON account_quota_snapshots (account_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS account_quota_updates (
  sequence BIGINT PRIMARY KEY,
  account_id TEXT NOT NULL,
  source TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  snapshot_json JSONB NOT NULL,
  actor_context JSONB
);

ALTER TABLE account_quota_updates
  ADD COLUMN IF NOT EXISTS actor_context JSONB;

CREATE INDEX IF NOT EXISTS idx_account_quota_updates_account_sequence
  ON account_quota_updates (account_id, sequence DESC);

CREATE TABLE IF NOT EXISTS operator_action_audit_events (
  id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  group_id TEXT,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  outcome TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  payload JSONB NOT NULL,
  raw JSONB
);

CREATE INDEX IF NOT EXISTS idx_operator_action_audit_events_session_sequence
  ON operator_action_audit_events (session_id, sequence DESC);
