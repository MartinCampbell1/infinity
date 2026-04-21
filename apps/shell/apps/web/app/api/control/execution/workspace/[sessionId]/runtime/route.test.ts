import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resetControlPlaneStateForTests } from "../../../../../../../lib/server/control-plane/state/store";

import { POST as postWorkspaceRuntimeIngest } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-control-plane-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  await resetControlPlaneStateForTests();
});

afterEach(async () => {
  await resetControlPlaneStateForTests();
  if (ORIGINAL_CONTROL_PLANE_STATE_DIR === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = ORIGINAL_CONTROL_PLANE_STATE_DIR;
  }
  if (ORIGINAL_CONTROL_PLANE_DATABASE_URL === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL = ORIGINAL_CONTROL_PLANE_DATABASE_URL;
  }
  if (ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL === undefined) {
    delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  } else {
    process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL =
      ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL;
  }
  if (tempStateDir) {
    rmSync(tempStateDir, { recursive: true, force: true });
    tempStateDir = "";
  }
});

describe("/api/control/execution/workspace/[sessionId]/runtime", () => {
  test("accepts a supported runtime message and reports touched approval state", async () => {
    const response = await postWorkspaceRuntimeIngest(
      new Request(
        "http://localhost/api/control/execution/workspace/session-2026-04-11-001/runtime",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            hostContext: {
              projectId: "project-atlas",
              projectName: "Atlas Launch",
              sessionId: "session-2026-04-11-001",
              groupId: "group-ops-01",
              accountId: "account-chatgpt-01",
              workspaceId: "workspace-atlas-main",
              openedFrom: "execution_board",
            },
            message: {
              type: "workspace.approval.requested",
              payload: {
                approvalId: "approval-001",
                summary: "Approve file edit cascade",
                reason: "Workspace mutation touches a shared artifact path.",
              },
            },
          }),
        }
      ),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("derived");
    expect(body.storageKind).toBe("file_backed");
    expect(body.integrationState).toBe("wired");
    expect(body.canonicalTruth).toBe("sessionId");
    expect(body.accepted).toBe(true);
    expect(body.persistedEvents).toHaveLength(1);
    expect(body.persistedEvents[0]).toEqual(
      expect.objectContaining({
        sessionId: "session-2026-04-11-001",
        kind: "approval.requested",
        source: "openwebui",
      })
    );
    expect(body.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          kind: "approval.requested",
        }),
        session: expect.objectContaining({
          id: "session-2026-04-11-001",
          pendingApprovals: 2,
          status: "waiting_for_approval",
        }),
        hostContext: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          accountId: "account-chatgpt-01",
          accountLabel: "chatgpt 01",
          pendingApprovals: 2,
        }),
      })
    );
    expect(body.touchedApprovals).toHaveLength(1);
    expect(body.touchedApprovals[0]).toEqual(
      expect.objectContaining({
        id: "approval-001",
        sessionId: "session-2026-04-11-001",
      })
    );
    expect(body.touchedRecoveries).toHaveLength(0);
  });

  test("accepts host retry bridge messages and returns touched recovery state", async () => {
    const response = await postWorkspaceRuntimeIngest(
      new Request(
        "http://localhost/api/control/execution/workspace/session-2026-04-11-001/runtime",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            hostContext: {
              projectId: "project-atlas",
              projectName: "Atlas Launch",
              sessionId: "session-2026-04-11-001",
              groupId: "group-ops-01",
              accountId: "account-chatgpt-01",
              workspaceId: "workspace-atlas-main",
              openedFrom: "execution_board",
            },
            message: {
              type: "founderos.session.retry",
              payload: {
                retryMode: "fallback_account",
              },
            },
          }),
        }
      ),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.persistedEvents[0]).toEqual(
      expect.objectContaining({
        sessionId: "session-2026-04-11-001",
        kind: "recovery.started",
        source: "manual",
      })
    );
    expect(body.touchedRecoveries).toHaveLength(1);
    expect(body.touchedRecoveries[0]).toEqual(
      expect.objectContaining({
        sessionId: "session-2026-04-11-001",
      })
    );
    expect(body.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          kind: "recovery.started",
        }),
        session: expect.objectContaining({
          id: "session-2026-04-11-001",
          recoveryState: "failing_over",
          retryCount: 1,
        }),
        hostContext: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          accountId: "account-chatgpt-01",
          pendingApprovals: 1,
        }),
      })
    );
  });

  test("accepts host account switch bridge messages and returns authoritative host snapshot", async () => {
    const response = await postWorkspaceRuntimeIngest(
      new Request(
        "http://localhost/api/control/execution/workspace/session-2026-04-11-001/runtime",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            hostContext: {
              projectId: "project-atlas",
              projectName: "Atlas Launch",
              sessionId: "session-2026-04-11-001",
              groupId: "group-ops-01",
              accountId: "account-chatgpt-03",
              workspaceId: "workspace-atlas-main",
              openedFrom: "execution_board",
            },
            message: {
              type: "founderos.account.switch",
              payload: {
                accountId: "account-chatgpt-01",
              },
            },
          }),
        }
      ),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          kind: "account.switched",
        }),
        session: expect.objectContaining({
          id: "session-2026-04-11-001",
          accountId: "account-chatgpt-01",
        }),
        hostContext: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          accountId: "account-chatgpt-01",
          accountLabel: "chatgpt 01",
          quotaState: expect.objectContaining({
            pressure: "low",
          }),
        }),
      })
    );
  });

  test("accepts workspace producer batches and persists every runtime message", async () => {
    const response = await postWorkspaceRuntimeIngest(
      new Request(
        "http://localhost/api/control/execution/workspace/session-2026-04-11-001/runtime",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            hostContext: {
              projectId: "project-atlas",
              projectName: "Atlas Launch",
              sessionId: "session-2026-04-11-001",
              groupId: "group-ops-01",
              accountId: "account-chatgpt-01",
              workspaceId: "workspace-atlas-main",
              openedFrom: "execution_board",
            },
            producer: "workspace_runtime_bridge",
            messages: [
              {
                type: "workspace.tool.started",
                payload: {
                  toolName: "shell-bridge-smoke",
                  eventId: "evt-batch-001",
                },
              },
              {
                type: "workspace.tool.completed",
                payload: {
                  toolName: "shell-bridge-smoke",
                  eventId: "evt-batch-001",
                  status: "completed",
                },
              },
            ],
          }),
        }
      ),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.persistedEvents).toHaveLength(2);
    expect(body.persistedEvents.map((event: { kind: string }) => event.kind)).toEqual([
      "tool.started",
      "tool.completed",
    ]);
    expect(body.runtimeSnapshot.latestEvent).toEqual(
      expect.objectContaining({
        kind: "tool.completed",
        sessionId: "session-2026-04-11-001",
      })
    );
  });

  test("rejects mismatched sessionId path and hostContext", async () => {
    const response = await postWorkspaceRuntimeIngest(
      new Request(
        "http://localhost/api/control/execution/workspace/session-2026-04-11-001/runtime",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            hostContext: {
              projectId: "project-atlas",
              projectName: "Atlas Launch",
              sessionId: "session-2026-04-11-002",
              groupId: "group-ops-01",
              accountId: "account-chatgpt-01",
              workspaceId: "workspace-atlas-main",
              openedFrom: "execution_board",
            },
            message: {
              type: "workspace.file.opened",
              payload: {
                path: "/workspace/notes.md",
              },
            },
          }),
        }
      ),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.detail).toContain("must match body.hostContext.sessionId");
  });
});
