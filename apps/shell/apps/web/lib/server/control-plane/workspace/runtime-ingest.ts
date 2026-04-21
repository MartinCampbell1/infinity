import {
  buildNormalizedExecutionEventId,
  createExecutionSessionSummary,
  type ExecutionSessionPhase,
  type NormalizedExecutionEvent,
  type SessionProjectionState,
} from "../contracts/session-events";
import type { ApprovalRequest } from "../contracts/approvals";
import type { RecoveryIncident } from "../contracts/recoveries";
import type {
  WorkspaceRuntimeBridgeIngestRequest,
  WorkspaceRuntimeBridgeMessage,
  WorkspaceRuntimeSnapshot,
  SessionWorkspaceHostContext,
} from "../contracts/workspace-launch";
import { deriveAccountCapacityState } from "../accounts/capacity";
import { CONTROL_PLANE_ACCOUNT_META } from "../state/seeds";
import {
  appendNormalizedEventProducerBatch,
  materializeSessionProjections,
} from "../events/store";
import { updateControlPlaneState } from "../state/store";
import type { ControlPlaneState } from "../state/types";

export interface WorkspaceRuntimeBridgePersistResult {
  state: ControlPlaneState;
  event: NormalizedExecutionEvent;
  persistedEvents: NormalizedExecutionEvent[];
  approvalRequest: ApprovalRequest | null;
  touchedApprovals: ApprovalRequest[];
  recoveryIncident: RecoveryIncident | null;
  touchedRecoveries: RecoveryIncident[];
  runtimeSnapshot: WorkspaceRuntimeSnapshot;
}

const BRIDGE_EPOCH = "2026-04-11T00:00:00.000Z";
const APPROVAL_REQUEST_KIND = "workspace_action";
const DEFAULT_APPROVAL_TITLE = "Workspace approval requested";
const DEFAULT_RECOVERY_SUMMARY = "Workspace runtime incident";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || isString(value);
}

function isExecutionMode(
  value: unknown
): value is SessionWorkspaceHostContext["executionMode"] {
  return (
    value === undefined ||
    value === "local" ||
    value === "worktree" ||
    value === "cloud" ||
    value === "hermes" ||
    value === "unknown"
  );
}

function isOpenedFrom(
  value: unknown
): value is SessionWorkspaceHostContext["openedFrom"] {
  return (
    value === "dashboard" ||
    value === "execution_board" ||
    value === "review" ||
    value === "group_board" ||
    value === "deep_link" ||
    value === "unknown"
  );
}

function isQuotaPressure(
  value: unknown
): value is NonNullable<SessionWorkspaceHostContext["quotaState"]>["pressure"] {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "exhausted" ||
    value === "unknown"
  );
}

function isQuotaState(value: unknown) {
  if (value === undefined) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  return (
    isQuotaPressure(value.pressure) &&
    (value.usedPercent === undefined ||
      value.usedPercent === null ||
      typeof value.usedPercent === "number") &&
    isOptionalString(value.resetsAt)
  );
}

function humanizeAccountLabel(accountId: string | null | undefined) {
  if (!accountId) {
    return null;
  }

  return accountId.replace(/^account-/, "").replace(/-/g, " ");
}

function findLatestAccountSnapshot(accountId: string, state: ControlPlaneState) {
  const latestUpdate = [...state.accounts.updates]
    .filter((update) => update.accountId === accountId)
    .sort((left, right) => right.sequence - left.sequence)[0];

  if (latestUpdate?.snapshot) {
    return latestUpdate.snapshot;
  }

  const snapshots = state.accounts.snapshots.filter(
    (snapshot) => snapshot.accountId === accountId
  );
  return snapshots[snapshots.length - 1] ?? null;
}

