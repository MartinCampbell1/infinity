import type {
  AccountCapacityState,
  AccountQuotaProducerIngestRequest,
  AccountQuotaSnapshot,
  AccountQuotaSource,
  AccountQuotaUpdate,
  ControlPlaneAccountQuotaIngestResponse,
} from "../contracts/quota";
import {
  buildNormalizedExecutionEventId,
  materializeSessionProjections,
  type ExecutionSessionPhase,
  type NormalizedExecutionEvent,
} from "../events";
import {
  controlPlaneActorContext,
  type ControlPlaneMutationActor,
} from "../../http/control-plane-auth";
import { appendNormalizedEvents } from "../events/store";
import { updateControlPlaneState } from "../state/store";
import {
  tenantScopedRecordFields,
  withTenantMetadataRaw,
} from "../state/tenancy";
import { deriveAccountCapacityState } from "./capacity";
import { buildMockQuotaIngestResponse } from "./responses";

function isQuotaSource(value: unknown): value is AccountQuotaSource {
  return (
    value === "openai_app_server" ||
    value === "chatgpt_usage_panel" ||
    value === "observed_runtime" ||
    value === "router_derived"
  );
}

function isQuotaSnapshot(value: unknown): value is AccountQuotaSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AccountQuotaSnapshot>;
  return (
    typeof candidate.accountId === "string" &&
    candidate.accountId.trim().length > 0 &&
    (candidate.authMode === "chatgpt" ||
      candidate.authMode === "chatgptAuthTokens" ||
      candidate.authMode === "apikey" ||
      candidate.authMode === "unknown") &&
    isQuotaSource(candidate.source) &&
    typeof candidate.observedAt === "string" &&
    candidate.observedAt.trim().length > 0 &&
    Array.isArray(candidate.buckets)
  );
}

export function isAccountQuotaProducerIngestRequest(
  value: unknown
): value is AccountQuotaProducerIngestRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AccountQuotaProducerIngestRequest>;
  const sessionIdsValid =
    candidate.sessionIds === undefined ||
    (Array.isArray(candidate.sessionIds) &&
      candidate.sessionIds.every(
        (sessionId) => typeof sessionId === "string" && sessionId.trim().length > 0
      ));

  return (
    isQuotaSource(candidate.producer) &&
    isQuotaSnapshot(candidate.snapshot) &&
    (candidate.summary === undefined || typeof candidate.summary === "string") &&
    sessionIdsValid
  );
}

function normalizeSummary(
  summary: string | undefined,
  snapshot: AccountQuotaSnapshot,
  capacity: AccountCapacityState
) {
  const normalized = summary?.trim();
  if (normalized) {
    return normalized;
  }
  return `Quota updated for ${snapshot.accountId} (${capacity.pressure} pressure).`;
}

function resolveEventSource(snapshotSource: AccountQuotaSource): NormalizedExecutionEvent["source"] {
  return snapshotSource === "openai_app_server" ? "codex_app_server" : "manual";
}

function normalizeExplicitSessionIds(sessionIds?: string[]) {
  if (!sessionIds?.length) {
    return [];
  }

  return Array.from(
    new Set(
      sessionIds.map((sessionId) => sessionId.trim()).filter((sessionId) => sessionId.length > 0)
    )
  );
}

function resolveAffectedSessionIds(
  events: readonly NormalizedExecutionEvent[],
  snapshot: AccountQuotaSnapshot,
  explicitSessionIds?: string[]
) {
  const projections = materializeSessionProjections(events);
  const explicit = normalizeExplicitSessionIds(explicitSessionIds);
  if (explicit.length > 0) {
    return explicit.filter((sessionId) => Boolean(projections[sessionId]));
  }

  return Object.values(projections)
    .filter(
      (session) =>
        session.accountId === snapshot.accountId &&
        session.status !== "completed" &&
        session.status !== "cancelled"
    )
    .map((session) => session.id)
    .sort((left, right) => left.localeCompare(right));
}

function normalizeSessionPhase(value: string | null | undefined): ExecutionSessionPhase | null {
  if (
    value === "planning" ||
    value === "acting" ||
    value === "validating" ||
    value === "blocked" ||
    value === "review" ||
    value === "completed" ||
    value === "unknown"
  ) {
    return value;
  }
  return null;
}

