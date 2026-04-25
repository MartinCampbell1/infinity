CREATE INDEX IF NOT EXISTS idx_execution_sessions_tenant_archived_updated
  ON execution_sessions (tenant_id, archived, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_sessions_tenant_project_updated
  ON execution_sessions (tenant_id, project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_session_events_tenant_project_ts
  ON execution_session_events (tenant_id, project_id, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_execution_session_events_tenant_kind_ts
  ON execution_session_events (tenant_id, kind, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_operator_action_audit_events_tenant_occurred
  ON operator_action_audit_events (tenant_id, occurred_at DESC);
