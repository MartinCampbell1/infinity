import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/shell/plane-work-items-shell", () => ({
  PlaneWorkItemsShell: ({ children }: { children: React.ReactNode }) => (
    <div data-shell-frame="true">{children}</div>
  ),
}));

vi.mock("@/lib/route-scope", () => ({
  readShellRouteScopeFromQueryRecord: vi.fn(() => undefined),
}));

vi.mock("@/components/work-items/plane-work-items-surface", () => ({
  PlaneWorkItemsSurface: ({
    currentInitiative,
    workUnits,
    workspaceHostContext,
  }: {
    currentInitiative: { title: string } | null;
    workUnits: Array<{ title: string }>;
    workspaceHostContext: { accountLabel?: string | null; executionMode?: string | null } | null;
  }) => (
    <section data-work-items="true">
      <h1>Work items</h1>
      <p>{currentInitiative?.title ?? "No initiative"}</p>
      <div>{workUnits[0]?.title ?? "No work units"}</div>
      <div>{workspaceHostContext?.accountLabel ?? "No workspace context"}</div>
      <div>{workspaceHostContext?.executionMode ?? "No execution mode"}</div>
    </section>
  ),
}));

vi.mock("../../lib/server/control-plane/workspace/mock", () => ({
  readWorkspaceLaunchSessionContext: vi.fn(async () => ({
    projectId: "project-1",
    projectName: "Atlas launch control plane",
    sessionId: "session-1",
    sessionTitle: "Atlas workspace",
    externalSessionId: "external-session-1",
    groupId: "group-1",
    accountId: "account-oracle",
    accountLabel: "Oracle Ops",
    workspaceId: "workspace-1",
    provider: "openwebui",
    model: "gpt-4.1",
    executionMode: "cloud",
    quotaState: {
      pressure: "high",
      usedPercent: 83,
      resetsAt: null,
    },
    pendingApprovals: 2,
    openedFrom: "execution_board",
    status: "acting",
    phase: "acting",
  })),
}));

vi.mock("@/lib/server/orchestration/initiatives", () => ({
  listOrchestrationInitiatives: vi.fn(async () => [
    {
      id: "initiative-1",
      title: "Atlas launch control plane",
      userRequest: "Build the Atlas launch frontdoor.",
      status: "running",
      requestedBy: "martin",
      workspaceSessionId: "session-1",
      priority: "high",
      createdAt: "2026-04-19T01:00:00.000Z",
      updatedAt: "2026-04-19T01:10:00.000Z",
    },
  ]),
}));

vi.mock("@/lib/server/orchestration/batches", () => ({
  listExecutionBatches: vi.fn(async () => [
    {
      id: "batch-1",
      initiativeId: "initiative-1",
      taskGraphId: "graph-1",
      workUnitIds: ["work-unit-1"],
      concurrencyLimit: 1,
      status: "running",
      startedAt: "2026-04-19T01:06:00.000Z",
      finishedAt: null,
    },
  ]),
}));

vi.mock("@/lib/server/orchestration/delivery", () => ({
  listDeliveries: vi.fn(async () => []),
}));

vi.mock("@/lib/server/control-plane/state/store", () => ({
  readControlPlaneState: vi.fn(async () => ({
    orchestration: {
      runs: [
        {
          id: "run-1",
          initiativeId: "initiative-1",
          title: "Atlas launch control plane",
          originalPrompt: "Build the Atlas launch frontdoor.",
          entryMode: "shell_chat",
          currentStage: "executing",
          health: "healthy",
          automationMode: "autonomous",
          manualStageProgression: false,
          operatorOverrideActive: false,
          previewStatus: "ready",
          handoffStatus: "ready",
          createdAt: "2026-04-19T01:00:00.000Z",
          updatedAt: "2026-04-19T01:12:00.000Z",
          completedAt: null,
        },
      ],
      taskGraphs: [],
      previewTargets: [],
      handoffPackets: [],
      agentSessions: [],
    },
  })),
}));

vi.mock("@/lib/server/orchestration/task-graphs", () => ({
  buildTaskGraphDetailResponse: vi.fn(async () => ({
    taskGraph: {
      id: "graph-1",
      initiativeId: "initiative-1",
      briefId: "brief-1",
      version: 1,
      nodeIds: ["work-unit-1"],
      edges: [],
      status: "active",
      createdAt: "2026-04-19T01:02:00.000Z",
      updatedAt: "2026-04-19T01:10:00.000Z",
    },
    initiative: null,
    brief: null,
    workUnits: [
      {
        id: "work-unit-1",
        taskGraphId: "graph-1",
        title: "Ship the root frontdoor",
        description: "Replace the redirect with a unified shell frontdoor.",
        executorType: "codex",
        scopePaths: ["apps/shell/apps/web/app/page.tsx"],
        dependencies: [],
        acceptanceCriteria: ["Root renders the frontdoor"],
        estimatedComplexity: "small",
        status: "running",
        latestAttemptId: "attempt-1",
        createdAt: "2026-04-19T01:03:00.000Z",
        updatedAt: "2026-04-19T01:09:00.000Z",
      },
    ],
    runnableWorkUnitIds: ["work-unit-1"],
    integrationState: "mock",
    storage: "mock",
    source: "derived",
    generatedAt: "2026-04-19T01:10:00.000Z",
    notes: [],
  })),
}));

import { readWorkspaceLaunchSessionContext } from "../../lib/server/control-plane/workspace/mock";
import Page from "./page";

describe("work-items route", () => {
  test("renders the dedicated Plane work-items route", async () => {
    const markup = renderToStaticMarkup(await Page({}));

    expect(markup).toContain("Work items");
    expect(markup).toContain("Atlas launch control plane");
    expect(markup).toContain("Ship the root frontdoor");
    expect(markup).toContain("Oracle Ops");
    expect(markup).toContain("cloud");
    expect(readWorkspaceLaunchSessionContext).toHaveBeenCalledWith(
      "session-1",
      undefined
    );
  });
});
