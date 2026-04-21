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

vi.mock("@/lib/route-scope", () => ({
  readShellRouteScopeFromQueryRecord: vi.fn(() => undefined),
  normalizeShellRouteScope: vi.fn((scope?: {
    projectId?: string;
    intakeSessionId?: string;
    sessionId?: string;
    groupId?: string;
    accountId?: string;
    workspaceId?: string;
  }) => ({
    projectId: scope?.projectId ?? "",
    intakeSessionId: scope?.intakeSessionId ?? "",
    sessionId: scope?.sessionId ?? "",
    groupId: scope?.groupId ?? "",
    accountId: scope?.accountId ?? "",
    workspaceId: scope?.workspaceId ?? "",
  })),
}));

vi.mock("@/components/execution/primary-run-surface", () => ({
  PrimaryRunSurface: ({
    initiative,
    workUnits,
    agentSessions,
    recoveryIncidents,
    approvalRequests,
    workspaceHostContext,
    currentPreviewTarget,
    plannerNotes,
  }: {
    initiative: { title: string };
    workUnits: Array<{ title: string }>;
    agentSessions: Array<{ id: string }>;
    recoveryIncidents: Array<{ id: string }>;
    approvalRequests: Array<{ id: string }>;
    workspaceHostContext: { accountLabel?: string | null; executionMode?: string | null } | null;
    currentPreviewTarget: { url?: string | null } | null;
    plannerNotes: string[];
  }) => (
    <section data-run-surface="true">
      <h1>{initiative.title}</h1>
      <div>{workUnits[0]?.title ?? "No work units"}</div>
      <div>{agentSessions.length} agents</div>
      <div>{recoveryIncidents.length} recoveries</div>
      <div>{approvalRequests.length} approvals</div>
      <div>{workspaceHostContext?.accountLabel ?? "No workspace context"}</div>
      <div>{workspaceHostContext?.executionMode ?? "No execution mode"}</div>
      <div>{currentPreviewTarget?.url ?? "No preview"}</div>
      <div>{plannerNotes[0] ?? "No planner notes"}</div>
    </section>
  ),
}));

vi.mock("../../../../../lib/server/control-plane/workspace/mock", () => ({
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
  listDeliveries: vi.fn(async () => [
    {
      id: "delivery-1",
      initiativeId: "initiative-1",
      status: "ready",
      artifactPath: "/tmp/delivery-1",
      localOutputPath: "http://127.0.0.1:4010",
      command: "npm run preview",
      deliveredAt: "2026-04-19T01:30:00.000Z",
      createdAt: "2026-04-19T01:20:00.000Z",
      updatedAt: "2026-04-19T01:30:00.000Z",
    },
  ]),
}));

vi.mock("@/lib/server/control-plane/approvals/mock", () => ({
  listApprovalRequests: vi.fn(async () => [
    {
      id: "approval-1",
      sessionId: "session-1",
      projectId: "project-1",
      projectName: "Atlas launch control plane",
      requestKind: "tool_call",
      title: "Approve deploy",
      summary: "Allow a deployment step",
      status: "pending",
      requestedAt: "2026-04-19T01:21:00.000Z",
      updatedAt: "2026-04-19T01:21:00.000Z",
      revision: 1,
    },
  ]),
}));

vi.mock("@/lib/server/control-plane/recoveries/mock", () => ({
  listRecoveryIncidents: vi.fn(async () => [
    {
      id: "recovery-1",
      sessionId: "session-1",
      projectId: "project-1",
      projectName: "Atlas launch control plane",
      status: "retryable",
      severity: "medium",
      recoveryActionKind: "retry",
      summary: "Retry preview build",
      retryCount: 1,
      openedAt: "2026-04-19T01:22:00.000Z",
      lastObservedAt: "2026-04-19T01:23:00.000Z",
      updatedAt: "2026-04-19T01:23:00.000Z",
      revision: 1,
    },
  ]),
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
      previewTargets: [
        {
          id: "preview-1",
          runId: "run-1",
          deliveryId: "delivery-1",
          mode: "local",
          url: "http://127.0.0.1:4010",
          healthStatus: "ready",
          launchCommand: "npm run preview",
          sourcePath: "/tmp/delivery-1",
          createdAt: "2026-04-19T01:25:00.000Z",
          updatedAt: "2026-04-19T01:30:00.000Z",
        },
      ],
      handoffPackets: [
        {
          id: "handoff-1",
          runId: "run-1",
          deliveryId: "delivery-1",
          status: "ready",
          rootPath: "/tmp/handoff-1",
          finalSummaryPath: "/tmp/handoff-1/summary.md",
          manifestPath: "/tmp/handoff-1/manifest.json",
          createdAt: "2026-04-19T01:27:00.000Z",
          updatedAt: "2026-04-19T01:31:00.000Z",
        },
      ],
      runEvents: [],
      agentSessions: [
        {
          id: "agent-1",
          runId: "run-1",
          batchId: "batch-1",
          workItemId: "work-unit-1",
          agentKind: "worker",
          status: "running",
          runtimeRef: "codex://agent-1",
          startedAt: "2026-04-19T01:08:00.000Z",
          finishedAt: null,
        },
      ],
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
    notes: ["critical path depth: 3"],
  })),
}));

import { readWorkspaceLaunchSessionContext } from "../../../../../lib/server/control-plane/workspace/mock";
import { readShellRouteScopeFromQueryRecord } from "@/lib/route-scope";
import { listOrchestrationInitiatives } from "@/lib/server/orchestration/initiatives";
import Page from "./page";

describe("primary run route", () => {
  test("renders the primary run surface with task, agent, recovery, and result state", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ initiativeId: "initiative-1" }),
      })
    );

    expect(markup).toContain("Atlas launch control plane");
    expect(markup).toContain("Ship the root frontdoor");
    expect(markup).toContain("1 agents");
    expect(markup).toContain("1 recoveries");
    expect(markup).toContain("1 approvals");
    expect(markup).toContain("Oracle Ops");
    expect(markup).toContain("cloud");
    expect(markup).toContain("http://127.0.0.1:4010");
    expect(markup).toContain("critical path depth: 3");
    expect(readWorkspaceLaunchSessionContext).toHaveBeenCalledWith(
      "session-1",
      undefined
    );
  });

  test("ignores stale route scope session ids when the initiative has no linked workspace session", async () => {
    vi.mocked(readShellRouteScopeFromQueryRecord).mockReturnValueOnce({
      projectId: "project-atlas",
      intakeSessionId: "intake-007",
      sessionId: "session-stale",
      groupId: "group-stale",
      accountId: "account-stale",
      workspaceId: "workspace-stale",
    });
    vi.mocked(listOrchestrationInitiatives).mockResolvedValueOnce([
      {
        id: "initiative-2",
        title: "Unlinked run",
        userRequest: "Show primary run route without linking a stale workspace session.",
        status: "running",
        requestedBy: "martin",
        workspaceSessionId: null,
        priority: "high",
        createdAt: "2026-04-19T02:00:00.000Z",
        updatedAt: "2026-04-19T02:10:00.000Z",
      },
    ]);

    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ initiativeId: "initiative-2" }),
      })
    );

    expect(markup).toContain("Unlinked run");
    expect(markup).toContain("No workspace context");
    expect(markup).toContain("0 recoveries");
    expect(markup).toContain("0 approvals");
    expect(readWorkspaceLaunchSessionContext).not.toHaveBeenCalledWith(
      "session-stale",
      expect.anything()
    );
  });
});
