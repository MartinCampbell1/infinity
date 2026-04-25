import { describe, expect, test, vi } from "vitest";

const snapshotMock = vi.hoisted(() => ({
  buildExecutionAgentsSnapshot: vi.fn(async () => ({
    generatedAt: "2026-04-25T00:00:00.000Z",
    projects: [],
    projectsError: null,
    projectsLoadState: "ready",
    agents: [
      {
        agent_id: "agent-1",
        project_id: "project-atlas",
        provider: "local_shell",
        role: "worker",
        label: "Atlas Agent 1",
        status: "active",
      },
      {
        agent_id: "agent-2",
        project_id: "project-borealis",
        provider: "local_shell",
        role: "worker",
        label: "Borealis Agent 2",
        status: "active",
      },
      {
        agent_id: "agent-3",
        project_id: "project-borealis",
        provider: "codex",
        role: "critic",
        label: "Borealis Critic",
        status: "failed",
      },
    ],
    agentsError: null,
    agentsLoadState: "ready",
    agentsSummary: null,
    agentsSummaryError: null,
    agentsSummaryLoadState: "ready",
    actionRuns: [],
    actionRunsError: null,
    actionRunsLoadState: "ready",
    actionRunsSummary: null,
    actionRunsSummaryError: null,
    actionRunsSummaryLoadState: "ready",
  })),
}));

vi.mock("@/lib/execution-agents", () => ({
  buildExecutionAgentsSnapshot: snapshotMock.buildExecutionAgentsSnapshot,
}));

import { GET as getExecutionAgents } from "./route";

describe("/api/shell/execution/agents", () => {
  test("paginates agents and emits private cache headers", async () => {
    const response = await getExecutionAgents(
      new Request("http://localhost/api/shell/execution/agents?limit=2"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.agents.map((agent: { agent_id: string }) => agent.agent_id)).toEqual([
      "agent-1",
      "agent-2",
    ]);
    expect(body.agentsPageInfo).toEqual(
      expect.objectContaining({
        limit: 2,
        cursor: null,
        hasNextPage: true,
        totalItems: 3,
      }),
    );
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{24}"$/);
  });

  test("filters agents before paginating", async () => {
    const response = await getExecutionAgents(
      new Request(
        "http://localhost/api/shell/execution/agents?project_id=project-borealis&role=critic&provider=codex&q=critic&limit=5",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.agentsFilters).toEqual(
      expect.objectContaining({
        projectId: "project-borealis",
        role: "critic",
        provider: "codex",
        query: "critic",
        limit: 5,
      }),
    );
    expect(body.agentsTotal).toBe(3);
    expect(body.agentsFiltered).toBe(1);
    expect(body.agents.map((agent: { agent_id: string }) => agent.agent_id)).toEqual([
      "agent-3",
    ]);
    expect(body.agentsPageInfo).toEqual(
      expect.objectContaining({
        limit: 5,
        hasNextPage: false,
        totalItems: 1,
      }),
    );
  });
});
