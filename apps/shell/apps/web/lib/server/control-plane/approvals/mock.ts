import type {
  ApprovalCreateRequest,
  ApprovalDecision,
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalRequestsDirectory,
  ApprovalRequestDetailResponse,
  ApprovalRespondResult,
} from "../contracts/approvals";
import type { ControlPlaneDirectoryMeta } from "../contracts/control-plane-meta";
import type { OperatorActionAuditEvent } from "../contracts/operator-actions";
import {
  type ExecutionProvider,
  type NormalizedExecutionEvent,
} from "../contracts/session-events";
import { materializeSessionProjections, sortNormalizedEvents } from "../events";
import { appendOperatorSessionEvent } from "../events/operator-events";
import {
  buildControlPlaneStateNotes,
  getControlPlaneStorageKind,
  getControlPlaneStorageSource,
  getControlPlaneIntegrationState,
  getWiredControlPlaneDatabaseUrl,
  readControlPlaneState,
  updateControlPlaneState,
} from "../state/store";
import {
  readApprovalRequestsFromPostgres,
  readOperatorActionAuditEventsFromPostgres,
} from "../state/postgres";

const DIRECTORY_AT = "2026-04-11T00:00:00.000Z";
const DEFAULT_MUTATION_AT = "2026-04-11T12:00:00.000Z";
const OPERATOR = "infinity-operator";

function cloneRequest(value: ApprovalRequest) {
  return JSON.parse(JSON.stringify(value)) as ApprovalRequest;
}

function cloneAction(value: OperatorActionAuditEvent) {
  return JSON.parse(JSON.stringify(value)) as OperatorActionAuditEvent;
}

function nowIso() {
  const value = new Date();
  return Number.isNaN(value.getTime()) ? DEFAULT_MUTATION_AT : value.toISOString();
}

function buildApprovalActionEvent(
  request: ApprovalRequest,
  decision: ApprovalDecision,
  outcome: "applied" | "idempotent" | "rejected",
  occurredAt: string,
  sequence: number,
  reason?: string
): OperatorActionAuditEvent {
  return {
    id: `operator-action-${String(sequence).padStart(3, "0")}`,
    sequence,
    sessionId: request.sessionId,
    projectId: request.projectId,
    groupId: request.groupId ?? null,
    targetKind: "approval_request",
    targetId: request.id,
    kind: "approval.responded",
    outcome,
    actorType: "operator",
    actorId: OPERATOR,
    occurredAt,
    summary:
      outcome === "rejected"
        ? `Rejected ${decision} for ${request.id}.`
        : `Applied ${decision} to ${request.id}.`,
    payload: {
      approvalId: request.id,
      decision,
      sessionId: request.sessionId,
      requestStatus: request.status,
      reason: reason ?? null,
    },
    raw: {
      source: getControlPlaneStorageSource(),
      storage: getControlPlaneStorageKind(),
    },
  };
}

function resolveSessionProvider(
  sessionEvents: readonly NormalizedExecutionEvent[],
  sessionId: string
): ExecutionProvider {
  const latest = sortNormalizedEvents(
    sessionEvents.filter((event) => event.sessionId === sessionId)
  ).at(-1);

  return latest?.provider ?? "unknown";
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
          ? "Approvals are backed by the shell-owned Postgres durability boundary."
          : "Approvals are backed by the unified shell-owned control-plane state file.",
        `Control plane source: ${getControlPlaneStorageSource()}.`,
      ]),
  };
}

async function summary() {
  const requests = await listApprovalRequests();
  const pending = requests.filter((request) => request.status === "pending").length;
  return {
    total: requests.length,
    pending,
    resolved: requests.length - pending,
  };
}

export async function listMockApprovalRequests() {
  const databaseUrl = await getWiredControlPlaneDatabaseUrl();
  if (databaseUrl) {
    return readApprovalRequestsFromPostgres(databaseUrl);
  }
  return (await readControlPlaneState()).approvals.requests;
}

export const listApprovalRequests = listMockApprovalRequests;

export async function listMockApprovalOperatorActions() {
  const databaseUrl = await getWiredControlPlaneDatabaseUrl();
  if (databaseUrl) {
    const actions = await readOperatorActionAuditEventsFromPostgres(databaseUrl);
    return actions.filter((event) => event.targetKind === "approval_request");
  }
  return (await readControlPlaneState()).approvals.operatorActions;
}

export const listApprovalOperatorActions = listMockApprovalOperatorActions;

