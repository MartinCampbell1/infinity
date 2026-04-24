import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import type { ApprovalRequestsDirectory } from "@/lib/server/control-plane/contracts/approvals";

vi.stubGlobal("React", React);

vi.mock("@/lib/route-scope", () => ({
  buildExecutionAccountsScopeHref: () => "/execution/accounts",
  buildExecutionRecoveriesScopeHref: () => "/execution/recoveries",
  buildExecutionSessionsScopeHref: () => "/execution/sessions",
  buildExecutionWorkspaceScopeHref: (sessionId: string) =>
    `/execution/workspace/${sessionId}`,
  routeScopeFromExecutionBindingRef: () => ({}),
}));

vi.mock("./operator-action-controls", () => ({
  ApprovalActionStrip: ({ approvalId }: { approvalId: string }) => (
    <div data-approval-actions={approvalId} />
  ),
  RecoveryActionStrip: () => <div data-recovery-actions="true" />,
}));

import { ExecutionApprovalsDirectorySurface } from "./control-plane-directory-surfaces";

describe("ExecutionApprovalsDirectorySurface", () => {
  test("renders an explicit empty queue state when no approvals match the current scope", () => {
    const directory: ApprovalRequestsDirectory = {
      generatedAt: "2026-04-24T00:00:00.000Z",
      source: "derived",
      storageKind: "file_backed",
      integrationState: "wired",
      canonicalTruth: "sessionId",
      notes: ["State persistence is file-backed for local shell-owned durability."],
      requests: [],
      summary: {
        total: 0,
        pending: 0,
        resolved: 0,
      },
      operatorActions: [],
    };

    const markup = renderToStaticMarkup(
      <ExecutionApprovalsDirectorySurface
        directory={directory}
        routeScope={{
          projectId: "",
          intakeSessionId: "",
          sessionId: "session-empty",
          groupId: "",
          accountId: "",
          workspaceId: "",
        }}
      />,
    );

    expect(markup).toContain("No approval requests match the current scope.");
    expect(markup).toContain("source: file_backed");
    expect(markup).toContain("scope: session-empty");
  });
});
