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

vi.mock("@/components/orchestration/task-graph-board", () => ({
  TaskGraphBoard: ({
    detail,
  }: {
    detail: { taskGraph: { id: string }; notes: string[] };
  }) => (
    <section data-task-graph-board="true">
      <h1>{detail.taskGraph.id}</h1>
      <div>{detail.notes[0] ?? "No notes"}</div>
    </section>
  ),
}));

vi.mock("@/lib/server/orchestration/task-graphs", () => ({
  buildTaskGraphDetailResponse: vi.fn(async (taskGraphId: string) => ({
    taskGraph: {
      id: taskGraphId,
    },
    initiative: null,
    brief: null,
    workUnits: [],
    runnableWorkUnitIds: [],
    notes: [
      "critical path depth: 5",
      "critical path focus: A -> B -> C",
      "concurrency groups: 6",
      "risk flags: runtime kernel dependency",
    ],
  })),
}));

import Page from "./page";

describe("task-graph page route", () => {
  test("server-renders the task graph board with planner notes", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ taskGraphId: "graph-123" }),
      })
    );

    expect(markup).toContain("graph-123");
    expect(markup).toContain("critical path depth: 5");
    expect(markup).not.toContain("Loading task graph");
  });
});
