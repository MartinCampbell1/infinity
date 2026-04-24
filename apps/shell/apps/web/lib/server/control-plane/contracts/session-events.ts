import type { TenantScopedRecordFields } from "./tenancy";

export type ExecutionProvider =
  | "codex"
  | "hermes"
  | "openwebui"
  | "mixed"
  | "unknown";

export type ExecutionSessionStatus =
  | "queued"
  | "starting"
  | "planning"
  | "acting"
  | "validating"
  | "waiting_for_approval"
  | "blocked"
  | "failed"
  | "recovered"
  | "completed"
  | "cancelled"
  | "unknown";

export type ExecutionSessionPhase =
  | "planning"
  | "acting"
  | "validating"
  | "blocked"
  | "review"
  | "completed"
  | "unknown";

export type NormalizedExecutionEventSource =
  | "codex_jsonl"
  | "codex_app_server"
  | "hermes_sse"
  | "openwebui"
  | "manual";

export type NormalizedExecutionEventKind =
  | "session.started"
  | "session.updated"
  | "turn.started"
  | "turn.completed"
  | "turn.failed"
  | "agent.message.delta"
  | "agent.message.completed"
  | "tool.started"
  | "tool.completed"
  | "command.started"
  | "command.completed"
  | "approval.requested"
  | "approval.resolved"
  | "file.changed"
  | "phase.changed"
  | "quota.updated"
  | "account.switched"
  | "recovery.started"
  | "recovery.completed"
  | "error.raised";

export interface ExecutionSessionSummary extends TenantScopedRecordFields {
  id: string;
  externalSessionId?: string | null;
  projectId: string;
  projectName: string;
  groupId?: string | null;
  workspaceId?: string | null;
  accountId?: string | null;
  provider: ExecutionProvider;
  model?: string | null;
  title: string;
  status: ExecutionSessionStatus;
  phase?: string | null;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  lastToolAt?: string | null;
  lastErrorAt?: string | null;
  pendingApprovals: number;
  toolActivityCount: number;
  retryCount: number;
  recoveryState: "none" | "retryable" | "failing_over" | "recovered" | "dead";
  quotaPressure: "low" | "medium" | "high" | "exhausted" | "unknown";
  unreadOperatorSignals: number;
}

export interface NormalizedExecutionEvent extends TenantScopedRecordFields {
  id: string;
  sessionId: string;
  projectId: string;
  groupId?: string | null;
  source: NormalizedExecutionEventSource;
  provider: ExecutionProvider;
  kind: NormalizedExecutionEventKind;
  status?: "in_progress" | "completed" | "failed" | "declined" | "unknown";
  phase?: ExecutionSessionPhase | null;
  timestamp: string;
  summary: string;
  payload: Record<string, unknown>;
  raw?: Record<string, unknown> | null;
}

export interface NormalizedExecutionEventProducerBatch {
  producer: string;
  sessionId: string;
  projectId: string;
  groupId?: string | null;
  producedAt: string;
  events: readonly NormalizedExecutionEvent[];
}

export interface SessionProjectionState extends ExecutionSessionSummary {
  appliedEventIds: string[];
}

export interface GroupProjectionState {
  id: string;
  sessionIds: string[];
  totalSessions: number;
  activeSessions: number;
  completedSessions: number;
  failedSessions: number;
  retryableSessions: number;
  pendingApprovals: number;
  unreadOperatorSignals: number;
  updatedAt: string;
}

export function buildNormalizedExecutionEventId(
  event: Pick<NormalizedExecutionEvent, "sessionId" | "kind" | "timestamp"> & {
    source?: NormalizedExecutionEventSource;
    ordinal?: number;
  }
) {
  const source = event.source ?? "manual";
  const ordinal = Number.isFinite(event.ordinal) ? String(event.ordinal) : "na";
  return `${event.sessionId}:${source}:${event.kind}:${event.timestamp}:${ordinal}`;
}

export function resolveNormalizedExecutionTimestamp(
  timestamp?: string | null,
  fallback = "1970-01-01T00:00:00.000Z"
) {
  return (timestamp || "").trim() || fallback;
}

