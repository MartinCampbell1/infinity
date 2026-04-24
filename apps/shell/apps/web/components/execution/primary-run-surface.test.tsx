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
  buildExecutionBatchScopeHref: (
    batchId: string,
    _scope: unknown,
    filters?: { initiativeId?: string | null; taskGraphId?: string | null },
  ) => {
    const params = new URLSearchParams();
    if (filters?.initiativeId) {
      params.set("initiative_id", filters.initiativeId);
    }
    if (filters?.taskGraphId) {
      params.set("task_graph_id", filters.taskGraphId);
    }
    const query = params.toString();
    return `/execution/batches/${batchId}${query ? `?${query}` : ""}`;
  },
  buildExecutionContinuityScopeHref: (initiativeId: string) =>
    `/execution/continuity/${initiativeId}`,
  buildExecutionDeliveryScopeHref: (
    deliveryId: string,
    _scope: unknown,
    filters?: { initiativeId?: string | null },
  ) =>
    `/execution/delivery/${deliveryId}${
      filters?.initiativeId ? `?initiative_id=${filters.initiativeId}` : ""
    }`,
  buildExecutionWorkspaceScopeHref: (sessionId?: string | null) =>
    `/execution/workspace/${sessionId ?? ""}`,
  buildExecutionTaskGraphScopeHref: (
    taskGraphId: string,
    _scope: unknown,
    filters?: { initiativeId?: string | null },
  ) =>
    `/execution/task-graphs/${taskGraphId}${
      filters?.initiativeId ? `?initiative_id=${filters.initiativeId}` : ""
    }`,
  routeScopeFromExecutionBindingRef: (
    bindings?: {
      sessionId?: string | null;
      groupId?: string | null;
      accountId?: string | null;
      workspaceId?: string | null;
    } | null,
  ) => ({
    projectId: "",
    intakeSessionId: "",
    sessionId: bindings?.sessionId ?? "",
    groupId: bindings?.groupId ?? "",
    accountId: bindings?.accountId ?? "",
    workspaceId: bindings?.workspaceId ?? "",
  }),
  withShellRouteScope: (href: string) => href,
}));

vi.mock("@/components/execution/plane-run-primitives", () => ({
  PlaneButton: ({
    children,
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
  }) => <button type="button">{children}</button>,
  PlaneProgressBar: () => <div data-progress-bar="true" />,
  PlaneStatusPill: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/components/execution/operator-action-controls", () => ({
  RecoveryActionStrip: () => <div data-recovery-actions="true" />,
}));

vi.mock("@/lib/server/orchestration/claude-design-presentation", () => ({
  getClaudeDisplayRunId: (value?: string | null) => value ?? "unknown",
}));

import { PrimaryRunSurface } from "./primary-run-surface";

const now = "2026-04-24T00:00:00.000Z";