export async function buildMockApprovalRequestsDirectory(): Promise<ApprovalRequestsDirectory> {
  return {
    ...await directoryMeta(),
    requests: await listMockApprovalRequests(),
    summary: await summary(),
    operatorActions: await listMockApprovalOperatorActions(),
  };
}

export const buildApprovalRequestsDirectory = buildMockApprovalRequestsDirectory;

export async function buildMockApprovalRequestDetailResponse(
  approvalId: string
): Promise<ApprovalRequestDetailResponse | null> {
  const approvalRequest = await findMockApprovalRequest(approvalId);
  if (!approvalRequest) {
    return null;
  }

  const directory = await buildMockApprovalRequestsDirectory();
  return {
    ...directory,
    approvalRequest,
    operatorActions: await listApprovalOperatorActionsForRequest(approvalId),
  };
}

export const buildApprovalRequestDetailResponse =
  buildMockApprovalRequestDetailResponse;

export async function findMockApprovalRequest(approvalId: string) {
  return (await listMockApprovalRequests()).find((request) => request.id === approvalId) ?? null;
}

export const findApprovalRequest = findMockApprovalRequest;

export async function listApprovalOperatorActionsForRequest(approvalId: string) {
  return (await listApprovalOperatorActions()).filter((event) => event.targetId === approvalId);
}

export async function createMockApprovalRequest(
  input: ApprovalCreateRequest
): Promise<ApprovalRequest | null> {
  const requestedAt = nowIso();
  const id =
    typeof input.id === "string" && input.id.trim()
      ? input.id.trim()
      : `approval-${requestedAt.replace(/[^0-9]/g, "")}`;
  let created: ApprovalRequest | null = null;
  let appendedEvent: NormalizedExecutionEvent | null = null;

  await updateControlPlaneState(
    (draft) => {
      if (draft.approvals.requests.some((request) => request.id === id)) {
        created = null;
        return;
      }

      created = {
        id,
        sessionId: input.sessionId,
        externalSessionId: input.externalSessionId ?? null,
        projectId: input.projectId,
        projectName: input.projectName,
        groupId: input.groupId ?? null,
        accountId: input.accountId ?? null,
        workspaceId: input.workspaceId ?? null,
        requestKind: input.requestKind,
        title: input.title,
        summary: input.summary,
        reason: input.reason ?? null,
        status: "pending",
        decision: null,
        requestedAt,
        updatedAt: requestedAt,
        resolvedAt: null,
        resolvedBy: null,
        expiresAt: input.expiresAt ?? null,
        revision: 1,
        raw: {
          ...(input.raw ?? {}),
          source: "control_plane_api",
          storage: getControlPlaneStorageKind(),
        },
      };

      draft.approvals.requests = [...draft.approvals.requests, created];
      appendedEvent = appendOperatorSessionEvent(draft, {
        sessionId: created.sessionId,
        projectId: created.projectId,
        groupId: created.groupId ?? null,
        source: "manual",
        provider: resolveSessionProvider(draft.sessions.events, created.sessionId),
        kind: "approval.requested",
        status: "in_progress",
        phase: "review",
        summary: created.summary,
        payload: {
          approvalId: created.id,
          requestKind: created.requestKind,
          title: created.title,
          summary: created.summary,
          reason: created.reason ?? null,
          sessionId: created.sessionId,
          projectId: created.projectId,
          groupId: created.groupId ?? null,
          accountId: created.accountId ?? null,
          workspaceId: created.workspaceId ?? null,
          requestedAt,
          projectName: created.projectName,
        },
        raw: {
          source: getControlPlaneStorageSource(),
          storage: getControlPlaneStorageKind(),
        },
      });
    },
    {
      buildRelationalDelta(nextState) {
        if (!created) {
          return null;
        }
        const session = materializeSessionProjections(nextState.sessions.events)[created.sessionId];

        return {
          sessions: session ? [session] : [],
          events: appendedEvent ? [appendedEvent] : [],
          approvals: [created],
          operatorActions: [],
        };
      },
    }
  );

  return created ? cloneRequest(created) : null;
}

export const createApprovalRequest = createMockApprovalRequest;

