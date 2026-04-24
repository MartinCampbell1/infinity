import { afterEach, describe, expect, test } from "vitest";

import type {
  SessionWorkspaceHostContext,
  WorkspaceRuntimeBridgeIngestRequest,
} from "../contracts/workspace-launch";
import { createIsolatedControlPlaneStateDir } from "../state/test-helpers";
import { readControlPlaneState, updateControlPlaneState } from "../state/store";
import { TENANT_METADATA_KEY } from "../state/tenancy";
import {
  isWorkspaceRuntimeBridgeIngestRequest,
  persistWorkspaceRuntimeBridgeMessage,
} from "./runtime-ingest";

let restoreStateDir: (() => void) | null = null;
const TENANT_ENV_KEYS = [
  "FOUNDEROS_ENABLE_TENANT_ISOLATION",
  "FOUNDEROS_CONTROL_PLANE_TENANT_ID",
] as const;
const ORIGINAL_TENANT_ENV = Object.fromEntries(
  TENANT_ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof TENANT_ENV_KEYS)[number], string | undefined>;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
  for (const key of TENANT_ENV_KEYS) {
    const value = ORIGINAL_TENANT_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
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

  test("upserts recovery incidents by tenant and session together", async () => {
    process.env.FOUNDEROS_ENABLE_TENANT_ISOLATION = "1";
    process.env.FOUNDEROS_CONTROL_PLANE_TENANT_ID = "tenant-a";
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    await updateControlPlaneState((draft) => {
      draft.recoveries.incidents.push({
        id: "runtime-recovery-session-runtime-shared",
        tenantId: "tenant-b",
        createdBy: "operator-b",
        updatedBy: "operator-b",
        sessionId: "session-runtime-shared",
        externalSessionId: null,
        projectId: "project-runtime-b",
        projectName: "Runtime Project B",
        groupId: null,
        accountId: null,
        workspaceId: null,
        status: "retryable",
        severity: "medium",
        recoveryActionKind: "retry",
        summary: "Tenant B recovery must stay isolated.",
        rootCause: null,
        recommendedAction: null,
        retryCount: 0,
        openedAt: "2026-04-24T00:00:00.000Z",
        lastObservedAt: "2026-04-24T00:00:00.000Z",
        updatedAt: "2026-04-24T00:00:00.000Z",
        resolvedAt: null,
        revision: 1,
        raw: {
          [TENANT_METADATA_KEY]: {
            tenantId: "tenant-b",
            createdBy: "operator-b",
            updatedBy: "operator-b",
            requestId: "request-tenant-b-runtime",
            authBoundary: "token",
          },
        },
      });
    });

    const result = await persistWorkspaceRuntimeBridgeMessage(
      {
        hostContext: buildContext("session-runtime-shared", {
          projectId: "project-runtime-a",
          projectName: "Runtime Project A",
        }),
        message: {
          type: "workspace.error",
          payload: {
            code: "tenant_a_error",
            message: "Tenant A runtime error",
          },
        },
      },
      {
        actorType: "system",
        actorId: "workspace-runtime-a",
        tenantId: "tenant-a",
        requestId: "request-tenant-a-runtime",
        authBoundary: "token",
      },
    );

    expect(result.recoveryIncident).toEqual(
      expect.objectContaining({
        tenantId: "tenant-a",
        sessionId: "session-runtime-shared",
        projectId: "project-runtime-a",
      }),
    );

    const tenantAState = await readControlPlaneState();
    expect(tenantAState.recoveries.incidents).toEqual([
      expect.objectContaining({
        tenantId: "tenant-a",
        summary: "Workspace error: tenant_a_error",
      }),
    ]);

    process.env.FOUNDEROS_CONTROL_PLANE_TENANT_ID = "tenant-b";
    const tenantBState = await readControlPlaneState();
    expect(tenantBState.recoveries.incidents).toEqual([
      expect.objectContaining({
        tenantId: "tenant-b",
        summary: "Tenant B recovery must stay isolated.",
        revision: 1,
      }),
    ]);
  });
});
