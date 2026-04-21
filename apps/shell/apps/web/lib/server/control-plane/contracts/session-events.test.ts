import { describe, expect, test } from "vitest";

import {
  createExecutionSessionSummary,
  reduceSessionProjection,
  type NormalizedExecutionEvent,
  type SessionProjectionState,
} from "./session-events";

function buildBaseline(): SessionProjectionState {
  return {
    ...createExecutionSessionSummary({
      id: "session-test-001",
      projectId: "project-test",
      projectName: "Project Test",
      title: "Session Test",
      createdAt: "2026-04-11T10:00:00.000Z",
      updatedAt: "2026-04-11T10:00:00.000Z",
      status: "waiting_for_approval",
      phase: "blocked",
      pendingApprovals: 1,
      recoveryState: "none",
    }),
    appliedEventIds: [],
  };
}

function buildEvent(
  overrides: Partial<NormalizedExecutionEvent> & Pick<NormalizedExecutionEvent, "kind">
): NormalizedExecutionEvent {
  return {
    id: `session-test-001:manual:${overrides.kind}:2026-04-11T10:00:01.000Z:0`,
    sessionId: "session-test-001",
    projectId: "project-test",
    source: "manual",
    provider: "codex",
    status: "completed",
    phase: "acting",
    timestamp: "2026-04-11T10:00:01.000Z",
    summary: overrides.kind,
    payload: {},
    ...overrides,
  };
}

describe("reduceSessionProjection operator semantics", () => {
  test("approval.resolved clears waiting state differently for approve vs deny", () => {
    const approved = reduceSessionProjection(
      buildBaseline(),
      buildEvent({
        kind: "approval.resolved",
        status: "completed",
        payload: { approvalId: "approval-001", decision: "approve_once" },
      })
    );
    const denied = reduceSessionProjection(
      buildBaseline(),
      buildEvent({
        kind: "approval.resolved",
        status: "declined",
        phase: "blocked",
        payload: { approvalId: "approval-001", decision: "deny" },
      })
    );

    expect(approved.pendingApprovals).toBe(0);
    expect(approved.status).toBe("acting");
    expect(approved.phase).toBe("acting");
    expect(denied.pendingApprovals).toBe(0);
    expect(denied.status).toBe("blocked");
    expect(denied.phase).toBe("blocked");
  });

  test("recovery semantics distinguish retry/failover and dead completion", () => {
    const retryable = reduceSessionProjection(
      buildBaseline(),
      buildEvent({
        kind: "recovery.started",
        status: "in_progress",
        phase: "blocked",
        payload: { recoveryActionKind: "retry", recoveryStatus: "retryable" },
      })
    );
    const failingOver = reduceSessionProjection(
      buildBaseline(),
      buildEvent({
        kind: "recovery.started",
        status: "in_progress",
        phase: "blocked",
        payload: { recoveryActionKind: "failover", recoveryStatus: "failing_over" },
      })
    );
    const dead = reduceSessionProjection(
      buildBaseline(),
      buildEvent({
        kind: "recovery.completed",
        status: "failed",
        phase: "blocked",
        payload: { recoveryActionKind: "resolve", recoveryStatus: "dead" },
      })
    );

    expect(retryable.recoveryState).toBe("retryable");
    expect(failingOver.recoveryState).toBe("failing_over");
    expect(dead.recoveryState).toBe("dead");
    expect(dead.status).toBe("failed");
  });
});
