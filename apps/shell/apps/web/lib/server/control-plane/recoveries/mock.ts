import type { ControlPlaneDirectoryMeta } from "../contracts/control-plane-meta";
import type { OperatorActionAuditEvent } from "../contracts/operator-actions";
import type {
  RecoveryActionContext,
  RecoveryActionKind,
  RecoveryIncidentDetailResponse,
  RecoveryIncidentsDirectoryFilters,
  RecoveryRecordActionResult,
  RecoveryIncident,
  RecoveryIncidentStatus,
  RecoveryIncidentsDirectory,
} from "../contracts/recoveries";
import {
  materializeSessionProjections,
  sortNormalizedEvents,
  type ExecutionProvider,
  type NormalizedExecutionEvent,
} from "../events";
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
  readOperatorActionAuditEventsFromPostgres,
  readRecoveryIncidentsFromPostgres,
} from "../state/postgres";

const DIRECTORY_AT = "2026-04-11T00:00:00.000Z";
const DEFAULT_MUTATION_AT = "2026-04-11T12:05:00.000Z";
const OPERATOR = "infinity-operator";

function cloneIncident(value: RecoveryIncident) {
  return JSON.parse(JSON.stringify(value)) as RecoveryIncident;
}

function cloneAction(value: OperatorActionAuditEvent) {
  return JSON.parse(JSON.stringify(value)) as OperatorActionAuditEvent;
}

function nowIso() {
  const value = new Date();
  return Number.isNaN(value.getTime()) ? DEFAULT_MUTATION_AT : value.toISOString();
}

function normalizeFilterValue(value: string | null | undefined) {
  return (value || "").trim();
}

function incidentInitiativeId(incident: RecoveryIncident) {
  const rawInitiativeId = incident.raw?.initiativeId;
  return typeof rawInitiativeId === "string" ? rawInitiativeId : "";
}

function matchesRecoveryIncidentFilters(
  incident: RecoveryIncident,
  filters?: RecoveryIncidentsDirectoryFilters | null
) {
  const sessionId = normalizeFilterValue(filters?.sessionId);
  const projectId = normalizeFilterValue(filters?.projectId);
  const initiativeId = normalizeFilterValue(filters?.initiativeId);
  const groupId = normalizeFilterValue(filters?.groupId);
  const accountId = normalizeFilterValue(filters?.accountId);
  const workspaceId = normalizeFilterValue(filters?.workspaceId);

  if (sessionId && incident.sessionId !== sessionId) {
    return false;
  }
  if (projectId && incident.projectId !== projectId) {
    return false;
  }
  if (
    initiativeId &&
    incident.projectId !== initiativeId &&
    incidentInitiativeId(incident) !== initiativeId
  ) {
    return false;
  }
  if (groupId && (incident.groupId ?? "") !== groupId) {
    return false;
  }
  if (accountId && (incident.accountId ?? "") !== accountId) {
    return false;
  }
  if (workspaceId && (incident.workspaceId ?? "") !== workspaceId) {
    return false;
  }

  return true;
}

function filterRecoveryIncidents(
  incidents: readonly RecoveryIncident[],
  filters?: RecoveryIncidentsDirectoryFilters | null
) {
  return incidents.filter((incident) => matchesRecoveryIncidentFilters(incident, filters));
}

function buildRecoveryActionEvent(
  incident: RecoveryIncident,
  actionKind: RecoveryActionKind,
  outcome: "applied" | "idempotent" | "rejected",
  occurredAt: string,
  sequence: number,
  reason?: string,
  context?: RecoveryActionContext
): OperatorActionAuditEvent {
  const kind =
    actionKind === "retry"
      ? "recovery.retry_requested"
      : actionKind === "failover"
        ? "recovery.failover_requested"
        : actionKind === "resolve"
          ? "recovery.resolved"
          : "recovery.reopened";

  return {
    id: `operator-action-${String(sequence).padStart(3, "0")}`,
    sequence,
    sessionId: incident.sessionId,
    projectId: incident.projectId,
    groupId: incident.groupId ?? null,
    targetKind: "recovery_incident",
    targetId: incident.id,
    kind,
    outcome,
    actorType: "operator",
    actorId: OPERATOR,
    occurredAt,
    summary:
      outcome === "rejected"
        ? `Rejected ${actionKind} for ${incident.id}.`
        : `Applied ${actionKind} to ${incident.id}.`,
    payload: {
      recoveryId: incident.id,
      actionKind,
      sessionId: incident.sessionId,
      recoveryStatus: incident.status,
      targetAccountId: context?.targetAccountId ?? null,
      reason: reason ?? null,
    },
    raw: {
      source: getControlPlaneStorageSource(),
      storage: getControlPlaneStorageKind(),
    },
  };
}