export async function respondToMockApprovalRequest(
  approvalId: string,
  decision: ApprovalDecision
): Promise<ApprovalRespondResult | null> {
  const current = await findMockApprovalRequest(approvalId);
  if (!current) {
    return null;
  }

  const occurredAt = nowIso();
  let idempotent = false;
  let accepted = false;
  let rejectedReason: string | null = null;
  let operatorAction: OperatorActionAuditEvent | null = null;
  let appendedEvent: NormalizedExecutionEvent | null = null;

  const { state, integrationState } = await updateControlPlaneState(
    (draft) => {
      const index = draft.approvals.requests.findIndex((request) => request.id === approvalId);
      if (index < 0) {
        return;
      }

      const draftCurrent = draft.approvals.requests[index];
      if (!draftCurrent) {
        return;
      }

      const sequence = draft.approvals.actionSequence++;

      if (draftCurrent.status !== "pending") {
        const repeatedDecision = draftCurrent.decision === decision;
        idempotent = repeatedDecision;
        accepted = repeatedDecision;
        rejectedReason = repeatedDecision
          ? null
          : "Approval request is already resolved and cannot change decision.";
        operatorAction = buildApprovalActionEvent(
          draftCurrent,
          decision,
          repeatedDecision ? "idempotent" : "rejected",
          occurredAt,
          sequence,
          repeatedDecision
            ? "approval_already_resolved_same_decision"
            : "approval_already_resolved_conflicting_decision"
        );
        draft.approvals.operatorActions = [...draft.approvals.operatorActions, operatorAction];
        return;
      }

      const updatedRequest: ApprovalRequest = {
        ...draftCurrent,
        status: (decision === "deny" ? "denied" : "approved") as ApprovalRequestStatus,
        decision,
        resolvedAt: occurredAt,
        resolvedBy: OPERATOR,
        updatedAt: occurredAt,
        revision: draftCurrent.revision + 1,
      };

      draft.approvals.requests = draft.approvals.requests.map((request, requestIndex) =>
        requestIndex === index ? updatedRequest : request
      );

      appendedEvent = appendOperatorSessionEvent(draft, {
        sessionId: updatedRequest.sessionId,
        projectId: updatedRequest.projectId,
        groupId: updatedRequest.groupId ?? null,
        source: "manual",
        provider: resolveSessionProvider(draft.sessions.events, updatedRequest.sessionId),
        kind: "approval.resolved",
        status: updatedRequest.status === "denied" ? "declined" : "completed",
        phase: null,
        summary:
          updatedRequest.status === "denied"
            ? `Approval ${updatedRequest.id} denied.`
            : `Approval ${updatedRequest.id} resolved.`,
        payload: {
          approvalId: updatedRequest.id,
          decision,
          approvalStatus: updatedRequest.status,
          requestStatus: updatedRequest.status,
          sessionId: updatedRequest.sessionId,
          projectId: updatedRequest.projectId,
          groupId: updatedRequest.groupId ?? null,
          accountId: updatedRequest.accountId ?? null,
          workspaceId: updatedRequest.workspaceId ?? null,
          resolvedAt: occurredAt,
          resolvedBy: OPERATOR,
          reason: updatedRequest.reason ?? null,
        },
        raw: {
          source: getControlPlaneStorageSource(),
          storage: getControlPlaneStorageKind(),
        },
      });

      idempotent = false;
      accepted = true;
      rejectedReason = null;
      operatorAction = buildApprovalActionEvent(
        updatedRequest,
        decision,
        "applied",
        occurredAt,
        sequence
      );
      draft.approvals.operatorActions = [...draft.approvals.operatorActions, operatorAction];
    },
    {
      buildRelationalDelta(nextState) {
        const approvalRequest =
          nextState.approvals.requests.find((request) => request.id === approvalId) ?? null;
        const sessionId = approvalRequest?.sessionId ?? current.sessionId;
        const session = materializeSessionProjections(nextState.sessions.events)[sessionId];

        return {
          sessions: appendedEvent && session ? [session] : [],
          events: appendedEvent ? [appendedEvent] : [],
          approvals: approvalRequest ? [approvalRequest] : [],
          operatorActions: operatorAction ? [operatorAction] : [],
        };
      },
    }
  );

  const approvalRequest =
    state.approvals.requests.find((request) => request.id === approvalId) ?? current;
  const resolvedOperatorAction =
    operatorAction ?? state.approvals.operatorActions[state.approvals.operatorActions.length - 1] ?? null;

  if (!resolvedOperatorAction) {
    return null;
  }

  return {
    approvalRequest: cloneRequest(approvalRequest),
    operatorAction: cloneAction(resolvedOperatorAction),
    idempotent,
    accepted,
    rejectedReason,
    integrationState,
  };
}

export const respondToApprovalRequest = respondToMockApprovalRequest;
