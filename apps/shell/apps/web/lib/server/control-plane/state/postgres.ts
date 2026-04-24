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
import { requiresFullDeploymentEnv } from "../workspace/rollout-config";
import {
  assertControlPlaneSchemaReady,
  readControlPlaneSchemaStatus,
  type Queryable,
} from "./schema";
import {
  TENANT_METADATA_KEY,
  activeControlPlaneTenantId,
  tenantIdForRecord,
} from "./tenancy";
import type {
  ControlPlaneIdempotencyRecord,
  ControlPlaneMutationEventRecord,
  ControlPlaneState,
} from "./types";

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
const CONTROL_PLANE_MUTATION_EVENTS_TABLE = "control_plane_mutation_events";
const CONTROL_PLANE_IDEMPOTENCY_RECORDS_TABLE =
  "control_plane_idempotency_records";

export interface ControlPlaneRelationalDelta {
  sessions?: ExecutionSessionSummary[];
  events?: NormalizedExecutionEvent[];
  approvals?: ApprovalRequest[];
  recoveries?: RecoveryIncident[];
  quotaSnapshots?: AccountQuotaSnapshot[];
  quotaUpdates?: AccountQuotaUpdate[];
  operatorActions?: OperatorActionAuditEvent[];
  mutationEvents?: ControlPlaneMutationEventRecord[];
  idempotencyRecords?: ControlPlaneIdempotencyRecord[];
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

function normalizeStoredControlPlaneState(
  state: ControlPlaneState,
): ControlPlaneState {
  return {
    ...state,
    mutations: state.mutations ?? {
      events: [],
      idempotency: [],
    },
  };
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

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type TenantAuditedRecord = Parameters<typeof tenantIdForRecord>[0] & {
  createdBy?: unknown;
  updatedBy?: unknown;
};

function actorIdFromContext(value: unknown) {
  const actorContext = objectValue(value);
  return normalizeString(actorContext?.actorId);
}

function metadataFromRaw(raw: unknown) {
  const rawObject = objectValue(raw);
  if (!rawObject) {
    return null;
  }
  return objectValue(rawObject[TENANT_METADATA_KEY]);
}

function auditFieldFromRecord(
  record: TenantAuditedRecord,
  field: "createdBy" | "updatedBy",
) {
  const direct = normalizeString(record[field]);
  if (direct) {
    return direct;
  }

  const metadata = metadataFromRaw(record.raw);
  const metadataField = normalizeString(metadata?.[field]);
  if (metadataField) {
    return metadataField;
  }

  const payload = objectValue(record.payload);
  const payloadActorId = actorIdFromContext(payload?.actorContext);
  if (payloadActorId) {
    return payloadActorId;
  }

  return actorIdFromContext(record.actorContext);
}

function tenantRowFields(record: TenantAuditedRecord) {
  return {
    tenant_id: tenantIdForRecord(record),
    created_by: auditFieldFromRecord(record, "createdBy"),
    updated_by: auditFieldFromRecord(record, "updatedBy"),
  };
}

async function setTenantRlsContext(client: PoolClient, tenantId: string) {
  await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [
    tenantId,
  ]);
}

function collectStateTenantIds(state: ControlPlaneState) {
  const tenantIds = new Set<string>();
  for (const tenant of state.tenancy.tenants) {
    tenantIds.add(tenant.id);
  }
  for (const record of [
    ...Object.values(materializeSessionProjections(state.sessions.events)),
    ...state.sessions.events,
    ...state.approvals.requests,
    ...state.recoveries.incidents,
    ...state.accounts.snapshots,
    ...state.accounts.updates,
    ...state.approvals.operatorActions,
    ...state.recoveries.operatorActions,
  ]) {
    tenantIds.add(tenantIdForRecord(record as TenantAuditedRecord));
  }
  if (tenantIds.size === 0) {
    tenantIds.add(activeControlPlaneTenantId());
  }
  return Array.from(tenantIds).sort();
}

async function deleteReadModelTablesForTenant(
  client: PoolClient,
  tenantId: string,
) {
  await setTenantRlsContext(client, tenantId);
  await client.query(
    `DELETE FROM ${EXECUTION_SESSION_EVENTS_TABLE} WHERE tenant_id = $1`,
    [tenantId],
  );
  await client.query(
    `DELETE FROM ${RECOVERY_INCIDENTS_TABLE} WHERE tenant_id = $1`,
    [tenantId],
  );
  await client.query(
    `DELETE FROM ${APPROVAL_REQUESTS_TABLE} WHERE tenant_id = $1`,
    [tenantId],
  );
  await client.query(
    `DELETE FROM ${ACCOUNT_QUOTA_UPDATES_TABLE} WHERE tenant_id = $1`,
    [tenantId],
  );
  await client.query(
    `DELETE FROM ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE} WHERE tenant_id = $1`,
    [tenantId],
  );
  await client.query(
    `DELETE FROM ${OPERATOR_ACTION_AUDIT_EVENTS_TABLE} WHERE tenant_id = $1`,
    [tenantId],
  );
  await client.query(
    `DELETE FROM ${EXECUTION_SESSIONS_TABLE} WHERE tenant_id = $1`,
    [tenantId],
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
    ...tenantRowFields(request),
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
    ...tenantRowFields(incident),
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
    ...tenantRowFields(action),
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
    ...tenantRowFields(snapshot),
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
    ...tenantRowFields(update),
    sequence: update.sequence,
    account_id: update.accountId,
    source: update.source,
    observed_at: update.observedAt,
    summary: update.summary,
    snapshot_json: JSON.stringify(update.snapshot),
    actor_context: JSON.stringify(update.actorContext ?? null),
  };
}

function toExecutionSessionRow(session: ExecutionSessionSummary) {
  return {
    ...tenantRowFields(session),
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
    ...tenantRowFields(event),
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

function toMutationEventRow(event: ControlPlaneMutationEventRecord) {
  return {
    tenant_id: event.tenantId,
    id: event.id,
    mutation_kind: event.mutationKind,
    resource_kind: event.resourceKind,
    resource_id: event.resourceId,
    idempotency_key: event.idempotencyKey ?? null,
    actor_id: event.actorId ?? null,
    request_hash: event.requestHash ?? null,
    payload: JSON.stringify(event.payload ?? {}),
    response_json: JSON.stringify(event.responseJson ?? null),
    status_code: event.statusCode ?? null,
    occurred_at: event.occurredAt,
  };
}

function toIdempotencyRecordRow(record: ControlPlaneIdempotencyRecord) {
  return {
    tenant_id: record.tenantId,
    idempotency_key: record.idempotencyKey,
    request_hash: record.requestHash,
    mutation_event_id: record.mutationEventId,
    status: record.status,
    status_code: record.statusCode,
    response_json: JSON.stringify(record.responseJson),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
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

async function assertRuntimeSchema(queryable: Queryable) {
  await assertControlPlaneSchemaReady(queryable);
}

async function lockControlPlaneMutationScope(
  client: PoolClient,
  params: { tenantId: string; resourceId: string },
) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [
    params.tenantId,
    params.resourceId,
  ]);
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

  for (const tenantId of collectStateTenantIds(state)) {
    await deleteReadModelTablesForTenant(client, tenantId);
  }

  for (const session of sessionSummaries) {
    const row = toExecutionSessionRow(session);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${EXECUTION_SESSIONS_TABLE} (
          id, external_session_id, project_id, project_name, group_id, workspace_id,
          account_id, provider, model, title, status, phase, tags, pinned, archived,
          created_at, updated_at, last_message_at, last_tool_at, last_error_at,
          pending_approvals, tool_activity_count, retry_count, recovery_state,
          quota_pressure, unread_operator_signals, tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27, $28, $29
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
      ]
    );
  }

  for (const event of sessionEvents) {
    const row = toExecutionEventRow(event);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${EXECUTION_SESSION_EVENTS_TABLE} (
          id, session_id, project_id, group_id, source, provider, kind, status,
          phase, event_ts, summary, payload, raw, tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
      ]
    );
  }

  for (const request of state.approvals.requests) {
    const row = toApprovalRequestRow(request, sessionMap);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${APPROVAL_REQUESTS_TABLE} (
          id, session_id, external_session_id, project_id, project_name, group_id,
          account_id, workspace_id, provider, request_kind, title, summary, reason,
          status, decision, requested_at, updated_at, resolved_at, resolved_by,
          expires_at, revision, raw, tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21, $22::jsonb, $23, $24, $25
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
      ]
    );
  }