export function createExecutionSessionSummary(
  input: Pick<
    ExecutionSessionSummary,
    "id" | "projectId" | "projectName" | "title" | "createdAt" | "updatedAt"
  > &
    Partial<ExecutionSessionSummary>
): ExecutionSessionSummary {
  return {
    externalSessionId: null,
    groupId: null,
    workspaceId: null,
    accountId: null,
    provider: "unknown",
    model: null,
    status: "unknown",
    phase: "unknown",
    tags: [],
    pinned: false,
    archived: false,
    lastMessageAt: null,
    lastToolAt: null,
    lastErrorAt: null,
    pendingApprovals: 0,
    toolActivityCount: 0,
    retryCount: 0,
    recoveryState: "none",
    quotaPressure: "unknown",
    unreadOperatorSignals: 0,
    ...input,
  };
}

export function reduceSessionProjection(
  previous: SessionProjectionState | null,
  event: NormalizedExecutionEvent
): SessionProjectionState {
  const baseline =
    previous ??
    ({
      ...createExecutionSessionSummary({
        id: event.sessionId,
        projectId: event.projectId,
        projectName:
          typeof event.payload.projectName === "string"
            ? event.payload.projectName
            : event.projectId,
        title:
          typeof event.payload.title === "string"
            ? event.payload.title
            : event.summary,
        tenantId: event.tenantId,
        createdBy: event.createdBy ?? null,
        updatedBy: event.updatedBy ?? null,
        createdAt: event.timestamp,
        updatedAt: event.timestamp,
        provider: event.provider,
        phase: event.phase ?? "unknown",
      }),
      appliedEventIds: [],
    } satisfies SessionProjectionState);

  if (baseline.appliedEventIds.includes(event.id)) {
    return baseline;
  }

  const next: SessionProjectionState = {
    ...baseline,
    tenantId: event.tenantId ?? baseline.tenantId,
    createdBy: baseline.createdBy ?? event.createdBy ?? null,
    updatedBy: event.updatedBy ?? baseline.updatedBy ?? null,
    provider: event.provider || baseline.provider,
    updatedAt: event.timestamp,
    phase: event.phase ?? baseline.phase,
    appliedEventIds: [...baseline.appliedEventIds, event.id],
  };

  if (typeof event.groupId === "string" && event.groupId.trim()) {
    next.groupId = event.groupId;
  }

  if (
    typeof event.payload.workspaceId === "string" &&
    event.payload.workspaceId.trim()
  ) {
    next.workspaceId = event.payload.workspaceId;
  }

  if (typeof event.payload.accountId === "string" && event.payload.accountId.trim()) {
    next.accountId = event.payload.accountId;
  }

  if (Array.isArray(event.payload.tags)) {
    next.tags = Array.from(
      new Set(
        event.payload.tags.filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        )
      )
    );
  }

  if (typeof event.payload.pinned === "boolean") {
    next.pinned = event.payload.pinned;
  }

  if (typeof event.payload.archived === "boolean") {
    next.archived = event.payload.archived;
  }

  if (event.kind === "agent.message.completed") {
    next.lastMessageAt = event.timestamp;
  }

  if (event.kind === "session.started" || event.kind === "session.updated") {
    if (typeof event.payload.title === "string" && event.payload.title.trim()) {
      next.title = event.payload.title;
    }
    if (
      typeof event.payload.projectName === "string" &&
      event.payload.projectName.trim()
    ) {
      next.projectName = event.payload.projectName;
    }
    if (typeof event.payload.model === "string" && event.payload.model.trim()) {
      next.model = event.payload.model;
    }
    if (
      typeof event.payload.externalSessionId === "string" &&
      event.payload.externalSessionId.trim()
    ) {
      next.externalSessionId = event.payload.externalSessionId;
    }
    if (typeof event.payload.thread_id === "string" && event.payload.thread_id.trim()) {
      next.externalSessionId = event.payload.thread_id;
    }
  }

  if (event.kind === "tool.started" || event.kind === "tool.completed") {
    next.lastToolAt = event.timestamp;
    next.toolActivityCount += event.kind === "tool.started" ? 1 : 0;
  }

  if (event.kind === "approval.requested") {
    next.pendingApprovals += 1;
    next.status = "waiting_for_approval";
    next.unreadOperatorSignals += 1;
  }

  if (event.kind === "approval.resolved") {
    if (next.pendingApprovals > 0) {
      next.pendingApprovals -= 1;
    }
    next.unreadOperatorSignals += 1;

    const denied =
      event.status === "declined" ||
      event.payload.decision === "deny" ||
      event.payload.approvalStatus === "denied";
    if (next.pendingApprovals === 0 && next.status === "waiting_for_approval") {
      next.status = denied ? "blocked" : "acting";
      next.phase = denied ? "blocked" : "acting";
    }
  }

  if (event.kind === "recovery.started") {
    const recoveryActionKind = event.payload.recoveryActionKind;
    const recoveryStatus = event.payload.recoveryStatus;
    const retryMode = event.payload.retryMode;

    if (
      recoveryActionKind === "failover" ||
      recoveryStatus === "failing_over" ||
      retryMode === "fallback_account"
    ) {
      next.recoveryState = "failing_over";
    } else {
      next.recoveryState = "retryable";
    }
    next.retryCount += 1;
    next.unreadOperatorSignals += 1;
  }

  if (event.kind === "recovery.completed") {
    const recoveryStatus = event.payload.recoveryStatus;
    if (recoveryStatus === "dead") {
      next.recoveryState = "dead";
      next.status = "failed";
    } else {
      next.recoveryState = "recovered";
      next.status = "recovered";
    }
    next.unreadOperatorSignals += 1;
  }

  if (event.kind === "error.raised") {
    next.lastErrorAt = event.timestamp;
    next.status = "failed";
    next.recoveryState = "retryable";
    next.unreadOperatorSignals += 1;
  }

  if (event.kind === "session.started") {
    next.status = "starting";
  }

  if (event.kind === "turn.started") {
    next.status = "acting";
  }

  if (event.kind === "turn.completed") {
    next.status = "completed";
  }

  if (event.kind === "turn.failed") {
    next.status = "failed";
  }

  if (event.kind === "phase.changed" && event.phase) {
    next.phase = event.phase;
    if (event.phase === "planning") {
      next.status = "planning";
    } else if (event.phase === "acting") {
      next.status = "acting";
    } else if (event.phase === "validating") {
      next.status = "validating";
    } else if (event.phase === "blocked") {
      next.status = "blocked";
    } else if (event.phase === "completed") {
      next.status = "completed";
    }
  }

  if (event.kind === "quota.updated") {
    const pressure = event.payload.pressure;
    if (
      pressure === "low" ||
      pressure === "medium" ||
      pressure === "high" ||
      pressure === "exhausted" ||
      pressure === "unknown"
    ) {
      next.quotaPressure = pressure;
    }
  }

  if (event.kind === "account.switched") {
    const accountId = event.payload.accountId;
    if (typeof accountId === "string" && accountId.trim()) {
      next.accountId = accountId;
    }
  }

  return next;
}