function resolveRecoverySessionProvider(
  state: Awaited<ReturnType<typeof readControlPlaneState>>,
  sessionId: string
): ExecutionProvider {
  const latestSessionEvent = sortNormalizedEvents(
    state.sessions.events.filter((event) => event.sessionId === sessionId)
  ).at(-1);

  return latestSessionEvent?.provider ?? "unknown";
}

function appendRecoverySessionEvent(
  state: Awaited<ReturnType<typeof readControlPlaneState>>,
  incident: RecoveryIncident,
  actionKind: RecoveryActionKind,
  occurredAt: string,
  previousStatus: RecoveryIncidentStatus,
  updatedIncident: RecoveryIncident,
  context?: RecoveryActionContext
) {
  const provider = resolveRecoverySessionProvider(state, incident.sessionId);
  const isCompleted = actionKind === "resolve";

  return appendOperatorSessionEvent(state, {
    sessionId: incident.sessionId,
    projectId: incident.projectId,
    groupId: incident.groupId ?? null,
    source: "manual",
    provider,
    kind: isCompleted ? "recovery.completed" : "recovery.started",
    status: isCompleted ? "completed" : "in_progress",
    phase: isCompleted ? "completed" : "blocked",
    summary: isCompleted
      ? `Recovery resolved for ${incident.id}.`
      : `Recovery ${actionKind} started for ${incident.id}.`,
    payload: {
      recoveryId: incident.id,
      recoveryActionKind: actionKind,
      sessionId: incident.sessionId,
      projectId: incident.projectId,
      groupId: incident.groupId ?? null,
      accountId: updatedIncident.accountId ?? null,
      externalSessionId: updatedIncident.externalSessionId ?? null,
      previousRecoveryStatus: previousStatus,
      recoveryStatus: updatedIncident.status,
      targetAccountId: context?.targetAccountId ?? null,
      retryCount: updatedIncident.retryCount,
      resolvedAt: updatedIncident.resolvedAt ?? null,
      recoveryRevision: updatedIncident.revision,
    },
    raw: {
      source: getControlPlaneStorageSource(),
      storage: getControlPlaneStorageKind(),
    },
    timestamp: occurredAt,
  });
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
          ? "Recoveries are backed by the shell-owned Postgres durability boundary."
          : "Recoveries are backed by the unified shell-owned control-plane state file.",
        `Control plane source: ${getControlPlaneStorageSource()}.`,
      ]),
  };
}

function summarizeRecoveryIncidents(incidents: readonly RecoveryIncident[]) {
  return {
    total: incidents.length,
    open: incidents.filter((incident) => incident.status === "open").length,
    retryable: incidents.filter((incident) => incident.status === "retryable").length,
    failingOver: incidents.filter((incident) => incident.status === "failing_over").length,
    recovered: incidents.filter((incident) => incident.status === "recovered").length,
    dead: incidents.filter((incident) => incident.status === "dead").length,
  };
}

export async function listMockRecoveryIncidents() {
  const databaseUrl = await getWiredControlPlaneDatabaseUrl();
  if (databaseUrl) {
    return readRecoveryIncidentsFromPostgres(databaseUrl);
  }
  return (await readControlPlaneState()).recoveries.incidents;
}