function buildQuotaState(
  accountId: string | null | undefined,
  state: ControlPlaneState
): SessionWorkspaceHostContext["quotaState"] {
  if (!accountId) {
    return {
      pressure: "unknown",
      usedPercent: null,
      resetsAt: null,
    };
  }

  const snapshot = findLatestAccountSnapshot(accountId, state);
  if (!snapshot) {
    return {
      pressure: "unknown",
      usedPercent: null,
      resetsAt: null,
    };
  }

  const capacity = deriveAccountCapacityState(snapshot);
  const usedPercentValues = snapshot.buckets
    .map((bucket) => bucket.usedPercent)
    .filter((value): value is number => typeof value === "number");
  const resetValues = snapshot.buckets
    .map((bucket) => bucket.resetsAt)
    .filter((value): value is string => typeof value === "string")
    .sort((left, right) => left.localeCompare(right));

  return {
    pressure: capacity.pressure,
    usedPercent: usedPercentValues.length ? Math.max(...usedPercentValues) : null,
    resetsAt: resetValues[0] ?? null,
  };
}

function inferOpenedFrom(
  session: SessionProjectionState
): SessionWorkspaceHostContext["openedFrom"] {
  if (session.status === "waiting_for_approval" || session.phase === "review") {
    return "review";
  }

  if (session.groupId) {
    return "group_board";
  }

  if (session.id) {
    return "execution_board";
  }

  return "unknown";
}

function findLatestSessionEvent(
  sessionId: string,
  state: ControlPlaneState
): NormalizedExecutionEvent | null {
  const sessionEvents = state.sessions.events
    .filter((event) => event.sessionId === sessionId)
    .sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp.localeCompare(right.timestamp);
      }
      return left.id.localeCompare(right.id);
    });

  return sessionEvents[sessionEvents.length - 1] ?? null;
}

function buildWorkspaceHostContext(
  state: ControlPlaneState,
  session: SessionProjectionState
): SessionWorkspaceHostContext {
  const accountMeta =
    session.accountId ? CONTROL_PLANE_ACCOUNT_META[session.accountId] ?? null : null;

  return {
    projectId: session.projectId,
    projectName: session.projectName,
    sessionId: session.id,
    externalSessionId: session.externalSessionId ?? null,
    groupId: session.groupId ?? null,
    workspaceId: session.workspaceId ?? null,
    accountId: session.accountId ?? null,
    accountLabel: accountMeta?.label ?? humanizeAccountLabel(session.accountId) ?? null,
    model: session.model ?? null,
    executionMode:
      session.provider === "hermes"
        ? "hermes"
        : session.provider === "codex"
          ? "worktree"
          : session.provider === "openwebui"
            ? "cloud"
            : "unknown",
    quotaState: buildQuotaState(session.accountId, state),
    pendingApprovals: Math.max(
      session.pendingApprovals,
      state.approvals.requests.filter(
        (request) => request.sessionId === session.id && request.status === "pending"
      ).length
    ),
    openedFrom: inferOpenedFrom(session),
  };
}

export function buildWorkspaceRuntimeSnapshot(
  state: ControlPlaneState,
  context: SessionWorkspaceHostContext
): WorkspaceRuntimeSnapshot {
  const sessionMap = materializeSessionProjections(state.sessions.events);
  const session = sessionMap[context.sessionId];

  if (session) {
    return {
      session,
      hostContext: buildWorkspaceHostContext(state, session),
      latestEvent: findLatestSessionEvent(session.id, state),
    };
  }

  const fallbackEvent = findLatestSessionEvent(context.sessionId, state);

  return {
    session: createExecutionSessionSummary({
      id: context.sessionId,
      projectId: context.projectId,
      projectName: context.projectName,
      title: context.projectName || context.sessionId,
      createdAt: fallbackEvent?.timestamp ?? BRIDGE_EPOCH,
      updatedAt: fallbackEvent?.timestamp ?? BRIDGE_EPOCH,
      provider: "unknown",
      status: "unknown",
      phase: "unknown",
    }),
    hostContext: {
      ...context,
      accountLabel: context.accountLabel ?? humanizeAccountLabel(context.accountId),
      quotaState: context.quotaState ?? {
        pressure: "unknown",
        usedPercent: null,
        resetsAt: null,
      },
    },
    latestEvent: fallbackEvent,
  };
}

function isSessionWorkspaceHostContext(
  value: unknown
): value is SessionWorkspaceHostContext {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.projectId) &&
    isNonEmptyString(value.projectName) &&
    isNonEmptyString(value.sessionId) &&
    isOpenedFrom(value.openedFrom) &&
    isOptionalString(value.externalSessionId) &&
    isOptionalString(value.groupId) &&
    isOptionalString(value.workspaceId) &&
    isOptionalString(value.accountId) &&
    isOptionalString(value.accountLabel) &&
    isOptionalString(value.model) &&
    isExecutionMode(value.executionMode) &&
    isQuotaState(value.quotaState) &&
    (value.pendingApprovals === undefined ||
      value.pendingApprovals === null ||
      typeof value.pendingApprovals === "number")
  );
}