export function validateNormalizedExecutionEvents(
  events: readonly NormalizedExecutionEvent[]
): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  let previous: NormalizedExecutionEvent | null = null;

  for (const event of events) {
    if (typeof event.id !== "string" || !event.id.trim()) {
      errors.push("event.id must be a non-empty string");
    } else if (seenIds.has(event.id)) {
      errors.push(`duplicate event.id ${event.id}`);
    } else {
      seenIds.add(event.id);
    }

    if (typeof event.sessionId !== "string" || !event.sessionId.trim()) {
      errors.push(`event ${event.id || "<unknown>"} has an empty sessionId`);
    }

    if (typeof event.projectId !== "string" || !event.projectId.trim()) {
      errors.push(`event ${event.id || "<unknown>"} has an empty projectId`);
    }

    if (typeof event.timestamp !== "string" || !event.timestamp.trim()) {
      errors.push(`event ${event.id || "<unknown>"} has an empty timestamp`);
    }

    if (typeof event.summary !== "string" || !event.summary.trim()) {
      errors.push(`event ${event.id || "<unknown>"} has an empty summary`);
    }

    const expectedPrefix = `${event.sessionId}:${event.source}:${event.kind}:`;
    if (typeof event.id === "string" && event.id && !event.id.startsWith(expectedPrefix)) {
      errors.push(`event.id ${event.id} does not match expected prefix ${expectedPrefix}`);
    }

    if (previous) {
      const order = compareNormalizedEventOrder(previous, event);
      if (order > 0) {
        errors.push(
          `events out of order: ${previous.id} (${previous.timestamp}) should not come before ${event.id} (${event.timestamp})`
        );
      }
    }

    previous = event;
  }

  return errors;
}

