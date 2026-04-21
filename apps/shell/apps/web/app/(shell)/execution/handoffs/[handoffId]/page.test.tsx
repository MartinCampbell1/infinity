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
  buildExecutionHandoffsScopeHref: vi.fn(() => "/execution/handoffs"),
}));

vi.mock("@/lib/execution-brief-handoffs", () => ({
  getExecutionBriefHandoff: vi.fn(() => ({
    id: "handoff-1",
    source_plane: "discovery",
    source_session_id: "session-smoke",
    brief_kind: "quorum_execution_brief",
    brief: {
      title: "Atlas handoff",
      summary: "Ship the Atlas launch flow.",
      open_questions: ["Which preset?"],
      constraints: ["Stay localhost-first"],
      acceptance_criteria: ["Project can be created from handoff"],
      tags: ["atlas", "launch"],
    },
    default_project_name: "Atlas",
    recommended_launch_preset_id: "team",
    launch_intent: "create",
    created_at: "2026-04-20T01:00:00.000Z",
    expires_at: "2026-04-20T01:30:00.000Z",
  })),
}));

vi.mock("@/components/execution/execution-handoff-action-panel", () => ({
  ExecutionHandoffActionPanel: ({
    title,
  }: {
    title: string;
  }) => <div data-handoff-action-panel="true">{title}</div>,
}));

import Page from "./page";

describe("handoff detail route", () => {
  test("renders the execution brief detail and embeds the action panel", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ handoffId: "handoff-1" }),
      })
    );

    expect(markup).toContain("Atlas handoff");
    expect(markup).toContain("Ship the Atlas launch flow.");
    expect(markup).toContain("quorum_execution_brief");
    expect(markup).toContain("Project can be created from handoff");
    expect(markup).toContain("data-handoff-action-panel=\"true\"");
    expect(markup).toContain("/execution/handoffs");
  });
});
