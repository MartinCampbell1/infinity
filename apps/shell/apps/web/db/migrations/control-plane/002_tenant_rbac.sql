CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_users (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (
    role IN ('owner', 'admin', 'operator', 'viewer', 'service', 'workspace_runtime')
  ),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS tenant_projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, project_id)
);

CREATE TABLE IF NOT EXISTS tenant_workspaces (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, workspace_id)
);

ALTER TABLE execution_sessions
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE execution_session_events
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE recovery_incidents
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE account_quota_snapshots
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE account_quota_updates
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE operator_action_audit_events
  ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

ALTER TABLE execution_session_events
  DROP CONSTRAINT IF EXISTS execution_session_events_session_id_fkey,
  DROP CONSTRAINT IF EXISTS execution_session_events_tenant_session_fkey;

ALTER TABLE recovery_incidents
  DROP CONSTRAINT IF EXISTS recovery_incidents_session_id_fkey,
  DROP CONSTRAINT IF EXISTS recovery_incidents_tenant_session_fkey;

ALTER TABLE execution_sessions
  DROP CONSTRAINT IF EXISTS execution_sessions_pkey,
  ADD PRIMARY KEY (tenant_id, id);

ALTER TABLE execution_session_events
  DROP CONSTRAINT IF EXISTS execution_session_events_pkey,
  ADD PRIMARY KEY (tenant_id, id),
  ADD CONSTRAINT execution_session_events_tenant_session_fkey
    FOREIGN KEY (tenant_id, session_id)
    REFERENCES execution_sessions (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE approval_requests
  DROP CONSTRAINT IF EXISTS approval_requests_pkey,
  ADD PRIMARY KEY (tenant_id, id);

ALTER TABLE recovery_incidents
  DROP CONSTRAINT IF EXISTS recovery_incidents_pkey,
  ADD PRIMARY KEY (tenant_id, id),
  ADD CONSTRAINT recovery_incidents_tenant_session_fkey
    FOREIGN KEY (tenant_id, session_id)
    REFERENCES execution_sessions (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE account_quota_snapshots
  DROP CONSTRAINT IF EXISTS account_quota_snapshots_pkey,
  ADD PRIMARY KEY (tenant_id, id);

ALTER TABLE account_quota_updates
  DROP CONSTRAINT IF EXISTS account_quota_updates_pkey,
  ADD PRIMARY KEY (tenant_id, sequence);

ALTER TABLE operator_action_audit_events
  DROP CONSTRAINT IF EXISTS operator_action_audit_events_pkey,
  ADD PRIMARY KEY (tenant_id, id);

CREATE INDEX IF NOT EXISTS idx_execution_sessions_tenant_updated
  ON execution_sessions (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_execution_session_events_tenant_session_ts
  ON execution_session_events (tenant_id, session_id, event_ts DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status_updated
  ON approval_requests (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_recovery_incidents_tenant_status_updated
  ON recovery_incidents (tenant_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_quota_snapshots_tenant_account_observed
  ON account_quota_snapshots (tenant_id, account_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_quota_updates_tenant_account_sequence
  ON account_quota_updates (tenant_id, account_id, sequence DESC);

CREATE INDEX IF NOT EXISTS idx_operator_action_audit_events_tenant_session_sequence
  ON operator_action_audit_events (tenant_id, session_id, sequence DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_user
  ON tenant_memberships (tenant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_tenant_projects_tenant_project
  ON tenant_projects (tenant_id, project_id);

CREATE INDEX IF NOT EXISTS idx_tenant_workspaces_tenant_workspace
  ON tenant_workspaces (tenant_id, workspace_id);

ALTER TABLE execution_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_quota_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_quota_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_action_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS execution_sessions_tenant_isolation ON execution_sessions;
CREATE POLICY execution_sessions_tenant_isolation ON execution_sessions
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'));

DROP POLICY IF EXISTS execution_session_events_tenant_isolation ON execution_session_events;
CREATE POLICY execution_session_events_tenant_isolation ON execution_session_events
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'));

DROP POLICY IF EXISTS approval_requests_tenant_isolation ON approval_requests;
CREATE POLICY approval_requests_tenant_isolation ON approval_requests
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'));

DROP POLICY IF EXISTS recovery_incidents_tenant_isolation ON recovery_incidents;
CREATE POLICY recovery_incidents_tenant_isolation ON recovery_incidents
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'));

DROP POLICY IF EXISTS account_quota_snapshots_tenant_isolation ON account_quota_snapshots;
CREATE POLICY account_quota_snapshots_tenant_isolation ON account_quota_snapshots
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'));

DROP POLICY IF EXISTS account_quota_updates_tenant_isolation ON account_quota_updates;
CREATE POLICY account_quota_updates_tenant_isolation ON account_quota_updates
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'));

DROP POLICY IF EXISTS operator_action_audit_events_tenant_isolation ON operator_action_audit_events;
CREATE POLICY operator_action_audit_events_tenant_isolation ON operator_action_audit_events
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'));
