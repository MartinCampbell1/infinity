import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import { emptyShellExecutionAgentSnapshot } from "../../lib/execution-agent-model";
import { emptyShellExecutionAgentsSnapshot } from "../../lib/execution-agents-shared";
import { emptyShellExecutionHandoffsSnapshot } from "../../lib/execution-handoffs-model";

vi.stubGlobal("React", React);

vi.mock("@/components/shell/shell-screen-primitives", async () => {
  return await vi.importActual("../shell/shell-screen-primitives");
});

vi.mock("@/components/shell/shell-record-primitives", async () => {
  return await vi.importActual("../shell/shell-record-primitives");
});

vi.mock("@/lib/execution-agent-model", async () => {
  return await vi.importActual("../../lib/execution-agent-model");
});

vi.mock("@/lib/execution-agents-shared", async () => {
  return await vi.importActual("../../lib/execution-agents-shared");
});

vi.mock("@/lib/execution-handoffs-model", async () => {
  return await vi.importActual("../../lib/execution-handoffs-model");
});

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
  buildExecutionAgentScopeHref: (agentId: string) => `/execution/agents/${agentId}`,
  buildExecutionEventsScopeHref: () => "/execution/events",
  buildExecutionHandoffScopeHref: (handoffId: string) => `/execution/handoffs/${handoffId}`,
  buildExecutionProjectScopeHref: (projectId: string) => `/execution/projects/${projectId}`,
  buildExecutionReviewScopeHref: () => "/execution/review",
  buildInboxScopeHref: () => "/inbox",
  routeScopeFromProjectRef: (projectId: string) => ({
    projectId,
    intakeSessionId: "",
    sessionId: "",
    groupId: "",
    accountId: "",
    workspaceId: "",
  }),
  withShellRouteScope: (href: string) => href,
}));

vi.mock("@/lib/shell-preferences", () => ({
  getShellPollInterval: () => 6000,
  useShellPreferences: () => ({
    preferences: {
      refreshProfile: "balanced",
      sidebarCollapsed: false,
      reviewMemory: {
        global: { lane: "all", preset: null },
        linked: { lane: "all", preset: null },
        intakeLinked: { lane: "all", preset: null },
        orphanProject: { lane: "all", preset: null },
      },
    },
  }),
}));

vi.mock("@/lib/shell-snapshot-client", () => ({
  fetchShellExecutionAgentSnapshot: vi.fn(),
  fetchShellExecutionAgentsSnapshot: vi.fn(),
  fetchShellExecutionHandoffsSnapshot: vi.fn(),
}));

vi.mock("@/lib/use-shell-manual-refresh", () => ({
  useShellManualRefresh: () => ({
    isRefreshing: false,
    refresh: vi.fn(),
    refreshNonce: 0,
  }),
}));

vi.mock("@/lib/use-shell-polled-snapshot", () => ({
  useShellPolledSnapshot: ({
    emptySnapshot,
    initialSnapshot,
    selectLoadState,
  }: {
    emptySnapshot: unknown;
    initialSnapshot?: unknown | null;
    selectLoadState: (snapshot: never) => "ready" | "error";
  }) => ({
    loadState: initialSnapshot ? selectLoadState(initialSnapshot as never) : "loading",
    snapshot: initialSnapshot ?? emptySnapshot,
  }),
}));

import { ExecutionAgentWorkspace } from "./execution-agent-workspace";
import { ExecutionAgentsWorkspace } from "./execution-agents-workspace";
import { ExecutionHandoffsWorkspace } from "./execution-handoffs-workspace";

describe("execution loading and retry states", () => {
  test("renders skeleton cards for the agents runtime board initial load", () => {
    const markup = renderToStaticMarkup(
      <ExecutionAgentsWorkspace initialSnapshot={null} />
    );

    expect(markup).toContain('data-shell-skeleton-grid="true"');
    expect(markup).toContain('data-shell-skeleton-card="true"');
    expect(markup).toContain("Runtime board");
  });

  test("renders a retry action when the agents runtime board load fails", () => {
    const snapshot = {
      ...emptyShellExecutionAgentsSnapshot(),
      projectsError: "Runtime board unavailable.",
      projectsLoadState: "error" as const,
    };

    const markup = renderToStaticMarkup(
      <ExecutionAgentsWorkspace initialSnapshot={snapshot} />
    );

    expect(markup).toContain('data-shell-retry-button="true"');
    expect(markup).toContain("Retry load");
    expect(markup).toContain("Runtime board unavailable.");
  });

  test("renders skeleton cards for runtime-agent detail initial load", () => {
    const markup = renderToStaticMarkup(
      <ExecutionAgentWorkspace
        runtimeAgentId="agent-loading"
        initialSnapshot={null}
      />
    );

    expect(markup).toContain('data-shell-skeleton-grid="true"');
    expect(markup).toContain("Current runtime");
    expect(markup).toContain("Event timeline");
  });

  test("renders a retry action when runtime-agent detail load fails", () => {
    const snapshot = {
      ...emptyShellExecutionAgentSnapshot(),
      runtimeAgentId: "agent-error",
      agentError: "Runtime-agent detail failed.",
      agentLoadState: "error" as const,
    };

    const markup = renderToStaticMarkup(
      <ExecutionAgentWorkspace
        runtimeAgentId="agent-error"
        initialSnapshot={snapshot}
      />
    );

    expect(markup).toContain('data-shell-retry-button="true"');
    expect(markup).toContain("Retry load");
    expect(markup).toContain("Runtime-agent detail failed.");
  });

  test("renders skeleton cards and retry actions for handoff queue load states", () => {
    const loadingMarkup = renderToStaticMarkup(
      <ExecutionHandoffsWorkspace initialSnapshot={null} />
    );

    expect(loadingMarkup).toContain('data-shell-skeleton-grid="true"');
    expect(loadingMarkup).toContain("Execution queue");

    const errorSnapshot = {
      ...emptyShellExecutionHandoffsSnapshot(),
      handoffsError: "Handoff queue failed.",
      handoffsLoadState: "error" as const,
    };
    const errorMarkup = renderToStaticMarkup(
      <ExecutionHandoffsWorkspace initialSnapshot={errorSnapshot} />
    );

    expect(errorMarkup).toContain('data-shell-retry-button="true"');
    expect(errorMarkup).toContain("Retry load");
    expect(errorMarkup).toContain("Handoff queue failed.");
  });
});
