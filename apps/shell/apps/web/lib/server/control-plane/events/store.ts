import {
  type GroupProjectionState,
  reduceSessionProjection,
  type NormalizedExecutionEventProducerBatch,
  type NormalizedExecutionEvent,
  type SessionProjectionState,
} from "../contracts/session-events";
import { sortNormalizedEvents } from "./normalizers";

export interface AppendOnlyNormalizedEventStore {
  events: NormalizedExecutionEvent[];
}

export function createAppendOnlyNormalizedEventStore(
  seed: readonly NormalizedExecutionEvent[] = []
): AppendOnlyNormalizedEventStore {
  return { events: dedupeAndSort(seed) };
}

export function appendNormalizedEvents(
  store: AppendOnlyNormalizedEventStore,
  incoming: readonly NormalizedExecutionEvent[]
): AppendOnlyNormalizedEventStore {
  if (incoming.length === 0) {
    return store;
  }
  return {
    events: dedupeAndSort([...store.events, ...incoming]),
  };
}

export function appendNormalizedEventProducerBatch(
  store: AppendOnlyNormalizedEventStore,
  batch: NormalizedExecutionEventProducerBatch
): AppendOnlyNormalizedEventStore {
  if (batch.events.length === 0) {
    return store;
  }

  return appendNormalizedEvents(store, batch.events);
}

export function materializeSessionProjections(
  events: readonly NormalizedExecutionEvent[]
): Record<string, SessionProjectionState> {
  const sorted = sortNormalizedEvents(events);
  const result: Record<string, SessionProjectionState> = {};

  for (const event of sorted) {
    const previous = result[event.sessionId] ?? null;
    result[event.sessionId] = reduceSessionProjection(previous, event);
  }

  return result;
}

export function materializeGroupProjections(
  events: readonly NormalizedExecutionEvent[]
): Record<string, GroupProjectionState> {
  const sessions = materializeSessionProjections(events);
  const groups: Record<string, GroupProjectionState> = {};

  for (const session of Object.values(sessions)) {
    const groupId = session.groupId || "ungrouped";
    const previous = groups[groupId];
    const status = session.status;
    const isCompleted = status === "completed" || status === "cancelled";
    const isFailed = status === "failed" || status === "blocked";
    const isActive = !isCompleted && !isFailed;
    const isRetryable = session.recoveryState === "retryable";

    const next: GroupProjectionState = previous
      ? {
          ...previous,
          sessionIds: [...previous.sessionIds, session.id],
          totalSessions: previous.totalSessions + 1,
          activeSessions: previous.activeSessions + (isActive ? 1 : 0),
          completedSessions: previous.completedSessions + (isCompleted ? 1 : 0),
          failedSessions: previous.failedSessions + (isFailed ? 1 : 0),
          retryableSessions: previous.retryableSessions + (isRetryable ? 1 : 0),
          pendingApprovals: previous.pendingApprovals + session.pendingApprovals,
          unreadOperatorSignals:
            previous.unreadOperatorSignals + session.unreadOperatorSignals,
          updatedAt:
            session.updatedAt.localeCompare(previous.updatedAt) > 0
              ? session.updatedAt
              : previous.updatedAt,
        }
      : {
          id: groupId,
          sessionIds: [session.id],
          totalSessions: 1,
          activeSessions: isActive ? 1 : 0,
          completedSessions: isCompleted ? 1 : 0,
          failedSessions: isFailed ? 1 : 0,
          retryableSessions: isRetryable ? 1 : 0,
          pendingApprovals: session.pendingApprovals,
          unreadOperatorSignals: session.unreadOperatorSignals,
          updatedAt: session.updatedAt,
        };

    groups[groupId] = next;
  }

  for (const group of Object.values(groups)) {
    group.sessionIds.sort((left, right) => left.localeCompare(right));
  }

  return groups;
}

function dedupeAndSort(events: readonly NormalizedExecutionEvent[]) {
  const byId = new Map<string, NormalizedExecutionEvent>();
  for (const event of events) {
    if (!byId.has(event.id)) {
      byId.set(event.id, event);
    }
  }
  return sortNormalizedEvents(Array.from(byId.values()));
}
