import {
  buildNormalizedExecutionEventId,
  resolveNormalizedExecutionTimestamp,
  type NormalizedExecutionEvent,
} from "../contracts/session-events";
import type { ControlPlaneState } from "../state/types";
import { sortNormalizedEvents } from "./normalizers";

import { appendNormalizedEvents } from "./store";

function resolveLatestSessionEvent(
  events: readonly NormalizedExecutionEvent[],
  sessionId: string
) {
  const sessionEvents = sortNormalizedEvents(
    events.filter((event) => event.sessionId === sessionId)
  );

  return sessionEvents[sessionEvents.length - 1] ?? null;
}

export function resolveNextSessionEventTimestamp(
  state: ControlPlaneState,
  sessionId: string,
  preferredTimestamp?: string | null
) {
  const normalizedPreferred = resolveNormalizedExecutionTimestamp(
    preferredTimestamp,
    "2026-04-11T00:00:00.000Z"
  );
  const latest = resolveLatestSessionEvent(state.sessions.events, sessionId);

  if (!latest) {
    return normalizedPreferred;
  }

  const latestTime = Date.parse(latest.timestamp);
  const preferredTime = Date.parse(normalizedPreferred);

  if (Number.isNaN(latestTime) || Number.isNaN(preferredTime)) {
    return normalizedPreferred;
  }

  if (preferredTime > latestTime) {
    return normalizedPreferred;
  }

  return new Date(latestTime + 1).toISOString();
}

export function appendOperatorSessionEvent(
  state: ControlPlaneState,
  input: Omit<NormalizedExecutionEvent, "id" | "timestamp"> & {
    timestamp?: string | null;
    ordinal?: number;
  }
) {
  const timestamp = resolveNextSessionEventTimestamp(
    state,
    input.sessionId,
    input.timestamp
  );
  const event: NormalizedExecutionEvent = {
    ...input,
    timestamp,
    id: buildNormalizedExecutionEventId({
      sessionId: input.sessionId,
      source: input.source,
      kind: input.kind,
      timestamp,
      ordinal: input.ordinal ?? 0,
    }),
  };

  state.sessions.events = appendNormalizedEvents(state.sessions, [event]).events;
  return event;
}
