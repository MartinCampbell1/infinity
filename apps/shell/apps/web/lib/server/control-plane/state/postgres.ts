import { Pool, type PoolClient } from "pg";

import type { ApprovalRequest } from "../contracts/approvals";
import type { OperatorActionAuditEvent } from "../contracts/operator-actions";
import type { AccountQuotaSnapshot, AccountQuotaUpdate } from "../contracts/quota";
import {
  createExecutionSessionSummary,
  type ExecutionSessionSummary,
  type NormalizedExecutionEvent,
} from "../contracts/session-events";
import type { RecoveryIncident } from "../contracts/recoveries";
import { materializeSessionProjections } from "../events/store";
import { sortNormalizedEvents } from "../events/normalizers";
import type { ControlPlaneState } from "./types";

const CONTROL_PLANE_DB_ENV_KEYS = [
  "FOUNDEROS_CONTROL_PLANE_DATABASE_URL",
  "FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL",
] as const;

const CONTROL_PLANE_STATE_TABLE = "shell_control_plane_state";
const EXECUTION_SESSIONS_TABLE = "execution_sessions";
const EXECUTION_SESSION_EVENTS_TABLE = "execution_session_events";
const APPROVAL_REQUESTS_TABLE = "approval_requests";
const RECOVERY_INCIDENTS_TABLE = "recovery_incidents";
const ACCOUNT_QUOTA_SNAPSHOTS_TABLE = "account_quota_snapshots";
const ACCOUNT_QUOTA_UPDATES_TABLE = "account_quota_updates";
const OPERATOR_ACTION_AUDIT_EVENTS_TABLE = "operator_action_audit_events";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export interface ControlPlaneRelationalDelta {
  sessions?: ExecutionSessionSummary[];
  events?: NormalizedExecutionEvent[];
  approvals?: ApprovalRequest[];
  recoveries?: RecoveryIncident[];
  quotaSnapshots?: AccountQuotaSnapshot[];
  quotaUpdates?: AccountQuotaUpdate[];
  operatorActions?: OperatorActionAuditEvent[];
}

let cachedPool: Pool | null = null;
let cachedPoolUrl: string | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return clone(value as T);
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asStringArray(value: unknown) {
  return parseJsonValue<unknown[]>(value, []).filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
}

function buildAccountQuotaSnapshotId(snapshot: AccountQuotaSnapshot) {
  return `${snapshot.accountId}:${snapshot.observedAt}:${snapshot.source}`;
}

function providerForSession(
  sessionMap: Map<string, ExecutionSessionSummary>,
  sessionId: string
) {
  return sessionMap.get(sessionId)?.provider ?? "unknown";
}

function toApprovalRequestRow(
  request: ApprovalRequest,
  sessionMap: Map<string, ExecutionSessionSummary>
) {
  return {
    id: request.id,
    session_id: request.sessionId,
    external_session_id: request.externalSessionId ?? null,
    project_id: request.projectId,
    project_name: request.projectName,
    group_id: request.groupId ?? null,
    account_id: request.accountId ?? null,
    workspace_id: request.workspaceId ?? null,
    provider: providerForSession(sessionMap, request.sessionId),
    request_kind: request.requestKind,
    title: request.title,
    summary: request.summary,
    reason: request.reason ?? null,
    status: request.status,
    decision: request.decision ?? null,
    requested_at: request.requestedAt,
    updated_at: request.updatedAt,
    resolved_at: request.resolvedAt ?? null,
    resolved_by: request.resolvedBy ?? null,
    expires_at: request.expiresAt ?? null,
    revision: request.revision,
    raw: JSON.stringify(request.raw ?? null),
  };
}

function toRecoveryIncidentRow(incident: RecoveryIncident) {
  return {
    id: incident.id,
    session_id: incident.sessionId,
    external_session_id: incident.externalSessionId ?? null,
    project_id: incident.projectId,
    project_name: incident.projectName,
    group_id: incident.groupId ?? null,
    account_id: incident.accountId ?? null,
    workspace_id: incident.workspaceId ?? null,
    status: incident.status,
    severity: incident.severity,
    recovery_action_kind: incident.recoveryActionKind,
    summary: incident.summary,
    root_cause: incident.rootCause ?? null,
    recommended_action: incident.recommendedAction ?? null,
    retry_count: incident.retryCount,
    opened_at: incident.openedAt,
    last_observed_at: incident.lastObservedAt,
    updated_at: incident.updatedAt,
    resolved_at: incident.resolvedAt ?? null,
    revision: incident.revision,
    raw: JSON.stringify(incident.raw ?? null),
  };
}

function toOperatorActionRow(action: OperatorActionAuditEvent) {
  return {
    id: action.id,
    sequence: action.sequence,
    session_id: action.sessionId,
    project_id: action.projectId,
    group_id: action.groupId ?? null,
    target_kind: action.targetKind,
    target_id: action.targetId,
    kind: action.kind,
    outcome: action.outcome,
    actor_type: action.actorType,
    actor_id: action.actorId,
    occurred_at: action.occurredAt,
    summary: action.summary,
    payload: JSON.stringify(action.payload ?? {}),
    raw: JSON.stringify(action.raw ?? null),
  };
}