function isWorkspaceRuntimeBridgeMessage(
  value: unknown
): value is WorkspaceRuntimeBridgeMessage {
  if (!isRecord(value) || !isNonEmptyString(value.type)) {
    return false;
  }

  if (value.type === "workspace.ready") {
    return true;
  }

  if (value.type === "workspace.session.updated") {
    if (!isRecord(value.payload)) {
      return false;
    }
    return (
      (value.payload.title === undefined || isString(value.payload.title)) &&
      (value.payload.status === undefined || isString(value.payload.status)) &&
      (isNonEmptyString(value.payload.title) || isNonEmptyString(value.payload.status))
    );
  }

  if (value.type === "workspace.tool.started") {
    return (
      isRecord(value.payload) &&
      isNonEmptyString(value.payload.toolName) &&
      isNonEmptyString(value.payload.eventId)
    );
  }

  if (value.type === "workspace.tool.completed") {
    return (
      isRecord(value.payload) &&
      isNonEmptyString(value.payload.toolName) &&
      isNonEmptyString(value.payload.eventId) &&
      (value.payload.status === "completed" || value.payload.status === "failed")
    );
  }

  if (value.type === "workspace.approval.requested") {
    return (
      isRecord(value.payload) &&
      isNonEmptyString(value.payload.approvalId) &&
      isNonEmptyString(value.payload.summary) &&
      (value.payload.reason === undefined || isString(value.payload.reason))
    );
  }

  if (value.type === "workspace.file.opened") {
    return isRecord(value.payload) && isNonEmptyString(value.payload.path);
  }

  if (value.type === "workspace.error") {
    return (
      isRecord(value.payload) &&
      isNonEmptyString(value.payload.message) &&
      (value.payload.code === undefined || isString(value.payload.code))
    );
  }

  if (value.type === "workspace.deepLink") {
    return (
      isRecord(value.payload) &&
      isNonEmptyString(value.payload.sessionId) &&
      (value.payload.filePath === undefined || isString(value.payload.filePath)) &&
      (value.payload.anchor === undefined || isString(value.payload.anchor))
    );
  }

  if (value.type === "founderos.account.switch") {
    return isRecord(value.payload) && isNonEmptyString(value.payload.accountId);
  }

  if (value.type === "founderos.session.retry") {
    return (
      isRecord(value.payload) &&
      (value.payload.retryMode === "same_account" ||
        value.payload.retryMode === "fallback_account")
    );
  }

  return false;
}

function isWorkspaceRuntimeBridgeProducerBatch(
  value: unknown
): value is Extract<WorkspaceRuntimeBridgeIngestRequest, { messages: readonly WorkspaceRuntimeBridgeMessage[] }> {
  if (!isRecord(value) || !isSessionWorkspaceHostContext(value.hostContext)) {
    return false;
  }

  if (value.producer !== "workspace_runtime_bridge") {
    return false;
  }

  if (!Array.isArray(value.messages) || value.messages.length === 0) {
    return false;
  }

  return value.messages.every((message) => isWorkspaceRuntimeBridgeMessage(message));
}

export function isWorkspaceRuntimeBridgeIngestRequest(
  value: unknown
): value is WorkspaceRuntimeBridgeIngestRequest {
  return (
    isRecord(value) &&
    ((isSessionWorkspaceHostContext(value.hostContext) &&
      isWorkspaceRuntimeBridgeMessage(value.message)) ||
      isWorkspaceRuntimeBridgeProducerBatch(value))
  );
}

function resolveNextEventTimestamp(state: ControlPlaneState, sessionId: string) {
  const sessionEvents = [...state.sessions.events]
    .filter((event) => event.sessionId === sessionId)
    .sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp.localeCompare(right.timestamp);
      }
      return left.id.localeCompare(right.id);
    });
  const latest = sessionEvents[sessionEvents.length - 1] ?? null;

  if (!latest) {
    return BRIDGE_EPOCH;
  }

  const latestTime = Date.parse(latest.timestamp);
  if (Number.isNaN(latestTime)) {
    return BRIDGE_EPOCH;
  }

  return new Date(latestTime + 1).toISOString();
}