function buildQuotaUpdatedEvents(params: {
  sessionIds: string[];
  snapshot: AccountQuotaSnapshot;
  summary: string;
  capacity: AccountCapacityState;
  existingEvents: readonly NormalizedExecutionEvent[];
  producer: AccountQuotaSource;
  actor?: ControlPlaneMutationActor;
}): NormalizedExecutionEvent[] {
  const projections = materializeSessionProjections(params.existingEvents);
  const source = resolveEventSource(params.snapshot.source);
  const actorContext = params.actor
    ? controlPlaneActorContext(params.actor)
    : null;

  return params.sessionIds.flatMap((sessionId, index) => {
    const session = projections[sessionId];
    if (!session) {
      return [];
    }

    return [
      {
        id: buildNormalizedExecutionEventId({
          sessionId,
          kind: "quota.updated",
          timestamp: params.snapshot.observedAt,
          source,
          ordinal: index + 1,
        }),
        sessionId,
        projectId: session.projectId,
        groupId: session.groupId ?? null,
        source,
        provider: session.provider,
        kind: "quota.updated",
        phase: normalizeSessionPhase(session.phase),
        timestamp: params.snapshot.observedAt,
        summary: params.summary,
        payload: {
          accountId: params.snapshot.accountId,
          authMode: params.snapshot.authMode,
          quotaSource: params.snapshot.source,
          producer: params.producer,
          pressure: params.capacity.pressure,
          schedulable: params.capacity.schedulable,
          nextResetAt: params.capacity.nextResetAt ?? null,
          observedAt: params.snapshot.observedAt,
          bucketCount: params.snapshot.buckets.length,
          actorContext,
        },
        raw: withTenantMetadataRaw(params.snapshot.raw ?? null, params.actor),
        ...tenantScopedRecordFields(params.actor),
      } satisfies NormalizedExecutionEvent,
    ];
  });
}

export async function ingestMockQuotaProducerSnapshot(
  request: AccountQuotaProducerIngestRequest,
  actor?: ControlPlaneMutationActor
): Promise<ControlPlaneAccountQuotaIngestResponse<AccountCapacityState, AccountQuotaUpdate>> {
  const snapshot: AccountQuotaSnapshot = {
    ...JSON.parse(JSON.stringify(request.snapshot)),
    ...tenantScopedRecordFields(actor),
    raw: withTenantMetadataRaw(request.snapshot.raw ?? null, actor),
  };
  const capacity = deriveAccountCapacityState(snapshot);
  const summary = normalizeSummary(request.summary, snapshot, capacity);
  const actorContext = actor ? controlPlaneActorContext(actor) : null;

  let updateRecord: AccountQuotaUpdate | null = null;
  let affectedSessionIds: string[] = [];
  let persistedEvents: NormalizedExecutionEvent[] = [];

  await updateControlPlaneState(
    (draft) => {
      draft.accounts.snapshots = [
        ...draft.accounts.snapshots.filter((entry) => entry.accountId !== snapshot.accountId),
        snapshot,
      ].sort((left, right) => left.accountId.localeCompare(right.accountId));

      const nextSequence =
        draft.accounts.updates.reduce(
          (maxSequence, entry) => Math.max(maxSequence, entry.sequence),
          0
        ) + 1;

      updateRecord = {
        sequence: nextSequence,
        ...tenantScopedRecordFields(actor),
        accountId: snapshot.accountId,
        source: snapshot.source,
        observedAt: snapshot.observedAt,
        summary,
        snapshot,
        actorContext,
      };

      draft.accounts.updates = [...draft.accounts.updates, updateRecord];

      affectedSessionIds = resolveAffectedSessionIds(
        draft.sessions.events,
        snapshot,
        request.sessionIds
      );
      persistedEvents = buildQuotaUpdatedEvents({
        sessionIds: affectedSessionIds,
        snapshot,
        summary,
        capacity,
        existingEvents: draft.sessions.events,
        producer: request.producer,
        actor,
      });

      if (persistedEvents.length > 0) {
        draft.sessions.events = appendNormalizedEvents(draft.sessions, persistedEvents).events;
      }
    },
    {
      buildRelationalDelta(state) {
        const sessionMap = materializeSessionProjections(state.sessions.events);
        return {
          sessions: affectedSessionIds
            .map((sessionId) => sessionMap[sessionId])
            .filter((session): session is NonNullable<typeof session> => Boolean(session)),
          events: persistedEvents,
          quotaSnapshots: [snapshot],
          quotaUpdates: updateRecord ? [updateRecord] : [],
        };
      },
    }
  );

  if (!updateRecord) {
    throw new Error("Failed to persist quota producer update.");
  }

  return buildMockQuotaIngestResponse({
    snapshot,
    update: updateRecord,
    capacity,
    affectedSessionIds,
    persistedEvents,
  });
}

export const ingestQuotaProducerSnapshot = ingestMockQuotaProducerSnapshot;