describe("PrimaryRunSurface", () => {
  test("renders inspectable task graph, microtask attempts, evidence, and failures", () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;

    const markup = renderToStaticMarkup(
      <PrimaryRunSurface
        routeScope={{
          projectId: "",
          intakeSessionId: "",
          sessionId: "session-1",
          groupId: "",
          accountId: "",
          workspaceId: "",
        }}
        initiative={{
          id: "initiative-1",
          title: "Tiny calculator",
          userRequest: "Build a tiny calculator.",
          status: "running",
          requestedBy: "martin",
          workspaceSessionId: "session-1",
          priority: "high",
          createdAt: now,
          updatedAt: now,
        }}
        currentRun={{
          id: "run-1",
          initiativeId: "initiative-1",
          title: "Tiny calculator",
          originalPrompt: "Build a tiny calculator.",
          entryMode: "shell_chat",
          currentStage: "executing",
          health: "healthy",
          automationMode: "autonomous",
          manualStageProgression: false,
          operatorOverrideActive: false,
          previewStatus: "ready",
          handoffStatus: "ready",
          createdAt: now,
          updatedAt: now,
        }}
        currentTaskGraph={{
          id: "task-graph-1",
          initiativeId: "initiative-1",
          briefId: "brief-1",
          version: 1,
          nodeIds: ["work-unit-1", "work-unit-2"],
          edges: [],
          status: "active",
          createdAt: now,
          updatedAt: now,
        }}
        currentBatch={{
          id: "batch-1",
          initiativeId: "initiative-1",
          taskGraphId: "task-graph-1",
          workUnitIds: ["work-unit-1", "work-unit-2"],
          concurrencyLimit: 2,
          status: "running",
          startedAt: now,
          finishedAt: null,
        }}
        currentDelivery={{
          id: "delivery-1",
          initiativeId: "initiative-1",
          verificationRunId: "verification-1",
          resultSummary: "Runnable calculator delivery.",
          status: "ready",
          localOutputPath: "/tmp/delivery/result",
          command: "npm run preview",
          launchProofKind: "runnable_result",
          launchProofUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-1",
          previewUrl: "/api/control/orchestration/previews/preview-1",
          launchManifestPath: "/tmp/delivery/launch-manifest.json",
          launchTargetLabel: "Local preview",
          deliveredAt: now,
        }}
        currentPreviewTarget={null}
        latestRunEvent={null}
        currentHandoffPacket={null}
        plannerNotes={[]}
        workUnits={[
          {
            id: "work-unit-1",
            taskGraphId: "task-graph-1",
            title: "Wire calculator UI",
            description: "Build the calculator inputs and output.",
            executorType: "codex",
            scopePaths: ["apps/shell/apps/web/app/calculator/page.tsx"],
            dependencies: [],
            acceptanceCriteria: ["Bill and tip inputs update the visible total"],
            estimatedComplexity: "small",
            status: "completed",
            latestAttemptId: "attempt-1",
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "work-unit-2",
            taskGraphId: "task-graph-1",
            title: "Validate calculator",
            description: "Run the calculator smoke proof.",
            executorType: "droid",
            scopePaths: ["apps/shell/apps/web/app/calculator"],
            dependencies: ["work-unit-1"],
            acceptanceCriteria: ["Smoke proof fails visibly when preview is broken"],
            estimatedComplexity: "small",
            status: "failed",
            latestAttemptId: "attempt-2",
            createdAt: now,
            updatedAt: now,
          },
        ]}
        currentAssembly={{
          id: "assembly-1",
          initiativeId: "initiative-1",
          taskGraphId: "task-graph-1",
          inputWorkUnitIds: ["work-unit-1", "work-unit-2"],
          artifactUris: [
            "file:///tmp/assembly/work-units/attempt-1.json",
            "file:///tmp/assembly/work-units/attempt-2.json",
          ],
          outputLocation: "/tmp/assembly",
          manifestPath: "/tmp/assembly/assembly-manifest.json",
          summary: "Assembly with two work-unit evidence files.",
          status: "assembled",
          createdAt: now,
          updatedAt: now,
        }}
        agentSessions={[
          {
            id: "agent-session-1",
            runId: "run-1",
            batchId: "batch-1",
            workItemId: "work-unit-1",
            attemptId: "attempt-1",
            agentKind: "worker",
            status: "completed",
            runtimeRef: "attempt-1",
            startedAt: now,
            finishedAt: now,
          },
          {
            id: "agent-session-2",
            runId: "run-1",
            batchId: "batch-1",
            workItemId: "work-unit-2",
            attemptId: "attempt-2",
            agentKind: "worker",
            status: "failed",
            runtimeRef: "attempt-2",
            startedAt: now,
            finishedAt: now,
          },
        ]}
        refusals={[
          {
            id: "refusal-1",
            runId: "run-1",
            workItemId: "work-unit-2",
            agentSessionId: "agent-session-2",
            reason: "Preview smoke proof failed on missing output total.",
            severity: "medium",
            createdAt: now,
          },
        ]}
        recoveryIncidents={[]}
        approvalRequests={[]}
        workspaceHostContext={{
          projectId: "project-1",
          projectName: "Tiny calculator",
          sessionId: "session-1",
          openedFrom: "execution_board",
        }}
      />,
    );

    expect(markup).toContain("Open brief");
    expect(markup).toContain("brief_id=brief-1");
    expect(markup).toContain("Open task graph");
    expect(markup).toContain("/execution/task-graphs/task-graph-1");
    expect(markup).toContain("Open batch");
    expect(markup).toContain("/execution/batches/batch-1");
    expect(markup).toContain("Open delivery");
    expect(markup).toContain("/execution/delivery/delivery-1");

    expect(markup).toContain('data-task-board-layout="scan-list"');
    expect(markup).toContain("Task t01");
    expect(markup).not.toContain("Work unit work-unit-1");
    expect(markup).toContain("apps/shell/apps/web/app/calculator/page.tsx");
    expect(markup).toContain("Bill and tip inputs update the visible total");
    expect(markup).toContain("Executor codex");
    expect(markup).toContain("Attempts 1");
    expect(markup).toContain("attempt-1");
    expect(markup).toContain("Evidence attempt-1.json");

    expect(markup).toContain("Task t02");
    expect(markup).not.toContain("Work unit work-unit-2");
    expect(markup).toContain("Executor droid");
    expect(markup).toContain("Failure Preview smoke proof failed on missing output total.");
  });
});