function resolveEventOrdinal() {
  return 0;
}

function resolveEventProvider(
  state: ControlPlaneState,
  context: SessionWorkspaceHostContext
): NormalizedExecutionEvent["provider"] {
  const session = materializeSessionProjections(state.sessions.events)[context.sessionId];
  if (session?.provider) {
    return session.provider;
  }

  if (context.executionMode === "hermes") {
    return "hermes";
  }

  if (context.executionMode === "worktree" || context.executionMode === "local") {
    return "codex";
  }

  if (context.executionMode === "cloud") {
    return "openwebui";
  }

  return "unknown";
}

function normalizeExecutionSessionPhase(
  value: string | null | undefined
): ExecutionSessionPhase | null {
  return value === "planning" ||
    value === "acting" ||
    value === "validating" ||
    value === "blocked" ||
    value === "review" ||
    value === "completed" ||
    value === "unknown"
    ? value
    : null;
}

function resolveEventPhase(
  message: WorkspaceRuntimeBridgeMessage,
  currentPhase?: NormalizedExecutionEvent["phase"]
): NormalizedExecutionEvent["phase"] {
  if (message.type === "workspace.approval.requested") {
    return "blocked";
  }

  if (message.type === "workspace.error") {
    return "blocked";
  }

  if (message.type === "founderos.session.retry") {
    return "blocked";
  }

  if (message.type === "workspace.tool.started" || message.type === "workspace.tool.completed") {
    return "acting";
  }

  return currentPhase ?? "unknown";
}

function resolveEventStatus(
  message: WorkspaceRuntimeBridgeMessage
): NormalizedExecutionEvent["status"] {
  if (message.type === "workspace.approval.requested") {
    return "in_progress";
  }

  if (message.type === "workspace.error") {
    return "failed";
  }

  if (message.type === "founderos.session.retry") {
    return "in_progress";
  }

  if (message.type === "workspace.tool.started") {
    return "in_progress";
  }

  if (message.type === "workspace.tool.completed") {
    return message.payload.status;
  }

  return "completed";
}

function buildEventSummary(message: WorkspaceRuntimeBridgeMessage): string {
  switch (message.type) {
    case "workspace.ready":
      return "Workspace ready";
    case "workspace.session.updated":
      return message.payload.title?.trim() || "Workspace session updated";
    case "workspace.tool.started":
      return `Tool started: ${message.payload.toolName}`;
    case "workspace.tool.completed":
      return `Tool ${message.payload.status}: ${message.payload.toolName}`;
    case "workspace.approval.requested":
      return message.payload.summary?.trim() || DEFAULT_APPROVAL_TITLE;
    case "workspace.file.opened":
      return `File opened: ${message.payload.path}`;
    case "workspace.error":
      return message.payload.code
        ? `Workspace error: ${message.payload.code}`
        : message.payload.message || DEFAULT_RECOVERY_SUMMARY;
    case "workspace.deepLink":
      return `Deep link opened for ${message.payload.sessionId}`;
    case "founderos.account.switch":
      return `Account switched to ${message.payload.accountId}`;
    case "founderos.session.retry":
      return message.payload.retryMode === "fallback_account"
        ? "Session retry requested with fallback account"
        : "Session retry requested on same account";
  }
}