export function validateSessionProjectionState(
  projection: SessionProjectionState
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();

  if (typeof projection.id !== "string" || !projection.id.trim()) {
    errors.push("session projection id must be a non-empty string");
  }

  if (typeof projection.projectId !== "string" || !projection.projectId.trim()) {
    errors.push(`session ${projection.id} has an empty projectId`);
  }

  if (typeof projection.projectName !== "string" || !projection.projectName.trim()) {
    errors.push(`session ${projection.id} has an empty projectName`);
  }

  if (typeof projection.title !== "string" || !projection.title.trim()) {
    errors.push(`session ${projection.id} has an empty title`);
  }

  if (typeof projection.status !== "string" || !projection.status) {
    errors.push(`session ${projection.id} has an invalid status`);
  }

  if (typeof projection.phase !== "string" || !projection.phase) {
    errors.push(`session ${projection.id} has an invalid phase`);
  }

  for (const eventId of projection.appliedEventIds) {
    if (typeof eventId !== "string" || !eventId.trim()) {
      errors.push(`session ${projection.id} contains an empty appliedEventId`);
      continue;
    }
    if (seen.has(eventId)) {
      errors.push(`session ${projection.id} contains duplicate appliedEventId ${eventId}`);
      continue;
    }
    seen.add(eventId);
  }

  return errors;
}

export function validateGroupProjectionState(
  projection: GroupProjectionState
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const numericKeys: Array<
    | "totalSessions"
    | "activeSessions"
    | "completedSessions"
    | "failedSessions"
    | "retryableSessions"
    | "pendingApprovals"
    | "unreadOperatorSignals"
  > = [
    "totalSessions",
    "activeSessions",
    "completedSessions",
    "failedSessions",
    "retryableSessions",
    "pendingApprovals",
    "unreadOperatorSignals",
  ];

  if (typeof projection.id !== "string" || !projection.id.trim()) {
    errors.push("group projection id must be a non-empty string");
  }

  if (typeof projection.updatedAt !== "string" || !projection.updatedAt.trim()) {
    errors.push(`group ${projection.id} has an empty updatedAt`);
  }

  for (const key of numericKeys) {
    if (!Number.isFinite(projection[key]) || projection[key] < 0) {
      errors.push(`group ${projection.id} has an invalid ${key}`);
    }
  }

  for (const sessionId of projection.sessionIds) {
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      errors.push(`group ${projection.id} contains an empty sessionId`);
      continue;
    }
    if (seen.has(sessionId)) {
      errors.push(`group ${projection.id} contains duplicate sessionId ${sessionId}`);
      continue;
    }
    seen.add(sessionId);
  }

  for (let index = 1; index < projection.sessionIds.length; index += 1) {
    const left = projection.sessionIds[index - 1];
    const right = projection.sessionIds[index];
    if (
      typeof left === "string" &&
      typeof right === "string" &&
      left.localeCompare(right) > 0
    ) {
      errors.push(`group ${projection.id} sessionIds are not sorted`);
      break;
    }
  }

  if (projection.totalSessions !== projection.sessionIds.length) {
    errors.push(
      `group ${projection.id} totalSessions=${projection.totalSessions} does not match sessionIds.length=${projection.sessionIds.length}`
    );
  }

  return errors;
}

function compareNormalizedEventOrder(
  left: NormalizedExecutionEvent,
  right: NormalizedExecutionEvent
) {
  if (left.timestamp !== right.timestamp) {
    return left.timestamp.localeCompare(right.timestamp);
  }
  return left.id.localeCompare(right.id);
}
