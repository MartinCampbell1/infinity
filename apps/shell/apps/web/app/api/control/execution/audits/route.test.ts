import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../lib/server/control-plane/state/test-helpers";
import { POST as postApprovalRespond } from "../approvals/[approvalId]/respond/route";

import { GET as getAuditsDirectory } from "./route";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("/api/control/execution/audits", () => {
  test("returns operator audits after an approval response is applied", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const approvalResponse = await postApprovalRespond(
      new Request("http://localhost/api/control/execution/approvals/approval-001/respond", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision: "approve_once",
        }),
      }),
      { params: Promise.resolve({ approvalId: "approval-001" }) }
    );
    const approvalBody = await approvalResponse.json();

    const response = await getAuditsDirectory();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary).toEqual(
      expect.objectContaining({
        total: 1,
        approvals: 1,
        recoveries: 0,
        applied: 1,
      })
    );
    expect(body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: approvalBody.operatorAction.id,
          targetKind: "approval_request",
          targetId: "approval-001",
          outcome: "applied",
        }),
      ])
    );
  });
});
