import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import {
  buildInitialControlPlaneStateForPolicy,
  buildControlPlaneStateNotes,
  CONTROL_PLANE_STORAGE_MODE_ENV_KEY,
  getControlPlaneStatePath,
  isControlPlaneStorageUnavailableError,
  readControlPlaneState,
  resolveControlPlaneStoragePolicy,
  resetControlPlaneStateForTests,
  updateControlPlaneState,
} from "./store";
import { createIsolatedControlPlaneStateDir } from "./test-helpers";
import {
  CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY,
  CANONICAL_WORK_UI_BASE_URL_ENV_KEY,
  CONTROL_PLANE_DATABASE_URL_ENV_KEY,
  CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY,
  CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY,
  DEPLOYMENT_ENV_KEY,
  EXECUTION_KERNEL_BASE_URL_ENV_KEY,
  EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY,
  PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY,
  STRICT_ROLLOUT_ENV_KEY,
  WORKSPACE_LAUNCH_SECRET_ENV_KEY,
  WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY,
  WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY,
} from "../workspace/rollout-config";

let restoreStateDir: (() => void) | null = null;
const ORIGINAL_SYNTHETIC_SEEDS =
  process.env.FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS;

afterEach(async () => {
  resetControlPlaneStateForTests();
  if (ORIGINAL_SYNTHETIC_SEEDS === undefined) {
    delete process.env.FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS;
  } else {
    process.env.FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS =
      ORIGINAL_SYNTHETIC_SEEDS;
  }
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

function configureProductionControlPlaneEnv() {
  process.env[DEPLOYMENT_ENV_KEY] = "production";
  process.env[STRICT_ROLLOUT_ENV_KEY] = "1";
  process.env[CONTROL_PLANE_DATABASE_URL_ENV_KEY] =
    "postgres://127.0.0.1:1/infinity_control_plane";
  process.env[CANONICAL_SHELL_PUBLIC_ORIGIN_ENV_KEY] =
    "https://shell.infinity.example";
  process.env[CANONICAL_WORK_UI_BASE_URL_ENV_KEY] =
    "https://work.infinity.example";
  process.env[EXECUTION_KERNEL_BASE_URL_ENV_KEY] =
    "https://kernel.infinity.example";
  process.env[EXECUTION_KERNEL_SERVICE_AUTH_SECRET_ENV_KEY] = "kernel-secret";
  process.env[PRIVILEGED_API_ALLOWED_ORIGINS_ENV_KEY] =
    "https://shell.infinity.example,https://work.infinity.example";
  process.env[WORKSPACE_LAUNCH_SECRET_ENV_KEY] = "launch-secret";
  process.env[WORKSPACE_SESSION_GRANT_SECRET_ENV_KEY] = "grant-secret";
  process.env[WORKSPACE_SESSION_TOKEN_SECRET_ENV_KEY] = "session-secret";
  process.env[CONTROL_PLANE_OPERATOR_TOKEN_ENV_KEY] = "operator-secret";
  process.env[CONTROL_PLANE_SERVICE_TOKEN_ENV_KEY] = "service-secret";
}

function writeUnifiedStateWithSingleApproval(id: string) {
  writeFileSync(
    getControlPlaneStatePath(),
    JSON.stringify(
      {
        version: 1,
        seededAt: "2026-04-24T00:00:00.000Z",
        approvals: {
          requests: [
            {
              id,
              sessionId: "session-file-import",
              externalSessionId: null,
              projectId: "project-file-import",
              projectName: "File Import",
              groupId: null,
              accountId: null,
              workspaceId: null,
              requestKind: "command",
              title: "File import approval",
              summary: "File import approval",
              reason: null,
              status: "pending",
              decision: null,
              requestedAt: "2026-04-24T00:00:00.000Z",
              updatedAt: "2026-04-24T00:00:00.000Z",
              resolvedAt: null,
              resolvedBy: null,
              expiresAt: null,
              revision: 1,
            },
          ],
          operatorActions: [],
          actionSequence: 1,
        },
        recoveries: {
          incidents: [],
          operatorActions: [],
          actionSequence: 101,
        },
        accounts: {
          snapshots: [],
          updates: [],
        },
        sessions: {
          events: [],
        },
        orchestration: {
          initiatives: [],
          briefs: [],
          taskGraphs: [],
          workUnits: [],
          batches: [],
          supervisorActions: [],
          assemblies: [],
          verifications: [],
          deliveries: [],
          runs: [],
          specDocs: [],
          agentSessions: [],
          refusals: [],
          runEvents: [],
          previewTargets: [],
          handoffPackets: [],
          validationProofs: [],
          secretPauses: [],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
}

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
    expect(persisted.approvals.requests.length).toBe(
      state.approvals.requests.length,
    );
    expect(persisted.recoveries.incidents.length).toBe(
      state.recoveries.incidents.length,
    );
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
        note.includes("shell-owned local file-backed durability boundary"),
      ),
    ).toBe(true);
    expect(
      notes.some((note) =>
        note.includes("sessionId remains the canonical truth key"),
      ),
    ).toBe(true);
    expect(
      notes.some((note) => note.includes("control-plane.state.json")),
    ).toBe(true);
    expect(notes.at(-1)).toBe("Extra note");
  });

  test("serializes parallel local mutations so appended events are not lost", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    const eventIds = Array.from({ length: 12 }, (_, index) =>
      `event-concurrent-${index}`,
    );

    await Promise.all(
      eventIds.map((eventId, index) =>
        updateControlPlaneState(async (draft) => {
          await new Promise((resolve) => setTimeout(resolve, 2));
          draft.sessions.events = [
            ...draft.sessions.events,
            {
              id: eventId,
              sessionId: "session-concurrent",
              projectId: "project-concurrent",
              groupId: null,
              source: "manual",
              provider: "codex",
              kind: "session.updated",
              status: "completed",
              phase: "acting",
              timestamp: `2026-04-24T00:00:${String(index).padStart(2, "0")}.000Z`,
              summary: `Concurrent event ${index}`,
              payload: { index },
              raw: null,
            },
          ];
        }),
      ),
    );

    const state = await readControlPlaneState();
    expect(
      eventIds.every((eventId) =>
        state.sessions.events.some((event) => event.id === eventId),
      ),
    ).toBe(true);
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
      "utf8",
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
      "utf8",
    );

    resetControlPlaneStateForTests();
    const state = await readControlPlaneState();

    expect(state.approvals.requests).toHaveLength(1);
    expect(state.approvals.requests[0]?.id).toBe("approval-legacy");
    expect(state.recoveries.incidents).toHaveLength(1);
    expect(state.recoveries.incidents[0]?.id).toBe("recovery-legacy");
    expect(existsSync(path.join(directory, "control-plane.state.json"))).toBe(
      true,
    );
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
    expect(
      notes.some((note) =>
        note.includes("fell back to unified file-backed state"),
      ),
    ).toBe(true);
    expect(notes.some((note) => note.includes("State file:"))).toBe(true);
  });

  test("refuses local file fallback when production deployment storage is unavailable", async () => {
    const previous = { ...process.env };
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    configureProductionControlPlaneEnv();

    try {
      resetControlPlaneStateForTests();
      let thrown: unknown = null;
      try {
        await readControlPlaneState();
      } catch (error) {
        thrown = error;
      }
      expect(isControlPlaneStorageUnavailableError(thrown)).toBe(true);
      if (isControlPlaneStorageUnavailableError(thrown)) {
        expect(thrown.status).toBe(503);
        expect(thrown.storagePolicy.localFileAllowed).toBe(false);
        expect(thrown.storagePolicy.degradedMode).toBe("read_only");
      }
      expect(existsSync(getControlPlaneStatePath())).toBe(false);
    } finally {
      process.env = previous;
    }
  });

  test("refuses production mutations when Postgres writes are unavailable without writing file state", async () => {
    const previous = { ...process.env };
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    configureProductionControlPlaneEnv();

    try {
      resetControlPlaneStateForTests();
      let thrown: unknown = null;
      try {
        await updateControlPlaneState((draft) => {
          draft.approvals.requests = [];
        });
      } catch (error) {
        thrown = error;
      }
      expect(isControlPlaneStorageUnavailableError(thrown)).toBe(true);
      if (isControlPlaneStorageUnavailableError(thrown)) {
        expect(thrown.status).toBe(503);
        expect(thrown.storagePolicy.postgresRequired).toBe(true);
        expect(thrown.storagePolicy.localFileAllowed).toBe(false);
      }
      expect(existsSync(getControlPlaneStatePath())).toBe(false);
      expect(resolveControlPlaneStoragePolicy().localFileAllowed).toBe(false);
    } finally {
      process.env = previous;
    }
  });

  test("does not import local file state into an empty production Postgres seed outside migration recovery", async () => {
    const previous = { ...process.env };
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    configureProductionControlPlaneEnv();
    writeUnifiedStateWithSingleApproval("approval-from-local-file");

    try {
      const policy = resolveControlPlaneStoragePolicy();
      const initialState = buildInitialControlPlaneStateForPolicy(policy);

      expect(policy.localFileAllowed).toBe(false);
      expect(policy.fileStateImportAllowed).toBe(false);
      expect(initialState.approvals.requests.some((request) => request.id === "approval-from-local-file")).toBe(false);
    } finally {
      process.env = previous;
    }
  });

  test("allows file state import only with explicit migration recovery mode", async () => {
    const previous = { ...process.env };
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    configureProductionControlPlaneEnv();
    process.env[CONTROL_PLANE_STORAGE_MODE_ENV_KEY] = "migration_recovery";
    writeUnifiedStateWithSingleApproval("approval-from-migration-recovery");

    try {
      const policy = resolveControlPlaneStoragePolicy();
      const initialState = buildInitialControlPlaneStateForPolicy(policy);

      expect(policy.mode).toBe("migration_recovery");
      expect(policy.localFileAllowed).toBe(true);
      expect(policy.fileStateImportAllowed).toBe(true);
      expect(initialState.approvals.requests.map((request) => request.id)).toEqual([
        "approval-from-migration-recovery",
      ]);
    } finally {
      process.env = previous;
    }
  });

  test("hydrates an empty live-safe state when synthetic seeds are explicitly disabled", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;
    process.env.FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS = "0";

    resetControlPlaneStateForTests();
    const state = await readControlPlaneState();

    expect(state.approvals.requests).toHaveLength(0);
    expect(state.recoveries.incidents).toHaveLength(0);
    expect(state.accounts.snapshots).toHaveLength(0);
    expect(state.accounts.updates).toHaveLength(0);
    expect(state.sessions.events).toHaveLength(0);
  });
});
