import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  buildControlPlaneStateNotes,
  getControlPlaneStatePath,
  readControlPlaneState,
  resetControlPlaneStateForTests,
  updateControlPlaneState,
} from "./store";
import { createIsolatedControlPlaneStateDir } from "./test-helpers";

let restoreStateDir: (() => void) | null = null;

afterEach(async () => {
  resetControlPlaneStateForTests();
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("control-plane unified state store", () => {
  test("hydrates seeded state and persists one unified state file", async () => {
    const { directory, restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const state = await readControlPlaneState();
    const statePath = getControlPlaneStatePath();
    const persisted = JSON.parse(readFileSync(statePath, "utf8")) as {
      approvals: { requests: unknown[] };
      recoveries: { incidents: unknown[] };
      accounts: { snapshots: unknown[] };
      sessions: { events: unknown[] };
    };

    expect(directory).toContain("infinity-control-plane-state-");
    expect(existsSync(statePath)).toBe(true);
    expect(state.approvals.requests.length).toBeGreaterThanOrEqual(2);
    expect(state.recoveries.incidents.length).toBeGreaterThanOrEqual(2);
    expect(state.accounts.snapshots.length).toBeGreaterThanOrEqual(4);
    expect(state.sessions.events.length).toBeGreaterThanOrEqual(1);
    expect(persisted.approvals.requests.length).toBe(state.approvals.requests.length);
    expect(persisted.recoveries.incidents.length).toBe(state.recoveries.incidents.length);
  });

  test("persists updates and exposes unified notes", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const result = await updateControlPlaneState((draft) => {
      draft.approvals.requests[0]!.status = "approved";
      draft.approvals.requests[0]!.decision = "approve_once";
    });

    const notes = buildControlPlaneStateNotes(["Extra note"]);

    expect(result.integrationState).toBe("wired");
    expect(result.state.approvals.requests[0]?.status).toBe("approved");
    expect(result.state.approvals.requests[0]?.decision).toBe("approve_once");
    expect(
      notes.some((note) =>
        note.includes("shell-owned local file-backed durability boundary")
      )
    ).toBe(true);
    expect(notes.some((note) => note.includes("sessionId remains the canonical truth key"))).toBe(true);
    expect(notes.some((note) => note.includes("control-plane.state.json"))).toBe(true);
    expect(notes.at(-1)).toBe("Extra note");
  });

  test("hydrates from legacy approvals and recoveries files when unified file is absent", async () => {
    const { directory, restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    writeFileSync(
      path.join(directory, "approvals.state.json"),
      JSON.stringify({
        requests: [
          {
            id: "approval-legacy",
            sessionId: "session-legacy",
            externalSessionId: "codex-legacy",
            projectId: "project-legacy",
            projectName: "Legacy Project",
            groupId: "group-legacy",
            accountId: "account-chatgpt-01",
            workspaceId: "workspace-legacy",
            requestKind: "command",
            title: "Legacy approval",
            summary: "Legacy approval summary",
            reason: "Legacy reason",
            status: "pending",
            decision: null,
            requestedAt: "2026-04-11T10:00:00.000Z",
            updatedAt: "2026-04-11T10:00:00.000Z",
            resolvedAt: null,
            resolvedBy: null,
            expiresAt: null,
            revision: 1,
          },
        ],
        operatorActions: [],
        actionSequence: 7,
      }),
      "utf8"
    );
    writeFileSync(
      path.join(directory, "recoveries.state.json"),
      JSON.stringify({
        incidents: [
          {
            id: "recovery-legacy",
            sessionId: "session-legacy",
            externalSessionId: "codex-legacy",
            projectId: "project-legacy",
            projectName: "Legacy Project",
            groupId: "group-legacy",
            accountId: "account-chatgpt-01",
            workspaceId: "workspace-legacy",
            status: "retryable",
            severity: "medium",
            recoveryActionKind: "retry",
            summary: "Legacy recovery",
            rootCause: "Legacy root cause",
            recommendedAction: "Retry",
            retryCount: 1,
            openedAt: "2026-04-11T10:01:00.000Z",
            lastObservedAt: "2026-04-11T10:02:00.000Z",
            updatedAt: "2026-04-11T10:02:00.000Z",
            resolvedAt: null,
            revision: 1,
          },
        ],
        operatorActions: [],
        actionSequence: 109,
      }),
      "utf8"
    );

    resetControlPlaneStateForTests();
    const state = await readControlPlaneState();

    expect(state.approvals.requests).toHaveLength(1);
    expect(state.approvals.requests[0]?.id).toBe("approval-legacy");
    expect(state.recoveries.incidents).toHaveLength(1);
    expect(state.recoveries.incidents[0]?.id).toBe("recovery-legacy");
    expect(existsSync(path.join(directory, "control-plane.state.json"))).toBe(true);
  });

  test("falls back to unified file-backed state when Postgres is configured but unavailable", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL =
      "postgres://127.0.0.1:1/infinity_control_plane";

    resetControlPlaneStateForTests();
    const state = await readControlPlaneState();
    const notes = buildControlPlaneStateNotes();

    expect(state.approvals.requests.length).toBeGreaterThanOrEqual(2);
    expect(notes.some((note) => note.includes("fell back to unified file-backed state"))).toBe(true);
    expect(notes.some((note) => note.includes("State file:"))).toBe(true);
  });
});
