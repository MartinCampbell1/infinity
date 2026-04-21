import type { ControlPlaneDirectoryMeta } from "../contracts/control-plane-meta";
import type {
  OperatorActionAuditDetailResponse,
  OperatorActionAuditDirectory,
  OperatorActionAuditEvent,
  OperatorActionAuditSummary,
  OperatorActionAuditTargetSummary,
} from "../contracts/operator-actions";
import { getExecutionSessionSummaries } from "../sessions";
import {
  findMockApprovalRequest,
  listMockApprovalRequests,
} from "../approvals";
import {
  findMockRecoveryIncident,
  listMockRecoveryIncidents,
} from "../recoveries";
import {
  buildControlPlaneStateNotes,
  getControlPlaneIntegrationState,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
  getWiredControlPlaneDatabaseUrl,
  readControlPlaneState,
} from "../state/store";
import { readOperatorActionAuditEventsFromPostgres } from "../state/postgres";

const DIRECTORY_AT = "2026-04-11T00:00:00.000Z";

function cloneEvent(value: OperatorActionAuditEvent) {
  return JSON.parse(JSON.stringify(value)) as OperatorActionAuditEvent;
}

function sortOperatorActions(
  left: OperatorActionAuditEvent,
  right: OperatorActionAuditEvent
) {
  const occurredDelta = right.occurredAt.localeCompare(left.occurredAt);
  if (occurredDelta !== 0) {
    return occurredDelta;
  }

  const sequenceDelta = right.sequence - left.sequence;
  if (sequenceDelta !== 0) {
    return sequenceDelta;
  }

  return right.id.localeCompare(left.id);
}

async function directoryMeta(notes?: string[]): Promise<ControlPlaneDirectoryMeta> {
  await readControlPlaneState();

  return {
    generatedAt: DIRECTORY_AT,
    source: getControlPlaneStorageSource(),
    storageKind: getControlPlaneStorageKind(),
    integrationState: getControlPlaneIntegrationState(),
    canonicalTruth: "sessionId",
    notes:
      notes ??
      buildControlPlaneStateNotes([
        getControlPlaneStorageKind() === "postgres"
          ? "Audits are reading from the shell-owned Postgres relational operator-action model."
          : "Audits are reading from the unified shell-owned control-plane state file.",
        "Operator audits are derived from durable approval and recovery interventions keyed by sessionId.",
      ]),
  };
}

function buildSummary(
  events: readonly OperatorActionAuditEvent[]
): OperatorActionAuditSummary {
  return {
    total: events.length,
    approvals: events.filter((event) => event.targetKind === "approval_request")
      .length,
    recoveries: events.filter((event) => event.targetKind === "recovery_incident")
      .length,
    applied: events.filter((event) => event.outcome === "applied").length,
    idempotent: events.filter((event) => event.outcome === "idempotent").length,
    rejected: events.filter((event) => event.outcome === "rejected").length,
    deferred: events.filter((event) => event.outcome === "deferred").length,
    failed: events.filter((event) => event.outcome === "failed").length,
  };
}

export async function listMockOperatorActionAuditEvents() {
  const databaseUrl = await getWiredControlPlaneDatabaseUrl();
  if (databaseUrl) {
    const actions = await readOperatorActionAuditEventsFromPostgres(databaseUrl);
    return actions.sort(sortOperatorActions);
  }

  const state = await readControlPlaneState();
  return [...state.approvals.operatorActions, ...state.recoveries.operatorActions]
    .map(cloneEvent)
    .sort(sortOperatorActions);
}

export async function findMockOperatorActionAuditEvent(auditId: string) {
  return (
    (await listMockOperatorActionAuditEvents()).find((event) => event.id === auditId) ??
    null
  );
}

async function buildTargetSummary(
  event: OperatorActionAuditEvent
): Promise<OperatorActionAuditTargetSummary | null> {
  if (event.targetKind === "approval_request") {
    const approvalRequest = await findMockApprovalRequest(event.targetId);
    if (!approvalRequest) {
      return null;
    }

    return {
      id: approvalRequest.id,
      targetKind: event.targetKind,
      title: approvalRequest.title,
      summary: approvalRequest.summary,
      status: approvalRequest.status,
      sessionId: approvalRequest.sessionId,
      projectId: approvalRequest.projectId,
      projectName: approvalRequest.projectName,
      groupId: approvalRequest.groupId ?? null,
      accountId: approvalRequest.accountId ?? null,
      workspaceId: approvalRequest.workspaceId ?? null,
      revision: approvalRequest.revision,
    };
  }

  const recoveryIncident = await findMockRecoveryIncident(event.targetId);
  if (!recoveryIncident) {
    return null;
  }

  return {
    id: recoveryIncident.id,
    targetKind: event.targetKind,
    title: recoveryIncident.summary,
    summary: recoveryIncident.rootCause ?? recoveryIncident.summary,
    status: recoveryIncident.status,
    sessionId: recoveryIncident.sessionId,
    projectId: recoveryIncident.projectId,
    projectName: recoveryIncident.projectName,
    groupId: recoveryIncident.groupId ?? null,
    accountId: recoveryIncident.accountId ?? null,
    workspaceId: recoveryIncident.workspaceId ?? null,
    revision: recoveryIncident.revision,
  };
}

export async function buildMockOperatorActionAuditDirectory(): Promise<OperatorActionAuditDirectory> {
  const events = await listMockOperatorActionAuditEvents();

  return {
    ...await directoryMeta(),
    events,
    summary: buildSummary(events),
  };
}

export const buildOperatorActionAuditDirectory =
  buildMockOperatorActionAuditDirectory;

export async function buildMockOperatorActionAuditDetailResponse(
  auditId: string
): Promise<OperatorActionAuditDetailResponse | null> {
  const auditEvent = await findMockOperatorActionAuditEvent(auditId);
  if (!auditEvent) {
    return null;
  }

  const [directory, sessions, target] = await Promise.all([
    buildMockOperatorActionAuditDirectory(),
    getExecutionSessionSummaries(),
    buildTargetSummary(auditEvent),
  ]);

  return {
    ...directory,
    auditEvent,
    target,
    session:
      sessions.find((session) => session.id === auditEvent.sessionId) ?? null,
  };
}

export const buildOperatorActionAuditDetailResponse =
  buildMockOperatorActionAuditDetailResponse;

export async function listApprovalBackedAuditEvents() {
  const [events, approvals] = await Promise.all([
    listMockOperatorActionAuditEvents(),
    listMockApprovalRequests(),
  ]);
  const approvalIds = new Set(approvals.map((request) => request.id));

  return events.filter(
    (event) =>
      event.targetKind === "approval_request" && approvalIds.has(event.targetId)
  );
}

export async function listRecoveryBackedAuditEvents() {
  const [events, recoveries] = await Promise.all([
    listMockOperatorActionAuditEvents(),
    listMockRecoveryIncidents(),
  ]);
  const recoveryIds = new Set(recoveries.map((incident) => incident.id));

  return events.filter(
    (event) =>
      event.targetKind === "recovery_incident" && recoveryIds.has(event.targetId)
  );
}