export async function listMockRecoveryOperatorActions() {
  const databaseUrl = await getWiredControlPlaneDatabaseUrl();
  if (databaseUrl) {
    const actions = await readOperatorActionAuditEventsFromPostgres(databaseUrl);
    return actions.filter((event) => event.targetKind === "recovery_incident");
  }
  return (await readControlPlaneState()).recoveries.operatorActions;
}

export const listRecoveryOperatorActions = listMockRecoveryOperatorActions;
export const listRecoveryIncidents = listMockRecoveryIncidents;

export async function buildMockRecoveryIncidentsDirectory(
  filters?: RecoveryIncidentsDirectoryFilters | null
): Promise<RecoveryIncidentsDirectory> {
  const incidents = filterRecoveryIncidents(await listMockRecoveryIncidents(), filters);
  const incidentIds = new Set(incidents.map((incident) => incident.id));
  const operatorActions = (await listMockRecoveryOperatorActions()).filter((action) =>
    incidentIds.has(action.targetId)
  );

  return {
    ...await directoryMeta(),
    incidents,
    summary: summarizeRecoveryIncidents(incidents),
    operatorActions,
  };
}

export const buildRecoveryIncidentsDirectory = buildMockRecoveryIncidentsDirectory;

export async function buildMockRecoveryIncidentDetailResponse(
  recoveryId: string
): Promise<RecoveryIncidentDetailResponse | null> {
  const recoveryIncident = await findMockRecoveryIncident(recoveryId);
  if (!recoveryIncident) {
    return null;
  }

  const directory = await buildMockRecoveryIncidentsDirectory();
  return {
    ...directory,
    recoveryIncident,
    operatorActions: await listRecoveryOperatorActionsForIncident(recoveryId),
  };
}

export async function findMockRecoveryIncident(recoveryId: string) {
  return (await listMockRecoveryIncidents()).find((incident) => incident.id === recoveryId) ?? null;
}

export async function listRecoveryOperatorActionsForIncident(recoveryId: string) {
  return (await listMockRecoveryOperatorActions()).filter((event) => event.targetId === recoveryId);
}

export const findRecoveryIncident = findMockRecoveryIncident;
export const buildRecoveryIncidentDetailResponse =
  buildMockRecoveryIncidentDetailResponse;

function isRecoveryActionAllowed(incident: RecoveryIncident, actionKind: RecoveryActionKind) {
  if (actionKind === "retry") {
    return incident.status === "retryable" || incident.status === "open";
  }

  if (actionKind === "failover") {
    return (
      incident.status === "retryable" ||
      incident.status === "failing_over" ||
      incident.status === "open"
    );
  }

  if (actionKind === "resolve") {
    return incident.status !== "recovered";
  }

  if (actionKind === "reopen") {
    return incident.status === "recovered" || incident.status === "dead";
  }

  return false;
}