function buildEventPayload(
  context: SessionWorkspaceHostContext,
  message: WorkspaceRuntimeBridgeMessage
) {
  const base = {
    projectId: context.projectId,
    projectName: context.projectName,
    sessionId: context.sessionId,
    externalSessionId: context.externalSessionId ?? null,
    groupId: context.groupId ?? null,
    workspaceId: context.workspaceId ?? null,
    accountId: context.accountId ?? null,
    openedFrom: context.openedFrom,
  };

  switch (message.type) {
    case "workspace.ready":
      return { ...base };
    case "workspace.session.updated":
      return {
        ...base,
        title: message.payload.title ?? null,
        status: message.payload.status ?? null,
      };
    case "workspace.tool.started":
      return { ...base, toolName: message.payload.toolName, eventId: message.payload.eventId };
    case "workspace.tool.completed":
      return {
        ...base,
        toolName: message.payload.toolName,
        eventId: message.payload.eventId,
        status: message.payload.status,
      };
    case "workspace.approval.requested":
      return {
        ...base,
        approvalId: message.payload.approvalId,
        summary: message.payload.summary,
      };
    case "workspace.file.opened":
      return { ...base, path: message.payload.path };
    case "workspace.error":
      return {
        ...base,
        code: message.payload.code ?? null,
        message: message.payload.message,
      };
    case "workspace.deepLink":
      return {
        ...base,
        deepLinkSessionId: message.payload.sessionId,
        filePath: message.payload.filePath ?? null,
        anchor: message.payload.anchor ?? null,
      };
    case "founderos.account.switch":
      return { ...base, accountId: message.payload.accountId };
    case "founderos.session.retry":
      return { ...base, retryMode: message.payload.retryMode };
  }
}

function buildRuntimeEvent(
  state: ControlPlaneState,
  context: SessionWorkspaceHostContext,
  message: WorkspaceRuntimeBridgeMessage
): NormalizedExecutionEvent {
  const timestamp = resolveNextEventTimestamp(state, context.sessionId);
  const provider = resolveEventProvider(state, context);
  const currentSession = materializeSessionProjections(state.sessions.events)[context.sessionId];
  const currentPhase = normalizeExecutionSessionPhase(currentSession?.phase);
  const kind = normalizeRuntimeEventKind(message);
  const source = message.type.startsWith("workspace.") ? "openwebui" : "manual";

  return {
    id: buildNormalizedExecutionEventId({
      sessionId: context.sessionId,
      source,
      kind,
      timestamp,
      ordinal: resolveEventOrdinal(),
    }),
    sessionId: context.sessionId,
    projectId: context.projectId,
    groupId: context.groupId ?? null,
    source,
    provider,
    kind,
    status: resolveEventStatus(message),
    phase: resolveEventPhase(message, currentPhase),
    timestamp,
    summary: buildEventSummary(message),
    payload: buildEventPayload(context, message),
    raw: {
      context: clone(context),
      message: clone(message),
    },
  };
}

function normalizeRuntimeEventKind(
  message: WorkspaceRuntimeBridgeMessage
): NormalizedExecutionEvent["kind"] {
  switch (message.type) {
    case "workspace.ready":
      return "session.updated";
    case "workspace.session.updated":
      return "session.updated";
    case "workspace.tool.started":
      return "tool.started";
    case "workspace.tool.completed":
      return "tool.completed";
    case "workspace.approval.requested":
      return "approval.requested";
    case "workspace.file.opened":
      return "file.changed";
    case "workspace.error":
      return "error.raised";
    case "workspace.deepLink":
      return "session.updated";
    case "founderos.account.switch":
      return "account.switched";
    case "founderos.session.retry":
      return "recovery.started";
  }
}

function addMinutes(isoTimestamp: string, minutes: number) {
  const timestamp = Date.parse(isoTimestamp);
  if (Number.isNaN(timestamp)) {
    return BRIDGE_EPOCH;
  }

  return new Date(timestamp + minutes * 60_000).toISOString();
}

function findApprovalRequest(
  requests: readonly ApprovalRequest[],
  approvalId: string
) {
  return requests.find((request) => request.id === approvalId) ?? null;
}