  for (const incident of state.recoveries.incidents) {
    const row = toRecoveryIncidentRow(incident);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${RECOVERY_INCIDENTS_TABLE} (
          id, session_id, external_session_id, project_id, project_name, group_id,
          account_id, workspace_id, status, severity, recovery_action_kind, summary,
          root_cause, recommended_action, retry_count, opened_at, last_observed_at,
          updated_at, resolved_at, revision, raw, tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21::jsonb, $22, $23, $24
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
      ]
    );
  }

  for (const snapshot of state.accounts.snapshots) {
    const row = toAccountQuotaSnapshotRow(snapshot);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE} (
          id, account_id, auth_mode, source, observed_at, buckets, raw,
          tenant_id, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
      `,
      [
        row.id,
        row.account_id,
        row.auth_mode,
        row.source,
        row.observed_at,
        row.buckets,
        row.raw,
        row.tenant_id,
        row.created_by,
        row.updated_by,
      ]
    );
  }

  for (const update of state.accounts.updates) {
    const row = toAccountQuotaUpdateRow(update);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${ACCOUNT_QUOTA_UPDATES_TABLE} (
          sequence, account_id, source, observed_at, summary, snapshot_json, actor_context,
          tenant_id, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
      `,
      [
        row.sequence,
        row.account_id,
        row.source,
        row.observed_at,
        row.summary,
        row.snapshot_json,
        row.actor_context,
        row.tenant_id,
        row.created_by,
        row.updated_by,
      ]
    );
  }

  for (const action of operatorActions) {
    const row = toOperatorActionRow(action);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${OPERATOR_ACTION_AUDIT_EVENTS_TABLE} (
          id, sequence, session_id, project_id, group_id, target_kind, target_id,
          kind, outcome, actor_type, actor_id, occurred_at, summary, payload, raw,
          tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb,
          $16, $17, $18
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
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
    (delta.operatorActions?.length ?? 0) > 0 ||
    (delta.mutationEvents?.length ?? 0) > 0 ||
    (delta.idempotencyRecords?.length ?? 0) > 0
  );
}

