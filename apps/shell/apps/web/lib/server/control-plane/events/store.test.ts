import { describe, expect, test } from "vitest";

import type { NormalizedExecutionEvent } from "../contracts/session-events";
import {
  appendNormalizedEventProducerBatch,
  createAppendOnlyNormalizedEventStore,
} from "./store";

function buildEvent(
  overrides: Partial<NormalizedExecutionEvent> & Pick<NormalizedExecutionEvent, "kind">
): NormalizedExecutionEvent {
  return {
    id: `session-batch:manual:${overrides.kind}:2026-04-11T12:00:00.000Z:0`,
    sessionId: "session-batch",
    projectId: "project-batch",
    source: "manual",
    provider: "codex",
    status: "completed",
    phase: "acting",
    timestamp: "2026-04-11T12:00:00.000Z",
    summary: overrides.kind,
    payload: {},
    ...overrides,
  };
}

describe("appendNormalizedEventProducerBatch", () => {
  test("dedupes repeated events and keeps the stored batch time-ordered", () => {
    const store = createAppendOnlyNormalizedEventStore([
      buildEvent({
        kind: "session.started",
        timestamp: "2026-04-11T12:00:01.000Z",
        id: "session-batch:manual:session.started:2026-04-11T12:00:01.000Z:0",
      }),
    ]);

    const updated = appendNormalizedEventProducerBatch(store, {
      producer: "workspace_runtime_bridge",
      sessionId: "session-batch",
      projectId: "project-batch",
      producedAt: "2026-04-11T12:00:02.000Z",
      events: [
        buildEvent({
          kind: "tool.completed",
          timestamp: "2026-04-11T12:00:03.000Z",
          id: "session-batch:manual:tool.completed:2026-04-11T12:00:03.000Z:0",
        }),
        buildEvent({
          kind: "tool.started",
          timestamp: "2026-04-11T12:00:02.000Z",
          id: "session-batch:manual:tool.started:2026-04-11T12:00:02.000Z:0",
          status: "in_progress",
        }),
        buildEvent({
          kind: "tool.started",
          timestamp: "2026-04-11T12:00:02.000Z",
          id: "session-batch:manual:tool.started:2026-04-11T12:00:02.000Z:0",
          status: "in_progress",
        }),
      ],
    });

    expect(updated.events).toHaveLength(3);
    expect(updated.events.map((event) => event.kind)).toEqual([
      "session.started",
      "tool.started",
      "tool.completed",
    ]);
  });
});