function toAccountQuotaSnapshotRow(snapshot: AccountQuotaSnapshot) {
  return {
    id: buildAccountQuotaSnapshotId(snapshot),
    account_id: snapshot.accountId,
    auth_mode: snapshot.authMode,
    source: snapshot.source,
    observed_at: snapshot.observedAt,
    buckets: JSON.stringify(snapshot.buckets),
    raw: JSON.stringify(snapshot.raw ?? null),
  };
}

function toAccountQuotaUpdateRow(update: AccountQuotaUpdate) {
  return {
    sequence: update.sequence,
    account_id: update.accountId,
    source: update.source,
    observed_at: update.observedAt,
    summary: update.summary,
    snapshot_json: JSON.stringify(update.snapshot),
  };
}

function toExecutionSessionRow(session: ExecutionSessionSummary) {
  return {
    id: session.id,
    external_session_id: session.externalSessionId ?? null,
    project_id: session.projectId,
    project_name: session.projectName,
    group_id: session.groupId ?? null,
    workspace_id: session.workspaceId ?? null,
    account_id: session.accountId ?? null,
    provider: session.provider,
    model: session.model ?? null,
    title: session.title,
    status: session.status,
    phase: session.phase ?? null,
    tags: JSON.stringify(session.tags),
    pinned: session.pinned,
    archived: session.archived,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    last_message_at: session.lastMessageAt ?? null,
    last_tool_at: session.lastToolAt ?? null,
    last_error_at: session.lastErrorAt ?? null,
    pending_approvals: session.pendingApprovals,
    tool_activity_count: session.toolActivityCount,
    retry_count: session.retryCount,
    recovery_state: session.recoveryState,
    quota_pressure: session.quotaPressure,
    unread_operator_signals: session.unreadOperatorSignals,
  };
}

function toExecutionEventRow(event: NormalizedExecutionEvent) {
  return {
    id: event.id,
    session_id: event.sessionId,
    project_id: event.projectId,
    group_id: event.groupId ?? null,
    source: event.source,
    provider: event.provider,
    kind: event.kind,
    status: event.status ?? null,
    phase: event.phase ?? null,
    event_ts: event.timestamp,
    summary: event.summary,
    payload: JSON.stringify(event.payload ?? {}),
    raw: JSON.stringify(event.raw ?? null),
  };
}