function buildFullRelationalDelta(
  state: ControlPlaneState,
): ControlPlaneRelationalDelta {
  return {
    sessions: Object.values(materializeSessionProjections(state.sessions.events)),
    events: sortNormalizedEvents(state.sessions.events),
    approvals: state.approvals.requests,
    recoveries: state.recoveries.incidents,
    quotaSnapshots: state.accounts.snapshots,
    quotaUpdates: state.accounts.updates,
    operatorActions: [
      ...state.approvals.operatorActions,
      ...state.recoveries.operatorActions,
    ],
    mutationEvents: state.mutations.events,
    idempotencyRecords: state.mutations.idempotency,
  };
}

async function upsertExecutionSessions(
  client: PoolClient,
  sessions: readonly ExecutionSessionSummary[]
) {
  for (const session of sessions) {
    const row = toExecutionSessionRow(session);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${EXECUTION_SESSIONS_TABLE} (
          id, external_session_id, project_id, project_name, group_id, workspace_id,
          account_id, provider, model, title, status, phase, tags, pinned, archived,
          created_at, updated_at, last_message_at, last_tool_at, last_error_at,
          pending_approvals, tool_activity_count, retry_count, recovery_state,
          quota_pressure, unread_operator_signals, tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27, $28, $29
        )
        ON CONFLICT (tenant_id, id) DO UPDATE SET
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
          unread_operator_signals = EXCLUDED.unread_operator_signals,
          tenant_id = EXCLUDED.tenant_id,
          created_by = COALESCE(${EXECUTION_SESSIONS_TABLE}.created_by, EXCLUDED.created_by),
          updated_by = EXCLUDED.updated_by
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
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
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${EXECUTION_SESSION_EVENTS_TABLE} (
          id, session_id, project_id, group_id, source, provider, kind, status,
          phase, event_ts, summary, payload, raw, tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16
        )
        ON CONFLICT (tenant_id, id) DO UPDATE SET
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
          raw = EXCLUDED.raw,
          tenant_id = EXCLUDED.tenant_id,
          created_by = COALESCE(${EXECUTION_SESSION_EVENTS_TABLE}.created_by, EXCLUDED.created_by),
          updated_by = EXCLUDED.updated_by
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
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
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${APPROVAL_REQUESTS_TABLE} (
          id, session_id, external_session_id, project_id, project_name, group_id,
          account_id, workspace_id, provider, request_kind, title, summary, reason,
          status, decision, requested_at, updated_at, resolved_at, resolved_by,
          expires_at, revision, raw, tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21, $22::jsonb, $23, $24, $25
        )
        ON CONFLICT (tenant_id, id) DO UPDATE SET
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
          raw = EXCLUDED.raw,
          tenant_id = EXCLUDED.tenant_id,
          created_by = COALESCE(${APPROVAL_REQUESTS_TABLE}.created_by, EXCLUDED.created_by),
          updated_by = EXCLUDED.updated_by
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
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
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${RECOVERY_INCIDENTS_TABLE} (
          id, session_id, external_session_id, project_id, project_name, group_id,
          account_id, workspace_id, status, severity, recovery_action_kind, summary,
          root_cause, recommended_action, retry_count, opened_at, last_observed_at,
          updated_at, resolved_at, revision, raw, tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21::jsonb, $22, $23, $24
        )
        ON CONFLICT (tenant_id, id) DO UPDATE SET
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
          raw = EXCLUDED.raw,
          tenant_id = EXCLUDED.tenant_id,
          created_by = COALESCE(${RECOVERY_INCIDENTS_TABLE}.created_by, EXCLUDED.created_by),
          updated_by = EXCLUDED.updated_by
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
      ]
    );
  }
}

