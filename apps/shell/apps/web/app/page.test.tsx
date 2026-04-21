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
  readShellRouteScopeFromQueryRecord: vi.fn((params?: Record<string, string | string[] | undefined>) => ({
    projectId: typeof params?.project_id === "string" ? params.project_id : "",
    intakeSessionId: typeof params?.intake_session_id === "string" ? params.intake_session_id : "",
    sessionId: typeof params?.session_id === "string" ? params.session_id : "",
    groupId: typeof params?.group_id === "string" ? params.group_id : "",
    accountId: typeof params?.account_id === "string" ? params.account_id : "",
    workspaceId: typeof params?.workspace_id === "string" ? params.workspace_id : "",
  })),
}));

vi.mock("@/components/shell/plane-ai-shell", () => ({
  PlaneAiShell: ({ children }: { children: React.ReactNode }) => (
    <div data-shell-frame="true">{children}</div>
  ),
}));

vi.mock("@/components/frontdoor/plane-ai-home-surface", () => ({
  PlaneAiHomeSurface: ({
    leadSession,
    routeScope,
    kernelAvailability,
  }: {
    leadSession: { id: string; title: string } | null;
    routeScope?: { projectId?: string; intakeSessionId?: string };
    kernelAvailability: { available: boolean; baseUrl: string };
  }) => (
    <section data-frontdoor="root-ai">
      <h1>One prompt. Same shell.</h1>
      <p>{leadSession?.title ?? "No session"}</p>
      <div>{leadSession?.id ?? "No session id"}</div>
      <div>{routeScope?.projectId ?? "No project scope"}</div>
      <div>{routeScope?.intakeSessionId ?? "No intake scope"}</div>
      <div>{kernelAvailability.available ? "kernel-ready" : "kernel-offline"}</div>
      <div>{kernelAvailability.baseUrl}</div>
      <div>Open work items</div>
    </section>
  ),
}));

vi.mock("@/lib/server/control-plane/sessions", () => ({
  getExecutionSessionSummaries: vi.fn(async () => [
    {
      id: "session-archived",
      projectId: "project-old",
      projectName: "Old Launch",
      provider: "codex",
      title: "Completed archive",
      status: "completed",
      phase: "completed",
      tags: ["archive"],
      pinned: false,
      archived: true,
      createdAt: "2026-04-19T01:00:00.000Z",
      updatedAt: "2026-04-19T01:10:00.000Z",
      pendingApprovals: 0,
      toolActivityCount: 0,
      retryCount: 0,
      recoveryState: "none",
      quotaPressure: "low",
      unreadOperatorSignals: 0,
    },
    {
      id: "session-acting",
      projectId: "project-atlas",
      projectName: "Atlas Launch",
      provider: "codex",
      title: "Atlas launch batch",
      status: "acting",
      phase: "acting",
      tags: ["launch"],
      pinned: false,
      archived: false,
      createdAt: "2026-04-19T01:20:00.000Z",
      updatedAt: "2026-04-19T01:30:00.000Z",
      pendingApprovals: 1,
      toolActivityCount: 3,
      retryCount: 0,
      recoveryState: "none",
      quotaPressure: "medium",
      unreadOperatorSignals: 1,
    },
  ]),
}));

vi.mock("@/lib/server/orchestration/batches", () => ({
  getExecutionKernelAvailability: vi.fn(async () => ({
    available: false,
    baseUrl: "http://127.0.0.1:8787",
    detail:
      "Kernel is offline at http://127.0.0.1:8787. Start ./services/execution-kernel/scripts/run-local.sh before launching autonomous runs.",
    generatedAt: null,
  })),
}));

import Page from "./page";

describe("shell root entry", () => {
  test("renders the shell-backed Plane AI root with live-first session and preserved route scope", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({
          project_id: "project-atlas",
          intake_session_id: "intake-007",
        }),
      })
    );

    expect(markup).toContain("One prompt. Same shell.");
    expect(markup).toContain("Atlas launch batch");
    expect(markup).toContain("session-acting");
    expect(markup).toContain("project-atlas");
    expect(markup).toContain("intake-007");
    expect(markup).toContain("kernel-offline");
    expect(markup).toContain("http://127.0.0.1:8787");
    expect(markup).toContain("Open work items");
    expect(markup).not.toContain("Live work board");
  });
});
