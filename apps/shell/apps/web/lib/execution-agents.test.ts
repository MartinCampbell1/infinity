import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/upstream", () => ({
  formatUpstreamErrorMessage: (label: string, error: unknown) =>
    `${label}: ${error instanceof Error ? error.message : "request failed"}`,
  requestUpstreamJson: vi.fn(),
}));

vi.mock("@/lib/server/control-plane/state/store", () => ({
  readControlPlaneState: vi.fn(),
}));

import { requestUpstreamJson } from "@/lib/upstream";
import { readControlPlaneState } from "@/lib/server/control-plane/state/store";
import { buildExecutionAgentsSnapshot } from "./execution-agents";

const now = "2026-04-24T03:00:00.000Z";

describe("buildExecutionAgentsSnapshot", () => {
  beforeEach(() => {
    vi.mocked(requestUpstreamJson).mockReset();
    vi.mocked(readControlPlaneState).mockReset();
  });

  test("falls back to local shell runtime agents when upstream runtime APIs are offline", async () => {
    vi.mocked(requestUpstreamJson).mockRejectedValue(new Error("fetch failed"));
    vi.mocked(readControlPlaneState).mockResolvedValue({
      orchestration: {
        initiatives: [
          {
            id: "initiative-local",
            title: "Local tasker",
            userRequest: "Build a local tasker.",
            status: "running",
            requestedBy: "martin",
            workspaceSessionId: "session-local",
            priority: "high",
            createdAt: now,
            updatedAt: now,
          },
        ],
        runs: [
          {
            id: "run-local",
            initiativeId: "initiative-local",
            title: "Local tasker",
            originalPrompt: "Build a local tasker.",
            entryMode: "shell_chat",
            currentStage: "running",
            health: "healthy",
            automationMode: "autonomous",
            manualStageProgression: false,
            operatorOverrideActive: false,
            previewStatus: "building",
            handoffStatus: "building",
            createdAt: now,
            updatedAt: now,
          },
        ],
        taskGraphs: [
          {
            id: "task-graph-local",
            initiativeId: "initiative-local",
            briefId: "brief-local",
            version: 1,
            nodeIds: ["work-unit-local"],
            edges: [],
            status: "active",
            createdAt: now,
            updatedAt: now,
          },
        ],
        workUnits: [
          {
            id: "work-unit-local",
            taskGraphId: "task-graph-local",
            title: "Implement todo list",
            description: "Create a simple task list.",
            executorType: "codex",
            scopePaths: ["apps/shell"],
            dependencies: [],
            acceptanceCriteria: ["Todo list can add and complete items"],
            status: "running",
            latestAttemptId: "attempt-local",
            createdAt: now,
            updatedAt: now,
          },
        ],
        batches: [
          {
            id: "batch-local",
            initiativeId: "initiative-local",
            taskGraphId: "task-graph-local",
            workUnitIds: ["work-unit-local"],
            concurrencyLimit: 1,
            status: "running",
            startedAt: now,
            finishedAt: null,
          },
        ],
        agentSessions: [
          {
            id: "agent-session-local",
            runId: "run-local",
            batchId: "batch-local",
            workItemId: "work-unit-local",
            attemptId: "attempt-local",
            agentKind: "worker",
            status: "running",
            runtimeRef: "codex://agent-session-local",
            startedAt: now,
            finishedAt: null,
          },
        ],
      },
    } as never);

    const snapshot = await buildExecutionAgentsSnapshot();

    expect(snapshot.projectsLoadState).toBe("ready");
    expect(snapshot.agentsLoadState).toBe("ready");
    expect(snapshot.actionRunsLoadState).toBe("ready");
    expect(snapshot.projectsError).toBeNull();
    expect(snapshot.agentsError).toBeNull();
    expect(snapshot.actionRunsError).toBeNull();
    expect(snapshot.projects).toHaveLength(1);
    expect(snapshot.projects[0]?.name).toBe("Local tasker");
    expect(snapshot.agents).toHaveLength(1);
    expect(snapshot.agents[0]?.label).toContain("Implement todo list");
    expect(snapshot.agentsSummary?.totals.active).toBe(1);
    expect(snapshot.actionRuns).toHaveLength(1);
    expect(snapshot.actionRuns[0]?.runtime_agent_ids).toEqual([
      "agent-session-local",
    ]);
  });
});
