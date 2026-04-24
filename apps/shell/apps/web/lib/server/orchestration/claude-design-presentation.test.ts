import { describe, expect, test } from "vitest";

import type { ControlPlaneState } from "../control-plane/state/types";
import {
  buildClaudeDesignFrontdoorRecentRuns,
  buildClaudeDesignRunsBoardItems,
} from "./claude-design-presentation";

function withStrictRolloutEnv<T>(value: string | undefined, callback: () => T) {
  const previous = process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  if (value === undefined) {
    delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  } else {
    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = value;
  }

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
    } else {
      process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = previous;
    }
  }
}

function buildState(): ControlPlaneState {
  return {
    version: 1,
    seededAt: "2026-04-21T00:00:00.000Z",
    approvals: {
      requests: [],
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
    tenancy: {
      tenants: [],
      users: [],
      memberships: [],
      projects: [],
      workspaces: [],
    },
    orchestration: {
      initiatives: [
        {
          id: "initiative-live-001",
          title: "Live recent run title",
          userRequest: "Build the live recent run from current shell state.",
          status: "ready",
          requestedBy: "martin",
          workspaceSessionId: "session-live-001",
          priority: "normal",
          createdAt: "2026-04-21T12:00:00.000Z",
          updatedAt: "2026-04-21T12:01:00.000Z",
        },
      ],
      briefs: [],
      taskGraphs: [
        {
          id: "task-graph-live-001",
          initiativeId: "initiative-live-001",
          briefId: "brief-live-001",
          version: 1,
          nodeIds: ["wu-1", "wu-2"],
          edges: [],
          status: "completed",
          createdAt: "2026-04-21T12:00:00.000Z",
          updatedAt: "2026-04-21T12:01:00.000Z",
        },
      ],
      workUnits: [
        {
          id: "work-unit-live-001-api",
          taskGraphId: "task-graph-live-001",
          title: "Wire live API",
          description: "Implement live API wiring.",
          executorType: "codex",
          scopePaths: ["/Users/martin/infinity/apps/shell"],
          dependencies: [],
          acceptanceCriteria: [],
          status: "completed",
          latestAttemptId: "attempt-live-001",
          createdAt: "2026-04-21T12:00:00.000Z",
          updatedAt: "2026-04-21T12:01:00.000Z",
        },
        {
          id: "work-unit-live-001-ui",
          taskGraphId: "task-graph-live-001",
          title: "Ship live UI",
          description: "Implement live UI wiring.",
          executorType: "droid",
          scopePaths: ["/Users/martin/infinity/apps/work-ui"],
          dependencies: [],
          acceptanceCriteria: [],
          status: "running",
          latestAttemptId: "attempt-live-002",
          createdAt: "2026-04-21T12:00:01.000Z",
          updatedAt: "2026-04-21T12:01:00.000Z",
        },
      ],
      batches: [
        {
          id: "batch-live-001",
          initiativeId: "initiative-live-001",
          taskGraphId: "task-graph-live-001",
          workUnitIds: ["work-unit-live-001-api", "work-unit-live-001-ui"],
          concurrencyLimit: 1,
          status: "running",
          startedAt: "2026-04-21T12:00:10.000Z",
          finishedAt: null,
        },
      ],
      supervisorActions: [],
      assemblies: [
        {
          id: "assembly-live-001",
          initiativeId: "initiative-live-001",
          taskGraphId: "task-graph-live-001",
          inputWorkUnitIds: ["work-unit-live-001-api", "work-unit-live-001-ui"],
          artifactUris: [],
          outputLocation: "/tmp/assembly-live-001",
          manifestPath: "/tmp/assembly-live-001/assembly-manifest.json",
          summary: "assembled",
          status: "assembled",
          createdAt: "2026-04-21T12:00:50.000Z",
          updatedAt: "2026-04-21T12:01:00.000Z",
        },
      ],
      verifications: [],
      deliveries: [
        {
          id: "delivery-live-001",
          initiativeId: "initiative-live-001",
          verificationRunId: "verification-live-001",
          taskGraphId: "task-graph-live-001",
          resultSummary: "Runnable localhost delivery bundle backed by verified assembly evidence.",
          localOutputPath: "/tmp/delivery-live-001",
          manifestPath: "/tmp/delivery-live-001/delivery-manifest.json",
          previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-live-001",
          launchManifestPath: "/tmp/delivery-live-001/launch-manifest.json",
          launchProofKind: "runnable_result",
          launchTargetLabel: "Integrated product preview",
          launchProofUrl: "http://127.0.0.1:5555/index.html",
          launchProofAt: "2026-04-21T12:01:00.000Z",
          handoffNotes: "ready",
          command: "python3 launch-localhost.py --port 0",
          status: "ready",
          deliveredAt: "2026-04-21T12:01:00.000Z",
        },
      ],
      runs: [
        {
          id: "run-live-001",
          initiativeId: "initiative-live-001",
          title: "Live recent run title",
          originalPrompt: "Build the live recent run from current shell state.",
          entryMode: "shell_chat",
          currentStage: "handed_off",
          health: "healthy",
          automationMode: "autonomous",
          manualStageProgression: false,
          operatorOverrideActive: false,
          previewStatus: "ready",
          handoffStatus: "ready",
          createdAt: "2026-04-21T12:00:00.000Z",
          updatedAt: "2026-04-21T12:01:00.000Z",
          completedAt: "2026-04-21T12:01:00.000Z",
        },
      ],
      specDocs: [],
      agentSessions: [
        {
          id: "agent-session-live-001",
          runId: "run-live-001",
          batchId: "batch-live-001",
          workItemId: "work-unit-live-001-ui",
          attemptId: "attempt-live-002",
          agentKind: "worker",
          status: "running",
          runtimeRef: "attempt-live-002",
          startedAt: "2026-04-21T12:00:15.000Z",
          finishedAt: null,
        },
      ],
      refusals: [],
      runEvents: [],
      previewTargets: [],
      handoffPackets: [],
      validationProofs: [],
      secretPauses: [],
    },
    mutations: {
      events: [],
      idempotency: [],
    },
  };
}

describe("claude design presentation", () => {
  test("frontdoor recent runs come from live shell state", () => {
    const items = buildClaudeDesignFrontdoorRecentRuns(buildState());

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        title: "Live recent run title",
        status: "ready",
      })
    );
    expect(items[0]?.href).toContain("initiative-live-001");
  });

  test("runs board items come from live shell state", () => {
    const items = buildClaudeDesignRunsBoardItems(buildState());

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        id: "run-live-001",
        title: "Live recent run title",
        prompt: "Build the live recent run from current shell state.",
        stage: "ready",
        preview: "localhost",
        tasks: "1 / 2",
        repo: "infinity",
        assignment: "droid",
        workspacePath: "/tmp/delivery-live-001",
      })
    );
    expect(items[0]?.taskItems).toHaveLength(2);
  });

  test("strict rollout demotes stale local ready runs in board and frontdoor projections", () => {
    withStrictRolloutEnv("1", () => {
      const state = buildState();
      const boardItems = buildClaudeDesignRunsBoardItems(state);
      const frontdoorItems = buildClaudeDesignFrontdoorRecentRuns(state);

      expect(boardItems[0]).toEqual(
        expect.objectContaining({
          stage: "verifying",
          preview: "preview",
          handoff: "building",
          group: "running",
        })
      );
      expect(frontdoorItems[0]).toEqual(
        expect.objectContaining({
          status: "verifying",
        })
      );
    });
  });

  test("groups cancelled runs separately from active pre-run stages", () => {
    const state = buildState();
    state.orchestration.initiatives.push({
      id: "initiative-live-002",
      title: "Cancelled run",
      userRequest: "cancelled",
      status: "cancelled",
      requestedBy: "martin",
      workspaceSessionId: null,
      priority: "normal",
      createdAt: "2026-04-21T12:02:00.000Z",
      updatedAt: "2026-04-21T12:03:00.000Z",
    });
    state.orchestration.runs.push({
      id: "run-live-002",
      initiativeId: "initiative-live-002",
      title: "Cancelled run",
      originalPrompt: "cancelled",
      entryMode: "shell_chat",
      currentStage: "cancelled",
      health: "failed",
      automationMode: "autonomous",
      manualStageProgression: false,
      operatorOverrideActive: false,
      previewStatus: "none",
      handoffStatus: "none",
      createdAt: "2026-04-21T12:02:00.000Z",
      updatedAt: "2026-04-21T12:03:00.000Z",
      completedAt: null,
    });

    state.orchestration.initiatives.push({
      id: "initiative-live-003",
      title: "Brief ready run",
      userRequest: "brief-ready",
      status: "brief_ready",
      requestedBy: "martin",
      workspaceSessionId: null,
      priority: "normal",
      createdAt: "2026-04-21T12:04:00.000Z",
      updatedAt: "2026-04-21T12:05:00.000Z",
    });
    state.orchestration.runs.push({
      id: "run-live-003",
      initiativeId: "initiative-live-003",
      title: "Brief ready run",
      originalPrompt: "brief-ready",
      entryMode: "shell_chat",
      currentStage: "planning",
      health: "healthy",
      automationMode: "autonomous",
      manualStageProgression: false,
      operatorOverrideActive: false,
      previewStatus: "none",
      handoffStatus: "none",
      createdAt: "2026-04-21T12:04:00.000Z",
      updatedAt: "2026-04-21T12:05:00.000Z",
      completedAt: null,
    });

    const items = buildClaudeDesignRunsBoardItems(state);
    const cancelled = items.find((item) => item.id === "run-live-002");
    const briefReady = items.find((item) => item.id === "run-live-003");

    expect(cancelled?.stage).toBe("cancelled");
    expect(cancelled?.group).toBe("attention");
    expect(briefReady?.stage).toBe("brief_ready");
    expect(briefReady?.group).toBe("running");
  });
});