function upsertApprovalRequest(
  state: ControlPlaneState,
  context: SessionWorkspaceHostContext,
  message: Extract<WorkspaceRuntimeBridgeMessage, { type: "workspace.approval.requested" }>,
  timestamp: string
) {
  const existing = findApprovalRequest(state.approvals.requests, message.payload.approvalId);
  const nextRequest: ApprovalRequest = {
    id: message.payload.approvalId,
    sessionId: context.sessionId,
    externalSessionId: context.externalSessionId ?? null,
    projectId: context.projectId,
    projectName: context.projectName,
    groupId: context.groupId ?? null,
    accountId: context.accountId ?? null,
    workspaceId: context.workspaceId ?? null,
    requestKind: existing?.requestKind ?? APPROVAL_REQUEST_KIND,
    title: existing?.title?.trim() ? existing.title : DEFAULT_APPROVAL_TITLE,
    summary: message.payload.summary.trim() || existing?.summary || DEFAULT_APPROVAL_TITLE,
    reason:
      ("reason" in message.payload && typeof message.payload.reason === "string"
        ? message.payload.reason
        : null) ??
      existing?.reason ??
      null,
    status: "pending",
    decision: null,
    requestedAt: existing?.requestedAt ?? timestamp,
    updatedAt: timestamp,
    resolvedAt: null,
    resolvedBy: null,
    expiresAt: addMinutes(timestamp, 60),
    revision: existing ? existing.revision + 1 : 1,
    raw: {
      context: clone(context),
      message: clone(message),
      source: "workspace_runtime_bridge",
    },
  };

  const index = state.approvals.requests.findIndex(
    (request) => request.id === message.payload.approvalId
  );
  if (index >= 0) {
    state.approvals.requests[index] = nextRequest;
  } else {
    state.approvals.requests = [...state.approvals.requests, nextRequest];
  }

  return nextRequest;
}

function deriveRecoveryStatus(
  existing: RecoveryIncident | null,
  retryMode?: "same_account" | "fallback_account"
) {
  if (retryMode === "fallback_account") {
    return "failing_over" as const;
  }

  if (existing?.status === "failing_over") {
    return "failing_over" as const;
  }

  return "retryable" as const;
}

function deriveRecoveryActionKind(
  existing: RecoveryIncident | null,
  retryMode?: "same_account" | "fallback_account"
) {
  if (retryMode === "fallback_account") {
    return "failover" as const;
  }

  if (existing?.recoveryActionKind === "failover" && existing.status === "failing_over") {
    return "failover" as const;
  }

  return "retry" as const;
}

function deriveRecoverySeverity(
  existing: RecoveryIncident | null,
  message: WorkspaceRuntimeBridgeMessage
) {
  if (existing?.severity && existing.severity !== "unknown") {
    return existing.severity;
  }

  if (message.type === "workspace.error" && message.payload.code) {
    return "high" as const;
  }

  if (message.type === "founderos.session.retry" && message.payload.retryMode === "fallback_account") {
    return "high" as const;
  }

  return "medium" as const;
}

function upsertRecoveryIncident(
  state: ControlPlaneState,
  context: SessionWorkspaceHostContext,
  message:
    | Extract<WorkspaceRuntimeBridgeMessage, { type: "workspace.error" }>
    | Extract<WorkspaceRuntimeBridgeMessage, { type: "founderos.session.retry" }>,
  timestamp: string
) {
  const existingIndex = state.recoveries.incidents.findIndex(
    (incident) => incident.sessionId === context.sessionId
  );
  const existing = existingIndex >= 0 ? state.recoveries.incidents[existingIndex] ?? null : null;

  const retryMode = message.type === "founderos.session.retry" ? message.payload.retryMode : null;
  const status = deriveRecoveryStatus(existing, retryMode ?? undefined);
  const recoveryActionKind = deriveRecoveryActionKind(existing, retryMode ?? undefined);
  const summary =
    message.type === "workspace.error"
      ? message.payload.code
        ? `Workspace error: ${message.payload.code}`
        : message.payload.message || DEFAULT_RECOVERY_SUMMARY
      : retryMode === "fallback_account"
        ? "Session retry requested with fallback account"
        : "Session retry requested on same account";

  const nextIncident: RecoveryIncident = {
    id: existing?.id ?? `runtime-recovery-${context.sessionId}`,
    sessionId: context.sessionId,
    externalSessionId: context.externalSessionId ?? null,
    projectId: context.projectId,
    projectName: context.projectName,
    groupId: context.groupId ?? null,
    accountId: context.accountId ?? null,
    workspaceId: context.workspaceId ?? null,
    status,
    severity: deriveRecoverySeverity(existing, message),
    recoveryActionKind,
    summary,
    rootCause:
      message.type === "workspace.error"
        ? message.payload.code ?? existing?.rootCause ?? null
        : existing?.rootCause ?? null,
    recommendedAction:
      status === "failing_over"
        ? "Fail over to a fallback account and retry."
        : "Retry the session on the current account.",
    retryCount: existing?.retryCount ?? 0,
    openedAt: existing?.openedAt ?? timestamp,
    lastObservedAt: timestamp,
    updatedAt: timestamp,
    resolvedAt: null,
    revision: existing ? existing.revision + 1 : 1,
    raw: {
      context: clone(context),
      message: clone(message),
      source: "workspace_runtime_bridge",
    },
  };

  if (message.type === "founderos.session.retry") {
    nextIncident.retryCount = (existing?.retryCount ?? 0) + 1;
  }

  if (existingIndex >= 0) {
    state.recoveries.incidents[existingIndex] = nextIncident;
  } else {
    state.recoveries.incidents = [...state.recoveries.incidents, nextIncident];
  }

  return nextIncident;
}

