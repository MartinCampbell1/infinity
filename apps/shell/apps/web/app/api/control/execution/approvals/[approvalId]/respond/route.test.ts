import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../../../lib/server/control-plane/state/test-helpers";

import { POST as postApprovalRespond } from "./route";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("/api/control/execution/approvals/[approvalId]/respond", () => {
  test("returns a runtimeSnapshot with the approved session state", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const response = await postApprovalRespond(
      new Request("http://localhost/api/control/execution/approvals/approval-001/respond", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: "approve_once",
        }),
      }),
      { params: Promise.resolve({ approvalId: "approval-001" }) }
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          kind: "approval.resolved",
        }),
        session: expect.objectContaining({
          id: "session-2026-04-11-001",
          projectId: "project-atlas",
          status: "acting",
          phase: "acting",
          pendingApprovals: 0,
        }),
      })
    );
  });
});
