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
    projectId: "project-atlas",
    intakeSessionId: "intake-1",
    sessionId: "",
    groupId: "",
    accountId: "",
    workspaceId: "",
  })),
  routeScopeFromProjectRef: vi.fn((projectId: string) => ({
    projectId,
    intakeSessionId: "intake-1",
    sessionId: "",
    groupId: "",
    accountId: "",
    workspaceId: "",
  })),
  buildExecutionEventsScopeHref: vi.fn(() => "/execution/events"),
  buildExecutionSessionsScopeHref: vi.fn(() => "/execution/sessions"),
  buildExecutionWorkspaceScopeHref: vi.fn((sessionId: string) => `/execution/workspace/${sessionId}`),
}));

vi.mock("@/lib/server/control-plane/sessions", () => ({
  getExecutionSessionSummaries: vi.fn(async () => [
    {
      id: "session-1",
      projectId: "project-atlas",
      title: "Atlas workspace run",
      status: "acting",
      provider: "codex",
      projectName: "Atlas",
    },
    {
      id: "session-2",
      projectId: "project-atlas",
      title: "Atlas retry run",
      status: "blocked",
      provider: "codex",
      projectName: "Atlas",
    },
  ]),
  getExecutionSessionEvents: vi.fn(async () => [
    {
      id: "event-1",
      projectId: "project-atlas",
      summary: "Delivery proof attached",
      kind: "delivery.ready",
      timestamp: "2026-04-20T01:10:00.000Z",
    },
  ]),
}));

import Page from "./page";

describe("project detail route", () => {
  test("renders the dark shell project detail", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ projectId: "project-atlas" }),
      })
    );

    expect(markup).toContain("Project execution");
    expect(markup).toContain("Atlas workspace run");
    expect(markup).toContain("Atlas retry run");
    expect(markup).toContain("Delivery proof attached");
    expect(markup).toContain("Open workspace");
    expect(markup).toContain("Open sessions");
    expect(markup).toContain("Open scoped events");
  });
});
