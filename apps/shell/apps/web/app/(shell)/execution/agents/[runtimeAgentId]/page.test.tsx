import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/route-scope", () => ({
  readShellRouteScopeFromQueryRecord: vi.fn(() => ({
    projectId: "",
    intakeSessionId: "",
    sessionId: "",
    groupId: "",
    accountId: "",
    workspaceId: "",
  })),
}));

vi.mock("@/lib/execution-agent", () => ({
  buildExecutionAgentSnapshot: vi.fn(async (runtimeAgentId: string) => ({
    generatedAt: "2026-04-21T00:00:00.000Z",
    runtimeAgentId,
    agent: {
      runtimeAgentId,
      status: "active",
    },
    agentError: null,
    agentLoadState: "ready",
  })),
}));

vi.mock("@/components/execution/execution-agent-workspace", () => ({
  ExecutionAgentWorkspace: ({
    runtimeAgentId,
    initialSnapshot,
  }: {
    runtimeAgentId: string;
    initialSnapshot: { agentLoadState: string };
  }) => (
    <section data-agent-workspace="true">
      <div>{runtimeAgentId}</div>
      <div>{initialSnapshot.agentLoadState}</div>
    </section>
  ),
}));

import Page from "./page";

describe("agent detail route", () => {
  test("renders the execution agent workspace with the built snapshot", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ runtimeAgentId: "agent-1" }),
      })
    );

    expect(markup).toContain("data-agent-workspace=\"true\"");
    expect(markup).toContain("agent-1");
    expect(markup).toContain("ready");
  });
});