export function resolveControlPlaneDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env
) {
  for (const key of CONTROL_PLANE_DB_ENV_KEYS) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

export function describeControlPlaneDatabaseTarget(connectionString: string) {
  try {
    const url = new URL(connectionString);
    const host = url.hostname || "localhost";
    const port = url.port ? `:${url.port}` : "";
    const database = url.pathname.replace(/^\//, "") || "postgres";
    return `${host}${port}/${database}`;
  } catch {
    return "configured-postgres";
  }
}

function getPool(connectionString: string) {
  if (!cachedPool || cachedPoolUrl !== connectionString) {
    if (cachedPool) {
      void cachedPool.end().catch(() => {
        // Best-effort cleanup for test and local shell turnover.
      });
    }

    cachedPool = new Pool({
      connectionString,
      max: 2,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 5_000,
      allowExitOnIdle: true,
    });
    cachedPoolUrl = connectionString;
  }

  return cachedPool;
}

async function ensureSchema(queryable: Queryable) {
  await queryable.query(`
    CREATE TABLE IF NOT EXISTS ${CONTROL_PLANE_STATE_TABLE} (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      state_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await queryable.query(`
    CREATE TABLE IF NOT EXISTS ${EXECUTION_SESSIONS_TABLE} (
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
    )
  `);

  await queryable.query(`
    CREATE TABLE IF NOT EXISTS ${EXECUTION_SESSION_EVENTS_TABLE} (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES ${EXECUTION_SESSIONS_TABLE}(id) ON DELETE CASCADE,
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
    )
  `);
  await queryable.query(`
    CREATE INDEX IF NOT EXISTS idx_execution_session_events_session_ts
      ON ${EXECUTION_SESSION_EVENTS_TABLE} (session_id, event_ts DESC)
  `);

  await queryable.query(`
    CREATE TABLE IF NOT EXISTS ${APPROVAL_REQUESTS_TABLE} (
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
    )
  `);

  await queryable.query(`
    CREATE TABLE IF NOT EXISTS ${RECOVERY_INCIDENTS_TABLE} (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES ${EXECUTION_SESSIONS_TABLE}(id) ON DELETE CASCADE,
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
    )
  `);

  await queryable.query(`
    CREATE TABLE IF NOT EXISTS ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE} (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      auth_mode TEXT NOT NULL,
      source TEXT NOT NULL,
      observed_at TIMESTAMPTZ NOT NULL,
      buckets JSONB NOT NULL,
      raw JSONB
    )
  `);
  await queryable.query(`
    CREATE INDEX IF NOT EXISTS idx_account_quota_snapshots_account_observed
      ON ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE} (account_id, observed_at DESC)
  `);

  await queryable.query(`
    CREATE TABLE IF NOT EXISTS ${ACCOUNT_QUOTA_UPDATES_TABLE} (
      sequence BIGINT PRIMARY KEY,
      account_id TEXT NOT NULL,
      source TEXT NOT NULL,
      observed_at TIMESTAMPTZ NOT NULL,
      summary TEXT NOT NULL,
      snapshot_json JSONB NOT NULL
    )
  `);
  await queryable.query(`
    CREATE INDEX IF NOT EXISTS idx_account_quota_updates_account_sequence
      ON ${ACCOUNT_QUOTA_UPDATES_TABLE} (account_id, sequence DESC)
  `);

  await queryable.query(`
    CREATE TABLE IF NOT EXISTS ${OPERATOR_ACTION_AUDIT_EVENTS_TABLE} (
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
    )
  `);
  await queryable.query(`
    CREATE INDEX IF NOT EXISTS idx_operator_action_audit_events_session_sequence
      ON ${OPERATOR_ACTION_AUDIT_EVENTS_TABLE} (session_id, sequence DESC)
  `);
}

async function replaceReadModelTables(
  client: PoolClient,
  state: ControlPlaneState
) {
  const sessionSummaries = Object.values(
    materializeSessionProjections(state.sessions.events)
  );
  const sessionMap = new Map(
    sessionSummaries.map((session) => [session.id, session] as const)
  );
  const sessionEvents = sortNormalizedEvents(state.sessions.events);
  const operatorActions = [
    ...state.approvals.operatorActions,
    ...state.recoveries.operatorActions,
  ].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
    return left.id.localeCompare(right.id);
  });

  await client.query(`DELETE FROM ${EXECUTION_SESSION_EVENTS_TABLE}`);
  await client.query(`DELETE FROM ${RECOVERY_INCIDENTS_TABLE}`);
  await client.query(`DELETE FROM ${APPROVAL_REQUESTS_TABLE}`);
  await client.query(`DELETE FROM ${ACCOUNT_QUOTA_UPDATES_TABLE}`);
  await client.query(`DELETE FROM ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE}`);
  await client.query(`DELETE FROM ${OPERATOR_ACTION_AUDIT_EVENTS_TABLE}`);
  await client.query(`DELETE FROM ${EXECUTION_SESSIONS_TABLE}`);

  for (const session of sessionSummaries) {
    const row = toExecutionSessionRow(session);
    await client.query(
      `
        INSERT INTO ${EXECUTION_SESSIONS_TABLE} (
          id, external_session_id, project_id, project_name, group_id, workspace_id,
          account_id, provider, model, title, status, phase, tags, pinned, archived,
          created_at, updated_at, last_message_at, last_tool_at, last_error_at,
          pending_approvals, tool_activity_count, retry_count, recovery_state,
          quota_pressure, unread_operator_signals
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26
        )
      `,
      [
        row.id,
        row.external_session_id,
        row.project_id,
        row.project_name,
        row.group_id,
        row.workspace_id,
        row.account_id,
        row.provider,
        row.model,
        row.title,
        row.status,
        row.phase,
        row.tags,
        row.pinned,
        row.archived,
        row.created_at,
        row.updated_at,
        row.last_message_at,
        row.last_tool_at,
        row.last_error_at,
        row.pending_approvals,
        row.tool_activity_count,
        row.retry_count,
        row.recovery_state,
        row.quota_pressure,
        row.unread_operator_signals,
      ]
    );
  }

  for (const event of sessionEvents) {
    const row = toExecutionEventRow(event);
    await client.query(
      `
        INSERT INTO ${EXECUTION_SESSION_EVENTS_TABLE} (
          id, session_id, project_id, group_id, source, provider, kind, status,
          phase, event_ts, summary, payload, raw
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12::jsonb, $13::jsonb
        )
      `,
      [
        row.id,
        row.session_id,
        row.project_id,
        row.group_id,
        row.source,
        row.provider,
        row.kind,
        row.status,
        row.phase,
        row.event_ts,
        row.summary,
        row.payload,
        row.raw,
      ]
    );
  }

  for (const request of state.approvals.requests) {
    const row = toApprovalRequestRow(request, sessionMap);
    await client.query(
      `
        INSERT INTO ${APPROVAL_REQUESTS_TABLE} (
          id, session_id, external_session_id, project_id, project_name, group_id,
          account_id, workspace_id, provider, request_kind, title, summary, reason,
          status, decision, requested_at, updated_at, resolved_at, resolved_by,
          expires_at, revision, raw
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21, $22::jsonb
        )
      `,
      [
        row.id,
        row.session_id,
        row.external_session_id,
        row.project_id,
        row.project_name,
        row.group_id,
        row.account_id,
        row.workspace_id,
        row.provider,
        row.request_kind,
        row.title,
        row.summary,
        row.reason,
        row.status,
        row.decision,
        row.requested_at,
        row.updated_at,
        row.resolved_at,
        row.resolved_by,
        row.expires_at,
        row.revision,
        row.raw,
      ]
    );
  }

  for (const incident of state.recoveries.incidents) {
    const row = toRecoveryIncidentRow(incident);
    await client.query(
      `
        INSERT INTO ${RECOVERY_INCIDENTS_TABLE} (
          id, session_id, external_session_id, project_id, project_name, group_id,
          account_id, workspace_id, status, severity, recovery_action_kind, summary,
          root_cause, recommended_action, retry_count, opened_at, last_observed_at,
          updated_at, resolved_at, revision, raw
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21::jsonb
        )
      `,
      [
        row.id,
        row.session_id,
        row.external_session_id,
        row.project_id,
        row.project_name,
        row.group_id,
        row.account_id,
        row.workspace_id,
        row.status,
        row.severity,
        row.recovery_action_kind,
        row.summary,
        row.root_cause,
        row.recommended_action,
        row.retry_count,
        row.opened_at,
        row.last_observed_at,
        row.updated_at,
        row.resolved_at,
        row.revision,
        row.raw,
      ]
    );
  }

  for (const snapshot of state.accounts.snapshots) {
    const row = toAccountQuotaSnapshotRow(snapshot);
    await client.query(
      `
        INSERT INTO ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE} (
          id, account_id, auth_mode, source, observed_at, buckets, raw
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      `,
      [
        row.id,
        row.account_id,
        row.auth_mode,
        row.source,
        row.observed_at,
        row.buckets,
        row.raw,
      ]
    );
  }

  for (const update of state.accounts.updates) {
    const row = toAccountQuotaUpdateRow(update);
    await client.query(
      `
        INSERT INTO ${ACCOUNT_QUOTA_UPDATES_TABLE} (
          sequence, account_id, source, observed_at, summary, snapshot_json
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      `,
      [
        row.sequence,
        row.account_id,
        row.source,
        row.observed_at,
        row.summary,
        row.snapshot_json,
      ]
    );
  }

  for (const action of operatorActions) {
    const row = toOperatorActionRow(action);
    await client.query(
      `
        INSERT INTO ${OPERATOR_ACTION_AUDIT_EVENTS_TABLE} (
          id, sequence, session_id, project_id, group_id, target_kind, target_id,
          kind, outcome, actor_type, actor_id, occurred_at, summary, payload, raw
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb
        )
      `,
      [
        row.id,
        row.sequence,
        row.session_id,
        row.project_id,
        row.group_id,
        row.target_kind,
        row.target_id,
        row.kind,
        row.outcome,
        row.actor_type,
        row.actor_id,
        row.occurred_at,
        row.summary,
        row.payload,
        row.raw,
      ]
    );
  }
}

function hasRelationalDelta(delta: ControlPlaneRelationalDelta | null | undefined) {
  if (!delta) {
    return false;
  }

  return (
    (delta.sessions?.length ?? 0) > 0 ||
    (delta.events?.length ?? 0) > 0 ||
    (delta.approvals?.length ?? 0) > 0 ||
    (delta.recoveries?.length ?? 0) > 0 ||
    (delta.quotaSnapshots?.length ?? 0) > 0 ||
    (delta.quotaUpdates?.length ?? 0) > 0 ||
    (delta.operatorActions?.length ?? 0) > 0
  );
}

async function upsertExecutionSessions(
  client: PoolClient,
  sessions: readonly ExecutionSessionSummary[]
) {
  for (const session of sessions) {
    const row = toExecutionSessionRow(session);
    await client.query(
      `
        INSERT INTO ${EXECUTION_SESSIONS_TABLE} (
          id, external_session_id, project_id, project_name, group_id, workspace_id,
          account_id, provider, model, title, status, phase, tags, pinned, archived,
          created_at, updated_at, last_message_at, last_tool_at, last_error_at,
          pending_approvals, tool_activity_count, retry_count, recovery_state,
          quota_pressure, unread_operator_signals
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26
        )
        ON CONFLICT (id) DO UPDATE SET
          external_session_id = EXCLUDED.external_session_id,
          project_id = EXCLUDED.project_id,
          project_name = EXCLUDED.project_name,
          group_id = EXCLUDED.group_id,
          workspace_id = EXCLUDED.workspace_id,
          account_id = EXCLUDED.account_id,
          provider = EXCLUDED.provider,
          model = EXCLUDED.model,
          title = EXCLUDED.title,
          status = EXCLUDED.status,
          phase = EXCLUDED.phase,
          tags = EXCLUDED.tags,
          pinned = EXCLUDED.pinned,
          archived = EXCLUDED.archived,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          last_message_at = EXCLUDED.last_message_at,
          last_tool_at = EXCLUDED.last_tool_at,
          last_error_at = EXCLUDED.last_error_at,
          pending_approvals = EXCLUDED.pending_approvals,
          tool_activity_count = EXCLUDED.tool_activity_count,
          retry_count = EXCLUDED.retry_count,
          recovery_state = EXCLUDED.recovery_state,
          quota_pressure = EXCLUDED.quota_pressure,
          unread_operator_signals = EXCLUDED.unread_operator_signals
      `,
      [
        row.id,
        row.external_session_id,
        row.project_id,
        row.project_name,
        row.group_id,
        row.workspace_id,
        row.account_id,
        row.provider,
        row.model,
        row.title,
        row.status,
        row.phase,
        row.tags,
        row.pinned,
        row.archived,
        row.created_at,
        row.updated_at,
        row.last_message_at,
        row.last_tool_at,
        row.last_error_at,
        row.pending_approvals,
        row.tool_activity_count,
        row.retry_count,
        row.recovery_state,
        row.quota_pressure,
        row.unread_operator_signals,
      ]
    );
  }
}

async function upsertExecutionSessionEvents(
  client: PoolClient,
  events: readonly NormalizedExecutionEvent[]
) {
  for (const event of events) {
    const row = toExecutionEventRow(event);
    await client.query(
      `
        INSERT INTO ${EXECUTION_SESSION_EVENTS_TABLE} (
          id, session_id, project_id, group_id, source, provider, kind, status,
          phase, event_ts, summary, payload, raw
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12::jsonb, $13::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          session_id = EXCLUDED.session_id,
          project_id = EXCLUDED.project_id,
          group_id = EXCLUDED.group_id,
          source = EXCLUDED.source,
          provider = EXCLUDED.provider,
          kind = EXCLUDED.kind,
          status = EXCLUDED.status,
          phase = EXCLUDED.phase,
          event_ts = EXCLUDED.event_ts,
          summary = EXCLUDED.summary,
          payload = EXCLUDED.payload,
          raw = EXCLUDED.raw
      `,
      [
        row.id,
        row.session_id,
        row.project_id,
        row.group_id,
        row.source,
        row.provider,
        row.kind,
        row.status,
        row.phase,
        row.event_ts,
        row.summary,
        row.payload,
        row.raw,
      ]
    );
  }
}

async function upsertApprovalRequests(
  client: PoolClient,
  requests: readonly ApprovalRequest[],
  sessionMap: Map<string, ExecutionSessionSummary>
) {
  for (const request of requests) {
    const row = toApprovalRequestRow(request, sessionMap);
    await client.query(
      `
        INSERT INTO ${APPROVAL_REQUESTS_TABLE} (
          id, session_id, external_session_id, project_id, project_name, group_id,
          account_id, workspace_id, provider, request_kind, title, summary, reason,
          status, decision, requested_at, updated_at, resolved_at, resolved_by,
          expires_at, revision, raw
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21, $22::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          session_id = EXCLUDED.session_id,
          external_session_id = EXCLUDED.external_session_id,
          project_id = EXCLUDED.project_id,
          project_name = EXCLUDED.project_name,
          group_id = EXCLUDED.group_id,
          account_id = EXCLUDED.account_id,
          workspace_id = EXCLUDED.workspace_id,
          provider = EXCLUDED.provider,
          request_kind = EXCLUDED.request_kind,
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          reason = EXCLUDED.reason,
          status = EXCLUDED.status,
          decision = EXCLUDED.decision,
          requested_at = EXCLUDED.requested_at,
          updated_at = EXCLUDED.updated_at,
          resolved_at = EXCLUDED.resolved_at,
          resolved_by = EXCLUDED.resolved_by,
          expires_at = EXCLUDED.expires_at,
          revision = EXCLUDED.revision,
          raw = EXCLUDED.raw
      `,
      [
        row.id,
        row.session_id,
        row.external_session_id,
        row.project_id,
        row.project_name,
        row.group_id,
        row.account_id,
        row.workspace_id,
        row.provider,
        row.request_kind,
        row.title,
        row.summary,
        row.reason,
        row.status,
        row.decision,
        row.requested_at,
        row.updated_at,
        row.resolved_at,
        row.resolved_by,
        row.expires_at,
        row.revision,
        row.raw,
      ]
    );
  }
}

async function upsertRecoveryIncidents(
  client: PoolClient,
  incidents: readonly RecoveryIncident[]
) {
  for (const incident of incidents) {
    const row = toRecoveryIncidentRow(incident);
    await client.query(
      `
        INSERT INTO ${RECOVERY_INCIDENTS_TABLE} (
          id, session_id, external_session_id, project_id, project_name, group_id,
          account_id, workspace_id, status, severity, recovery_action_kind, summary,
          root_cause, recommended_action, retry_count, opened_at, last_observed_at,
          updated_at, resolved_at, revision, raw
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          session_id = EXCLUDED.session_id,
          external_session_id = EXCLUDED.external_session_id,
          project_id = EXCLUDED.project_id,
          project_name = EXCLUDED.project_name,
          group_id = EXCLUDED.group_id,
          account_id = EXCLUDED.account_id,
          workspace_id = EXCLUDED.workspace_id,
          status = EXCLUDED.status,
          severity = EXCLUDED.severity,
          recovery_action_kind = EXCLUDED.recovery_action_kind,
          summary = EXCLUDED.summary,
          root_cause = EXCLUDED.root_cause,
          recommended_action = EXCLUDED.recommended_action,
          retry_count = EXCLUDED.retry_count,
          opened_at = EXCLUDED.opened_at,
          last_observed_at = EXCLUDED.last_observed_at,
          updated_at = EXCLUDED.updated_at,
          resolved_at = EXCLUDED.resolved_at,
          revision = EXCLUDED.revision,
          raw = EXCLUDED.raw
      `,
      [
        row.id,
        row.session_id,
        row.external_session_id,
        row.project_id,
        row.project_name,
        row.group_id,
        row.account_id,
        row.workspace_id,
        row.status,
        row.severity,
        row.recovery_action_kind,
        row.summary,
        row.root_cause,
        row.recommended_action,
        row.retry_count,
        row.opened_at,
        row.last_observed_at,
        row.updated_at,
        row.resolved_at,
        row.revision,
        row.raw,
      ]
    );
  }
}

async function syncAccountQuotaSnapshots(
  client: PoolClient,
  snapshots: readonly AccountQuotaSnapshot[]
) {
  const accountIds = Array.from(new Set(snapshots.map((snapshot) => snapshot.accountId)));

  for (const accountId of accountIds) {
    await client.query(
      `DELETE FROM ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE} WHERE account_id = $1`,
      [accountId]
    );
  }

  for (const snapshot of snapshots) {
    const row = toAccountQuotaSnapshotRow(snapshot);
    await client.query(
      `
        INSERT INTO ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE} (
          id, account_id, auth_mode, source, observed_at, buckets, raw
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        ON CONFLICT (id) DO UPDATE SET
          account_id = EXCLUDED.account_id,
          auth_mode = EXCLUDED.auth_mode,
          source = EXCLUDED.source,
          observed_at = EXCLUDED.observed_at,
          buckets = EXCLUDED.buckets,
          raw = EXCLUDED.raw
      `,
      [
        row.id,
        row.account_id,
        row.auth_mode,
        row.source,
        row.observed_at,
        row.buckets,
        row.raw,
      ]
    );
  }
}

async function upsertAccountQuotaUpdates(
  client: PoolClient,
  updates: readonly AccountQuotaUpdate[]
) {
  for (const update of updates) {
    const row = toAccountQuotaUpdateRow(update);
    await client.query(
      `
        INSERT INTO ${ACCOUNT_QUOTA_UPDATES_TABLE} (
          sequence, account_id, source, observed_at, summary, snapshot_json
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (sequence) DO UPDATE SET
          account_id = EXCLUDED.account_id,
          source = EXCLUDED.source,
          observed_at = EXCLUDED.observed_at,
          summary = EXCLUDED.summary,
          snapshot_json = EXCLUDED.snapshot_json
      `,
      [
        row.sequence,
        row.account_id,
        row.source,
        row.observed_at,
        row.summary,
        row.snapshot_json,
      ]
    );
  }
}

async function upsertOperatorActionAuditEvents(
  client: PoolClient,
  actions: readonly OperatorActionAuditEvent[]
) {
  for (const action of actions) {
    const row = toOperatorActionRow(action);
    await client.query(
      `
        INSERT INTO ${OPERATOR_ACTION_AUDIT_EVENTS_TABLE} (
          id, sequence, session_id, project_id, group_id, target_kind, target_id,
          kind, outcome, actor_type, actor_id, occurred_at, summary, payload, raw
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb
        )
        ON CONFLICT (id) DO UPDATE SET
          sequence = EXCLUDED.sequence,
          session_id = EXCLUDED.session_id,
          project_id = EXCLUDED.project_id,
          group_id = EXCLUDED.group_id,
          target_kind = EXCLUDED.target_kind,
          target_id = EXCLUDED.target_id,
          kind = EXCLUDED.kind,
          outcome = EXCLUDED.outcome,
          actor_type = EXCLUDED.actor_type,
          actor_id = EXCLUDED.actor_id,
          occurred_at = EXCLUDED.occurred_at,
          summary = EXCLUDED.summary,
          payload = EXCLUDED.payload,
          raw = EXCLUDED.raw
      `,
      [
        row.id,
        row.sequence,
        row.session_id,
        row.project_id,
        row.group_id,
        row.target_kind,
        row.target_id,
        row.kind,
        row.outcome,
        row.actor_type,
        row.actor_id,
        row.occurred_at,
        row.summary,
        row.payload,
        row.raw,
      ]
    );
  }
}

async function applyControlPlaneRelationalDelta(
  client: PoolClient,
  delta: ControlPlaneRelationalDelta
) {
  const sessions = delta.sessions ?? [];
  const sessionMap = new Map(sessions.map((session) => [session.id, session] as const));

  if (sessions.length > 0) {
    await upsertExecutionSessions(client, sessions);
  }
  if ((delta.events?.length ?? 0) > 0) {
    await upsertExecutionSessionEvents(client, delta.events ?? []);
  }
  if ((delta.approvals?.length ?? 0) > 0) {
    await upsertApprovalRequests(client, delta.approvals ?? [], sessionMap);
  }
  if ((delta.recoveries?.length ?? 0) > 0) {
    await upsertRecoveryIncidents(client, delta.recoveries ?? []);
  }
  if ((delta.quotaSnapshots?.length ?? 0) > 0) {
    await syncAccountQuotaSnapshots(client, delta.quotaSnapshots ?? []);
  }
  if ((delta.quotaUpdates?.length ?? 0) > 0) {
    await upsertAccountQuotaUpdates(client, delta.quotaUpdates ?? []);
  }
  if ((delta.operatorActions?.length ?? 0) > 0) {
    await upsertOperatorActionAuditEvents(client, delta.operatorActions ?? []);
  }
}

export async function readControlPlaneStateFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await ensureSchema(pool);

  const result = await pool.query<{
    state_json: ControlPlaneState;
  }>(`SELECT state_json FROM ${CONTROL_PLANE_STATE_TABLE} WHERE id = 1`);

  return result.rows[0]?.state_json ?? null;
}

export async function writeControlPlaneStateToPostgres(
  connectionString: string,
  state: ControlPlaneState,
  relationalDelta?: ControlPlaneRelationalDelta | null
) {
  const pool = getPool(connectionString);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureSchema(client);
    await client.query(
      `
        INSERT INTO ${CONTROL_PLANE_STATE_TABLE} (id, state_json, updated_at)
        VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()
      `,
      [JSON.stringify(state)]
    );
    if (hasRelationalDelta(relationalDelta)) {
      await applyControlPlaneRelationalDelta(client, relationalDelta!);
    } else {
      await replaceReadModelTables(client, state);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {
      // Ignore rollback failures after primary write failure.
    });
    throw error;
  } finally {
    client.release();
  }
}

export async function readExecutionSessionSummariesFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await ensureSchema(pool);

  const result = await pool.query<{
    id: string;
    external_session_id: string | null;
    project_id: string;
    project_name: string;
    group_id: string | null;
    workspace_id: string | null;
    account_id: string | null;
    provider: ExecutionSessionSummary["provider"];
    model: string | null;
    title: string;
    status: ExecutionSessionSummary["status"];
    phase: string | null;
    tags: unknown;
    pinned: boolean;
    archived: boolean;
    created_at: string;
    updated_at: string;
    last_message_at: string | null;
    last_tool_at: string | null;
    last_error_at: string | null;
    pending_approvals: number;
    tool_activity_count: number;
    retry_count: number;
    recovery_state: ExecutionSessionSummary["recoveryState"];
    quota_pressure: ExecutionSessionSummary["quotaPressure"];
    unread_operator_signals: number;
  }>(
    `
      SELECT *
      FROM ${EXECUTION_SESSIONS_TABLE}
      ORDER BY updated_at DESC, created_at DESC
    `
  );

  return result.rows.map((row) =>
    createExecutionSessionSummary({
      id: row.id,
      externalSessionId: row.external_session_id,
      projectId: row.project_id,
      projectName: row.project_name,
      groupId: row.group_id,
      workspaceId: row.workspace_id,
      accountId: row.account_id,
      provider: row.provider,
      model: row.model,
      title: row.title,
      status: row.status,
      phase: row.phase,
      tags: asStringArray(row.tags),
      pinned: asBoolean(row.pinned),
      archived: asBoolean(row.archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
      lastToolAt: row.last_tool_at,
      lastErrorAt: row.last_error_at,
      pendingApprovals: asNumber(row.pending_approvals),
      toolActivityCount: asNumber(row.tool_activity_count),
      retryCount: asNumber(row.retry_count),
      recoveryState: row.recovery_state,
      quotaPressure: row.quota_pressure,
      unreadOperatorSignals: asNumber(row.unread_operator_signals),
    })
  );
}

export async function readExecutionSessionEventsFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await ensureSchema(pool);

  const result = await pool.query<{
    id: string;
    session_id: string;
    project_id: string;
    group_id: string | null;
    source: NormalizedExecutionEvent["source"];
    provider: NormalizedExecutionEvent["provider"];
    kind: NormalizedExecutionEvent["kind"];
    status: NormalizedExecutionEvent["status"] | null;
    phase: NormalizedExecutionEvent["phase"] | null;
    event_ts: string;
    summary: string;
    payload: unknown;
    raw: unknown;
  }>(
    `
      SELECT *
      FROM ${EXECUTION_SESSION_EVENTS_TABLE}
      ORDER BY event_ts ASC, id ASC
    `
  );

  return sortNormalizedEvents(
    result.rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      projectId: row.project_id,
      groupId: row.group_id,
      source: row.source,
      provider: row.provider,
      kind: row.kind,
      status: row.status ?? undefined,
      phase: row.phase,
      timestamp: row.event_ts,
      summary: row.summary,
      payload: parseJsonValue<Record<string, unknown>>(row.payload, {}),
      raw: parseJsonValue<Record<string, unknown> | null>(row.raw, null),
    }))
  );
}

export async function readApprovalRequestsFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await ensureSchema(pool);

  const result = await pool.query<{
    id: string;
    session_id: string;
    external_session_id: string | null;
    project_id: string;
    project_name: string;
    group_id: string | null;
    account_id: string | null;
    workspace_id: string | null;
    request_kind: ApprovalRequest["requestKind"];
    title: string;
    summary: string;
    reason: string | null;
    status: ApprovalRequest["status"];
    decision: ApprovalRequest["decision"] | null;
    requested_at: string;
    updated_at: string;
    resolved_at: string | null;
    resolved_by: string | null;
    expires_at: string | null;
    revision: number;
    raw: unknown;
  }>(
    `
      SELECT *
      FROM ${APPROVAL_REQUESTS_TABLE}
      ORDER BY requested_at DESC, id ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    externalSessionId: row.external_session_id,
    projectId: row.project_id,
    projectName: row.project_name,
    groupId: row.group_id,
    accountId: row.account_id,
    workspaceId: row.workspace_id,
    requestKind: row.request_kind,
    title: row.title,
    summary: row.summary,
    reason: row.reason,
    status: row.status,
    decision: row.decision,
    requestedAt: row.requested_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    expiresAt: row.expires_at,
    revision: asNumber(row.revision),
    raw: parseJsonValue<Record<string, unknown> | null>(row.raw, null),
  }));
}

export async function readRecoveryIncidentsFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await ensureSchema(pool);

  const result = await pool.query<{
    id: string;
    session_id: string;
    external_session_id: string | null;
    project_id: string;
    project_name: string;
    group_id: string | null;
    account_id: string | null;
    workspace_id: string | null;
    status: RecoveryIncident["status"];
    severity: RecoveryIncident["severity"];
    recovery_action_kind: RecoveryIncident["recoveryActionKind"];
    summary: string;
    root_cause: string | null;
    recommended_action: string | null;
    retry_count: number;
    opened_at: string;
    last_observed_at: string;
    updated_at: string;
    resolved_at: string | null;
    revision: number;
    raw: unknown;
  }>(
    `
      SELECT *
      FROM ${RECOVERY_INCIDENTS_TABLE}
      ORDER BY updated_at DESC, id ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    externalSessionId: row.external_session_id,
    projectId: row.project_id,
    projectName: row.project_name,
    groupId: row.group_id,
    accountId: row.account_id,
    workspaceId: row.workspace_id,
    status: row.status,
    severity: row.severity,
    recoveryActionKind: row.recovery_action_kind,
    summary: row.summary,
    rootCause: row.root_cause,
    recommendedAction: row.recommended_action,
    retryCount: asNumber(row.retry_count),
    openedAt: row.opened_at,
    lastObservedAt: row.last_observed_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    revision: asNumber(row.revision),
    raw: parseJsonValue<Record<string, unknown> | null>(row.raw, null),
  }));
}

export async function readAccountQuotaSnapshotsFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await ensureSchema(pool);

  const result = await pool.query<{
    account_id: string;
    auth_mode: AccountQuotaSnapshot["authMode"];
    source: AccountQuotaSnapshot["source"];
    observed_at: string;
    buckets: unknown;
    raw: unknown;
  }>(
    `
      SELECT *
      FROM ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE}
      ORDER BY observed_at DESC, account_id ASC
    `
  );

  return result.rows.map((row) => ({
    accountId: row.account_id,
    authMode: row.auth_mode,
    source: row.source,
    observedAt: row.observed_at,
    buckets: parseJsonValue<AccountQuotaSnapshot["buckets"]>(row.buckets, []),
    raw: parseJsonValue<Record<string, unknown> | null>(row.raw, null),
  }));
}

export async function readAccountQuotaUpdatesFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await ensureSchema(pool);

  const result = await pool.query<{
    sequence: number;
    account_id: string;
    source: AccountQuotaUpdate["source"];
    observed_at: string;
    summary: string;
    snapshot_json: unknown;
  }>(
    `
      SELECT *
      FROM ${ACCOUNT_QUOTA_UPDATES_TABLE}
      ORDER BY sequence ASC
    `
  );

  return result.rows.map((row) => ({
    sequence: asNumber(row.sequence),
    accountId: row.account_id,
    source: row.source,
    observedAt: row.observed_at,
    summary: row.summary,
    snapshot: parseJsonValue<AccountQuotaSnapshot>(row.snapshot_json, {
      accountId: row.account_id,
      authMode: "unknown",
      source: row.source,
      observedAt: row.observed_at,
      buckets: [],
      raw: null,
    }),
  }));
}

export async function readOperatorActionAuditEventsFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await ensureSchema(pool);

  const result = await pool.query<{
    id: string;
    sequence: number;
    session_id: string;
    project_id: string;
    group_id: string | null;
    target_kind: OperatorActionAuditEvent["targetKind"];
    target_id: string;
    kind: OperatorActionAuditEvent["kind"];
    outcome: OperatorActionAuditEvent["outcome"];
    actor_type: OperatorActionAuditEvent["actorType"];
    actor_id: string;
    occurred_at: string;
    summary: string;
    payload: unknown;
    raw: unknown;
  }>(
    `
      SELECT *
      FROM ${OPERATOR_ACTION_AUDIT_EVENTS_TABLE}
      ORDER BY sequence ASC, id ASC
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    sequence: asNumber(row.sequence),
    sessionId: row.session_id,
    projectId: row.project_id,
    groupId: row.group_id,
    targetKind: row.target_kind,
    targetId: row.target_id,
    kind: row.kind,
    outcome: row.outcome,
    actorType: row.actor_type,
    actorId: row.actor_id,
    occurredAt: row.occurred_at,
    summary: row.summary,
    payload: parseJsonValue<Record<string, unknown>>(row.payload, {}),
    raw: parseJsonValue<Record<string, unknown> | null>(row.raw, null),
  }));
}

export function resetControlPlanePostgresPoolForTests() {
  if (!cachedPool) {
    cachedPoolUrl = null;
    return;
  }

  const pool = cachedPool;
  cachedPool = null;
  cachedPoolUrl = null;
  void pool.end().catch(() => {
    // Ignore teardown failures in tests.
  });
}