function assertSupportedMessage(message: WorkspaceRuntimeBridgeMessage) {
  if (
    message.type === "workspace.ready" ||
    message.type === "workspace.session.updated" ||
    message.type === "workspace.tool.started" ||
    message.type === "workspace.tool.completed" ||
    message.type === "workspace.approval.requested" ||
    message.type === "workspace.file.opened" ||
    message.type === "workspace.error" ||
    message.type === "workspace.deepLink" ||
    message.type === "founderos.account.switch" ||
    message.type === "founderos.session.retry"
  ) {
    return;
  }

  throw new Error("Unsupported workspace runtime bridge message.");
}

function getRuntimeBridgeMessages(
  input: WorkspaceRuntimeBridgeIngestRequest
): readonly WorkspaceRuntimeBridgeMessage[] {
  return "messages" in input ? input.messages : [input.message];
}

export async function persistWorkspaceRuntimeBridgeMessage(
  input: WorkspaceRuntimeBridgeIngestRequest
): Promise<WorkspaceRuntimeBridgePersistResult> {
  const messages = getRuntimeBridgeMessages(input);
  for (const message of messages) {
    assertSupportedMessage(message);
  }

  let persistedEvents: NormalizedExecutionEvent[] = [];
  let approvalRequests: ApprovalRequest[] = [];
  let recoveryIncidents: RecoveryIncident[] = [];

  const { state } = await updateControlPlaneState(
    (draft) => {
      const nextEvents: NormalizedExecutionEvent[] = [];

      for (const message of messages) {
        const event = buildRuntimeEvent(draft, input.hostContext, message);
        nextEvents.push(event);

        if (message.type === "workspace.approval.requested") {
          const approvalRequest = upsertApprovalRequest(
            draft,
            input.hostContext,
            message,
            event.timestamp
          );
          approvalRequests = [...approvalRequests, approvalRequest];
        }

        if (message.type === "workspace.error" || message.type === "founderos.session.retry") {
          const recoveryIncident = upsertRecoveryIncident(
            draft,
            input.hostContext,
            message,
            event.timestamp
          );
          recoveryIncidents = [...recoveryIncidents, recoveryIncident];
        }

        draft.sessions.events = appendNormalizedEventProducerBatch(draft.sessions, {
          producer: "workspace_runtime_bridge",
          sessionId: input.hostContext.sessionId,
          projectId: input.hostContext.projectId,
          groupId: input.hostContext.groupId ?? null,
          producedAt: event.timestamp,
          events: [event],
        }).events;
      }

      persistedEvents = nextEvents;
    },
    {
      buildRelationalDelta(state) {
        const sessionMap = materializeSessionProjections(state.sessions.events);
        const currentSession = sessionMap[input.hostContext.sessionId];

        return {
          sessions: currentSession ? [currentSession] : [],
          events: persistedEvents,
          approvals: approvalRequests,
          recoveries: recoveryIncidents,
        };
      },
    }
  );

  if (persistedEvents.length === 0) {
    throw new Error("Workspace runtime bridge message was not persisted.");
  }

  const runtimeSnapshot = buildWorkspaceRuntimeSnapshot(state, input.hostContext);
  const event = persistedEvents[persistedEvents.length - 1]!;

  return {
    state,
    event,
    persistedEvents,
    approvalRequest: approvalRequests[0] ?? null,
    touchedApprovals: approvalRequests,
    recoveryIncident: recoveryIncidents[0] ?? null,
    touchedRecoveries: recoveryIncidents,
    runtimeSnapshot,
  };
}
