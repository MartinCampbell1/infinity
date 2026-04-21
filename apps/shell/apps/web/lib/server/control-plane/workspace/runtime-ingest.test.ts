import { afterEach, describe, expect, test } from "vitest";

import type {
  SessionWorkspaceHostContext,
  WorkspaceRuntimeBridgeIngestRequest,
} from "../contracts/workspace-launch";
import { createIsolatedControlPlaneStateDir } from "../state/test-helpers";
import { readControlPlaneState } from "../state/store";
import {
  isWorkspaceRuntimeBridgeIngestRequest,
  persistWorkspaceRuntimeBridgeMessage,
} from "./runtime-ingest";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

function buildContext(
  sessionId: string,
  overrides: Partial<SessionWorkspaceHostContext> = {}
) {
  return {
    projectId: "project-runtime",
    projectName: "Runtime Project",
    sessionId,
    externalSessionId: "runtime-external-session",
    groupId: "group-runtime",
    workspaceId: "workspace-runtime",
    accountId: "account-chatgpt-03",
    accountLabel: "chatgpt fallback 03",
    model: "gpt-4.1",
    executionMode: "worktree" as const,
    quotaState: {
      pressure: "medium" as const,
      usedPercent: 40,
      resetsAt: "2026-04-11T15:00:00.000Z",
    },
    pendingApprovals: 0,
    openedFrom: "deep_link" as const,
    ...overrides,
  };
}

describe("persistWorkspaceRuntimeBridgeMessage", () => {
  test("upserts approval requests and appends a normalized workspace event", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const result = await persistWorkspaceRuntimeBridgeMessage({
      hostContext: buildContext("session-runtime-approval"),
      message: {
        type: "workspace.approval.requested",
        payload: {
          approvalId: "approval-runtime-001",
          summary: "Approve workspace runtime mutation",
        },
      },
    });

    expect(result.event.kind).toBe("approval.requested");
    expect(result.approvalRequest?.id).toBe("approval-runtime-001");
    expect(result.approvalRequest?.status).toBe("pending");

    const state = await readControlPlaneState();
    const approval = state.approvals.requests.find((request) => request.id === "approval-runtime-001");
    const event = state.sessions.events.find((entry) => entry.sessionId === "session-runtime-approval");

    expect(approval).toBeTruthy();
    expect(approval?.summary).toBe("Approve workspace runtime mutation");
    expect(event?.kind).toBe("approval.requested");
    expect(event?.payload.approvalId).toBe("approval-runtime-001");
  });

  test("persists producer batches and returns every normalized event", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const batchRequest: WorkspaceRuntimeBridgeIngestRequest = {
      hostContext: buildContext("session-runtime-batch"),
      producer: "workspace_runtime_bridge",
      messages: [
        {
          type: "workspace.session.updated",
          payload: {
            title: "Batch workspace session",
            status: "acting",
          },
        },
        {
          type: "workspace.approval.requested",
          payload: {
            approvalId: "approval-runtime-batch",
            summary: "Approve workspace batch mutation",
          },
        },
      ],
    };

    expect(isWorkspaceRuntimeBridgeIngestRequest(batchRequest)).toBe(true);

    const result = await persistWorkspaceRuntimeBridgeMessage(batchRequest);

    expect(result.persistedEvents).toHaveLength(2);
    expect(result.event.kind).toBe("approval.requested");
    expect(result.touchedApprovals).toHaveLength(1);
    expect(result.approvalRequest?.id).toBe("approval-runtime-batch");

    const state = await readControlPlaneState();
    const events = state.sessions.events.filter(
      (entry) => entry.sessionId === "session-runtime-batch"
    );

    expect(events.map((entry) => entry.kind)).toEqual([
      "session.updated",
      "approval.requested",
    ]);
  });

  test("records retry semantics for same-account and fallback-account bridge messages", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const sameAccountResult = await persistWorkspaceRuntimeBridgeMessage({
      hostContext: buildContext("session-runtime-retry-same"),
      message: {
        type: "founderos.session.retry",
        payload: {
          retryMode: "same_account",
        },
      },
    });

    const fallbackResult = await persistWorkspaceRuntimeBridgeMessage({
      hostContext: buildContext("session-runtime-retry-fallback"),
      message: {
        type: "founderos.session.retry",
        payload: {
          retryMode: "fallback_account",
        },
      },
    });

    expect(sameAccountResult.event.kind).toBe("recovery.started");
    expect(sameAccountResult.recoveryIncident?.status).toBe("retryable");
    expect(sameAccountResult.recoveryIncident?.recoveryActionKind).toBe("retry");

    expect(fallbackResult.event.kind).toBe("recovery.started");
    expect(fallbackResult.recoveryIncident?.status).toBe("failing_over");
    expect(fallbackResult.recoveryIncident?.recoveryActionKind).toBe("failover");

    const state = await readControlPlaneState();
    const sameAccountIncident = state.recoveries.incidents.find(
      (incident) => incident.sessionId === "session-runtime-retry-same"
    );
    const fallbackIncident = state.recoveries.incidents.find(
      (incident) => incident.sessionId === "session-runtime-retry-fallback"
    );

    expect(sameAccountIncident?.status).toBe("retryable");
    expect(fallbackIncident?.status).toBe("failing_over");
  });

  test("persists account switch events without touching approval or recovery lanes", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const result = await persistWorkspaceRuntimeBridgeMessage({
      hostContext: buildContext("session-runtime-switch"),
      message: {
        type: "founderos.account.switch",
        payload: {
          accountId: "account-chatgpt-01",
        },
      },
    });

    expect(result.event.kind).toBe("account.switched");

    const state = await readControlPlaneState();
    const event = state.sessions.events.find((entry) => entry.sessionId === "session-runtime-switch");

    expect(event?.kind).toBe("account.switched");
    expect(event?.payload.accountId).toBe("account-chatgpt-01");
    expect(state.approvals.requests.some((request) => request.sessionId === "session-runtime-switch")).toBe(false);
    expect(state.recoveries.incidents.some((incident) => incident.sessionId === "session-runtime-switch")).toBe(false);
  });

  test("creates or updates a recovery incident from workspace errors", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const result = await persistWorkspaceRuntimeBridgeMessage({
      hostContext: buildContext("session-runtime-error"),
      message: {
        type: "workspace.error",
        payload: {
          code: "quota_exceeded",
          message: "Quota boundary crossed",
        },
      },
    });

    expect(result.event.kind).toBe("error.raised");
    expect(result.recoveryIncident?.status).toBe("retryable");
    expect(result.recoveryIncident?.severity).toBe("high");

    const state = await readControlPlaneState();
    const incident = state.recoveries.incidents.find((entry) => entry.sessionId === "session-runtime-error");
    const event = state.sessions.events.find((entry) => entry.sessionId === "session-runtime-error");

    expect(incident?.summary).toContain("quota_exceeded");
    expect(event?.kind).toBe("error.raised");
  });
});