async function syncAccountQuotaSnapshots(
  client: PoolClient,
  snapshots: readonly AccountQuotaSnapshot[]
) {
  const accountScopes = Array.from(
    new Map(
      snapshots.map((snapshot) => {
        const row = toAccountQuotaSnapshotRow(snapshot);
        return [`${row.tenant_id}:${row.account_id}`, row] as const;
      }),
    ).values(),
  );

  for (const row of accountScopes) {
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `DELETE FROM ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE} WHERE tenant_id = $1 AND account_id = $2`,
      [row.tenant_id, row.account_id]
    );
  }

  for (const snapshot of snapshots) {
    const row = toAccountQuotaSnapshotRow(snapshot);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${ACCOUNT_QUOTA_SNAPSHOTS_TABLE} (
          id, account_id, auth_mode, source, observed_at, buckets, raw,
          tenant_id, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
        ON CONFLICT (tenant_id, id) DO UPDATE SET
          account_id = EXCLUDED.account_id,
          auth_mode = EXCLUDED.auth_mode,
          source = EXCLUDED.source,
          observed_at = EXCLUDED.observed_at,
          buckets = EXCLUDED.buckets,
          raw = EXCLUDED.raw,
          tenant_id = EXCLUDED.tenant_id,
          created_by = COALESCE(${ACCOUNT_QUOTA_SNAPSHOTS_TABLE}.created_by, EXCLUDED.created_by),
          updated_by = EXCLUDED.updated_by
      `,
      [
        row.id,
        row.account_id,
        row.auth_mode,
        row.source,
        row.observed_at,
        row.buckets,
        row.raw,
        row.tenant_id,
        row.created_by,
        row.updated_by,
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
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${ACCOUNT_QUOTA_UPDATES_TABLE} (
          sequence, account_id, source, observed_at, summary, snapshot_json, actor_context,
          tenant_id, created_by, updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
        ON CONFLICT (tenant_id, sequence) DO UPDATE SET
          account_id = EXCLUDED.account_id,
          source = EXCLUDED.source,
          observed_at = EXCLUDED.observed_at,
          summary = EXCLUDED.summary,
          snapshot_json = EXCLUDED.snapshot_json,
          actor_context = EXCLUDED.actor_context,
          tenant_id = EXCLUDED.tenant_id,
          created_by = COALESCE(${ACCOUNT_QUOTA_UPDATES_TABLE}.created_by, EXCLUDED.created_by),
          updated_by = EXCLUDED.updated_by
      `,
      [
        row.sequence,
        row.account_id,
        row.source,
        row.observed_at,
        row.summary,
        row.snapshot_json,
        row.actor_context,
        row.tenant_id,
        row.created_by,
        row.updated_by,
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
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${OPERATOR_ACTION_AUDIT_EVENTS_TABLE} (
          id, sequence, session_id, project_id, group_id, target_kind, target_id,
          kind, outcome, actor_type, actor_id, occurred_at, summary, payload, raw,
          tenant_id, created_by, updated_by
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb,
          $16, $17, $18
        )
        ON CONFLICT (tenant_id, id) DO UPDATE SET
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
          raw = EXCLUDED.raw,
          tenant_id = EXCLUDED.tenant_id,
          created_by = COALESCE(${OPERATOR_ACTION_AUDIT_EVENTS_TABLE}.created_by, EXCLUDED.created_by),
          updated_by = EXCLUDED.updated_by
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
        row.tenant_id,
        row.created_by,
        row.updated_by,
      ]
    );
  }
}

