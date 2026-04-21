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
  readShellRouteScopeFromQueryRecord: vi.fn(() => ({
    projectId: "",
    intakeSessionId: "",
    sessionId: "",
    groupId: "",
    accountId: "",
    workspaceId: "",
  })),
  buildExecutionContinuityScopeHref: vi.fn((initiativeId: string) => `/execution/continuity/${initiativeId}`),
  buildExecutionTaskGraphScopeHref: vi.fn((taskGraphId: string) => `/execution/task-graphs/${taskGraphId}`),
}));

vi.mock("@/lib/server/control-plane/state/store", () => ({
  readControlPlaneState: vi.fn(async () => ({
    orchestration: {
      agentSessions: [
        {
          id: "agent-1",
          runId: "run-1",
          batchId: "batch-1",
          workItemId: "work-unit-1",
          attemptId: "attempt-1",
          status: "running",
          runtimeRef: "codex-worker-1",
        },
      ],
      runs: [
        {
          id: "run-1",
          initiativeId: "initiative-1",
          title: "Atlas execution run",
        },
      ],
      batches: [
        {
          id: "batch-1",
          taskGraphId: "graph-1",
        },
      ],
      taskGraphs: [
        {
          id: "graph-1",
          initiativeId: "initiative-1",
        },
      ],
      workUnits: [
        {
          id: "work-unit-1",
          title: "Ship localhost delivery",
        },
      ],
      refusals: [
        {
          id: "refusal-1",
          agentSessionId: "agent-1",
          reason: "Need elevated permission to continue.",
          severity: "medium",
        },
      ],
    },
  })),
}));

import Page from "./page";

describe("agent detail route", () => {
  test("renders the dark shell agent detail", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ runtimeAgentId: "agent-1" }),
      })
    );

    expect(markup).toContain("Agent Session");
    expect(markup).toContain("agent-1");
    expect(markup).toContain("Atlas execution run");
    expect(markup).toContain("Ship localhost delivery");
    expect(markup).toContain("Need elevated permission to continue.");
    expect(markup).toContain("Open continuity");
    expect(markup).toContain("Open task graph");
  });
});