export async function recordMockRecoveryAction(
  recoveryId: string,
  actionKind: RecoveryActionKind,
  context?: RecoveryActionContext
): Promise<RecoveryRecordActionResult | null> {
  const current = await findMockRecoveryIncident(recoveryId);
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
      const index = draft.recoveries.incidents.findIndex((incident) => incident.id === recoveryId);
      if (index < 0) {
        return;
      }

      const draftCurrent = draft.recoveries.incidents[index];
      if (!draftCurrent) {
        return;
      }

      const sequence = draft.recoveries.actionSequence++;

      if (actionKind === "failover" && !context?.targetAccountId) {
        operatorAction = buildRecoveryActionEvent(
          draftCurrent,
          actionKind,
          "rejected",
          occurredAt,
          sequence,
          "missing_target_account_id_for_failover",
          context
        );
        draft.recoveries.operatorActions = [...draft.recoveries.operatorActions, operatorAction];
        accepted = false;
        idempotent = false;
        rejectedReason = "Failover action requires targetAccountId.";
        return;
      }

      if (!isRecoveryActionAllowed(draftCurrent, actionKind)) {
        operatorAction = buildRecoveryActionEvent(
          draftCurrent,
          actionKind,
          "rejected",
          occurredAt,
          sequence,
          "invalid_recovery_transition",
          context
        );
        draft.recoveries.operatorActions = [...draft.recoveries.operatorActions, operatorAction];
        accepted = false;
        idempotent = false;
        rejectedReason = `Action ${actionKind} is not valid from status ${draftCurrent.status}.`;
        return;
      }

      const isIdempotent =
        draftCurrent.recoveryActionKind === actionKind &&
        ((actionKind === "retry" && draftCurrent.status === "open") ||
          (actionKind === "failover" && draftCurrent.status === "failing_over") ||
          (actionKind === "resolve" && draftCurrent.status === "recovered") ||
          (actionKind === "reopen" && draftCurrent.status === "open"));

      if (isIdempotent) {
        operatorAction = buildRecoveryActionEvent(
          draftCurrent,
          actionKind,
          "idempotent",
          occurredAt,
          sequence,
          undefined,
          context
        );
        draft.recoveries.operatorActions = [...draft.recoveries.operatorActions, operatorAction];
        idempotent = true;
        accepted = true;
        rejectedReason = null;
        return;
      }

      const nextStatus: RecoveryIncidentStatus =
        actionKind === "retry"
          ? "open"
          : actionKind === "failover"
            ? "failing_over"
            : actionKind === "resolve"
              ? "recovered"
              : "open";

      const updatedIncident: RecoveryIncident = {
        ...draftCurrent,
        status: nextStatus,
        recoveryActionKind: actionKind,
        retryCount:
          actionKind === "retry" ? draftCurrent.retryCount + 1 : draftCurrent.retryCount,
        accountId:
          actionKind === "failover" && context?.targetAccountId
            ? context.targetAccountId
            : draftCurrent.accountId ?? null,
        resolvedAt:
          actionKind === "resolve"
            ? occurredAt
            : actionKind === "reopen"
              ? null
              : draftCurrent.resolvedAt ?? null,
        lastObservedAt: occurredAt,
        updatedAt: occurredAt,
        revision: draftCurrent.revision + 1,
      };

      draft.recoveries.incidents = draft.recoveries.incidents.map((incident, incidentIndex) =>
        incidentIndex === index ? updatedIncident : incident
      );

      appendedEvent = appendRecoverySessionEvent(
        draft,
        draftCurrent,
        actionKind,
        occurredAt,
        draftCurrent.status,
        updatedIncident,
        context
      );
      operatorAction = buildRecoveryActionEvent(
        updatedIncident,
        actionKind,
        "applied",
        occurredAt,
        sequence,
        undefined,
        context
      );
      draft.recoveries.operatorActions = [...draft.recoveries.operatorActions, operatorAction];
      idempotent = false;
      accepted = true;
      rejectedReason = null;
    },
    {
      buildRelationalDelta(nextState) {
        const recoveryIncident =
          nextState.recoveries.incidents.find((incident) => incident.id === recoveryId) ?? null;
        const sessionId = recoveryIncident?.sessionId ?? current.sessionId;
        const session = materializeSessionProjections(nextState.sessions.events)[sessionId];

        return {
          sessions: appendedEvent && session ? [session] : [],
          events: appendedEvent ? [appendedEvent] : [],
          recoveries: recoveryIncident ? [recoveryIncident] : [],
          operatorActions: operatorAction ? [operatorAction] : [],
        };
      },
    }
  );

  const recoveryIncident =
    state.recoveries.incidents.find((incident) => incident.id === recoveryId) ?? current;
  const resolvedOperatorAction =
    operatorAction ?? state.recoveries.operatorActions[state.recoveries.operatorActions.length - 1] ?? null;

  if (!resolvedOperatorAction) {
    return null;
  }

  return {
    recoveryIncident: cloneIncident(recoveryIncident),
    operatorAction: cloneAction(resolvedOperatorAction),
    idempotent,
    accepted,
    rejectedReason,
    integrationState,
  };
}

export const recordRecoveryAction = recordMockRecoveryAction;
export const applyRecoveryAction = recordMockRecoveryAction;