async function appendControlPlaneMutationEvents(
  client: PoolClient,
  events: readonly ControlPlaneMutationEventRecord[],
) {
  for (const event of events) {
    const row = toMutationEventRow(event);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${CONTROL_PLANE_MUTATION_EVENTS_TABLE} (
          tenant_id, id, mutation_kind, resource_kind, resource_id,
          idempotency_key, actor_id, request_hash, payload, response_json,
          status_code, occurred_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9::jsonb, $10::jsonb,
          $11, $12
        )
        ON CONFLICT (tenant_id, id) DO NOTHING
      `,
      [
        row.tenant_id,
        row.id,
        row.mutation_kind,
        row.resource_kind,
        row.resource_id,
        row.idempotency_key,
        row.actor_id,
        row.request_hash,
        row.payload,
        row.response_json,
        row.status_code,
        row.occurred_at,
      ],
    );
  }
}

async function upsertControlPlaneIdempotencyRecords(
  client: PoolClient,
  records: readonly ControlPlaneIdempotencyRecord[],
) {
  for (const record of records) {
    const row = toIdempotencyRecordRow(record);
    await setTenantRlsContext(client, row.tenant_id);
    await client.query(
      `
        INSERT INTO ${CONTROL_PLANE_IDEMPOTENCY_RECORDS_TABLE} (
          tenant_id, idempotency_key, request_hash, mutation_event_id, status,
          status_code, response_json, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
        ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET
          mutation_event_id = EXCLUDED.mutation_event_id,
          status = EXCLUDED.status,
          status_code = EXCLUDED.status_code,
          response_json = EXCLUDED.response_json,
          updated_at = EXCLUDED.updated_at
        WHERE ${CONTROL_PLANE_IDEMPOTENCY_RECORDS_TABLE}.request_hash = EXCLUDED.request_hash
      `,
      [
        row.tenant_id,
        row.idempotency_key,
        row.request_hash,
        row.mutation_event_id,
        row.status,
        row.status_code,
        row.response_json,
        row.created_at,
        row.updated_at,
      ],
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
  if ((delta.mutationEvents?.length ?? 0) > 0) {
    await appendControlPlaneMutationEvents(client, delta.mutationEvents ?? []);
  }
  if ((delta.idempotencyRecords?.length ?? 0) > 0) {
    await upsertControlPlaneIdempotencyRecords(
      client,
      delta.idempotencyRecords ?? [],
    );
  }
}

export async function readControlPlaneStateFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await assertRuntimeSchema(pool);

  const result = await pool.query<{
    state_json: ControlPlaneState;
  }>(`SELECT state_json FROM ${CONTROL_PLANE_STATE_TABLE} WHERE id = 1`);

  const state = result.rows[0]?.state_json ?? null;
  return state ? normalizeStoredControlPlaneState(state) : null;
}

export async function readControlPlaneSchemaStatusFromPostgres(
  connectionString: string,
) {
  const pool = getPool(connectionString);
  return readControlPlaneSchemaStatus(pool);
}

export async function writeControlPlaneStateToPostgres(
  connectionString: string,
  state: ControlPlaneState,
  relationalDelta?: ControlPlaneRelationalDelta | null,
  options?: {
    lockTenantId?: string | null;
    lockResourceId?: string | null;
  },
) {
  const pool = getPool(connectionString);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertRuntimeSchema(client);
    const lockTenantId = options?.lockTenantId ?? activeControlPlaneTenantId();
    await setTenantRlsContext(client, lockTenantId);
    await lockControlPlaneMutationScope(client, {
      tenantId: lockTenantId,
      resourceId: options?.lockResourceId ?? "control-plane-state",
    });
    await client.query(
      `
        INSERT INTO ${CONTROL_PLANE_STATE_TABLE} (id, state_json, updated_at)
        VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()
      `,
      [JSON.stringify(state)]
    );
    const effectiveDelta = hasRelationalDelta(relationalDelta)
      ? relationalDelta!
      : requiresFullDeploymentEnv()
        ? buildFullRelationalDelta(state)
        : null;
    if (effectiveDelta) {
      await applyControlPlaneRelationalDelta(client, effectiveDelta);
    } else {
      await replaceReadModelTables(client, state);
      await applyControlPlaneRelationalDelta(client, {
        mutationEvents: state.mutations.events,
        idempotencyRecords: state.mutations.idempotency,
      });
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

export async function updateControlPlaneStateInPostgres(
  connectionString: string,
  fallbackState: ControlPlaneState,
  mutate: (draft: ControlPlaneState) => void | Promise<void>,
  options?: {
    buildRelationalDelta?: (
      state: ControlPlaneState,
    ) => ControlPlaneRelationalDelta | null | undefined;
    lockTenantId?: string | null;
    lockResourceId?: string | null;
  },
) {
  const pool = getPool(connectionString);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await assertRuntimeSchema(client);
    const lockTenantId = options?.lockTenantId ?? activeControlPlaneTenantId();
    await setTenantRlsContext(client, lockTenantId);
    await lockControlPlaneMutationScope(client, {
      tenantId: lockTenantId,
      resourceId: options?.lockResourceId ?? "control-plane-state",
    });

    const current = await client.query<{ state_json: ControlPlaneState }>(
      `SELECT state_json FROM ${CONTROL_PLANE_STATE_TABLE} WHERE id = 1 FOR UPDATE`,
    );
    const draft = normalizeStoredControlPlaneState(
      parseJsonValue<ControlPlaneState>(
        current.rows[0]?.state_json,
        fallbackState,
      ),
    );
    await mutate(draft);
    const relationalDelta = options?.buildRelationalDelta?.(draft) ?? null;

    await client.query(
      `
        INSERT INTO ${CONTROL_PLANE_STATE_TABLE} (id, state_json, updated_at)
        VALUES (1, $1::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET state_json = EXCLUDED.state_json, updated_at = NOW()
      `,
      [JSON.stringify(draft)],
    );

    const effectiveDelta = hasRelationalDelta(relationalDelta)
      ? relationalDelta!
      : requiresFullDeploymentEnv()
        ? buildFullRelationalDelta(draft)
        : null;
    if (effectiveDelta) {
      await applyControlPlaneRelationalDelta(client, effectiveDelta);
    } else {
      await replaceReadModelTables(client, draft);
      await applyControlPlaneRelationalDelta(client, {
        mutationEvents: draft.mutations.events,
        idempotencyRecords: draft.mutations.idempotency,
      });
    }
    await client.query("COMMIT");
    return draft;
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
  await assertRuntimeSchema(pool);

  const result = await pool.query<{
    id: string;
    tenant_id: string;
    created_by: string | null;
    updated_by: string | null;
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
      tenantId: row.tenant_id,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
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
  await assertRuntimeSchema(pool);

  const result = await pool.query<{
    id: string;
    tenant_id: string;
    created_by: string | null;
    updated_by: string | null;
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
      tenantId: row.tenant_id,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
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
  await assertRuntimeSchema(pool);

  const result = await pool.query<{
    id: string;
    tenant_id: string;
    created_by: string | null;
    updated_by: string | null;
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
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
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
  await assertRuntimeSchema(pool);

  const result = await pool.query<{
    id: string;
    tenant_id: string;
    created_by: string | null;
    updated_by: string | null;
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
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
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
  await assertRuntimeSchema(pool);

  const result = await pool.query<{
    account_id: string;
    tenant_id: string;
    created_by: string | null;
    updated_by: string | null;
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
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
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
  await assertRuntimeSchema(pool);

  const result = await pool.query<{
    sequence: number;
    tenant_id: string;
    created_by: string | null;
    updated_by: string | null;
    account_id: string;
    source: AccountQuotaUpdate["source"];
    observed_at: string;
    summary: string;
    snapshot_json: unknown;
    actor_context: unknown;
  }>(
    `
      SELECT *
      FROM ${ACCOUNT_QUOTA_UPDATES_TABLE}
      ORDER BY sequence ASC
    `
  );

  return result.rows.map((row) => ({
    sequence: asNumber(row.sequence),
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
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
    actorContext: parseJsonValue<AccountQuotaUpdate["actorContext"]>(
      row.actor_context,
      null
    ),
  }));
}

export async function readOperatorActionAuditEventsFromPostgres(
  connectionString: string
) {
  const pool = getPool(connectionString);
  await assertRuntimeSchema(pool);

  const result = await pool.query<{
    id: string;
    tenant_id: string;
    created_by: string | null;
    updated_by: string | null;
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
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
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
