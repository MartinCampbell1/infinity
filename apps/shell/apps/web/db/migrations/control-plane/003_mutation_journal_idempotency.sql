CREATE TABLE IF NOT EXISTS control_plane_mutation_events (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  id TEXT NOT NULL,
  mutation_kind TEXT NOT NULL,
  resource_kind TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  idempotency_key TEXT,
  actor_id TEXT,
  request_hash TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_json JSONB,
  status_code INTEGER,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS control_plane_idempotency_records (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  mutation_event_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed')),
  status_code INTEGER NOT NULL,
  response_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_control_plane_mutation_events_tenant_resource
  ON control_plane_mutation_events (tenant_id, resource_kind, resource_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_control_plane_mutation_events_tenant_idempotency
  ON control_plane_mutation_events (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_control_plane_idempotency_records_tenant_updated
  ON control_plane_idempotency_records (tenant_id, updated_at DESC);

ALTER TABLE control_plane_mutation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_plane_idempotency_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS control_plane_mutation_events_tenant_isolation
  ON control_plane_mutation_events;
CREATE POLICY control_plane_mutation_events_tenant_isolation
  ON control_plane_mutation_events
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'));

DROP POLICY IF EXISTS control_plane_idempotency_records_tenant_isolation
  ON control_plane_idempotency_records;
CREATE POLICY control_plane_idempotency_records_tenant_isolation
  ON control_plane_idempotency_records
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), 'default'));
