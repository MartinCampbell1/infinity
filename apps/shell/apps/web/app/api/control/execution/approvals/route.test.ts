import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../lib/server/control-plane/state/test-helpers";

import { GET as getApprovalsDirectory, POST as postApprovalRequest } from "./route";
import { POST as postApprovalRespond } from "./[approvalId]/respond/route";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("/api/control/execution/approvals", () => {
  test("creates a durable pending approval that can be resolved through the response API", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const createResponse = await postApprovalRequest(
      new Request("http://localhost/api/control/execution/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "approval-validation-001",
          sessionId: "session-validation-001",
          projectId: "project-validation",
          projectName: "Validation project",
          requestKind: "command",
          title: "Validation pending approval",
          summary: "Approve the validation command before delivery can continue.",
          reason: "browser_e2e_pending_approval_probe",
        }),
      })
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createBody.approvalRequest).toEqual(
      expect.objectContaining({
        id: "approval-validation-001",
        sessionId: "session-validation-001",
        projectId: "project-validation",
        requestKind: "command",
        status: "pending",
        title: "Validation pending approval",
      })
    );
    expect(createBody.summary.pending).toBeGreaterThanOrEqual(1);

    const directoryResponse = await getApprovalsDirectory();
    const directoryBody = await directoryResponse.json();
    expect(directoryResponse.status).toBe(200);
    expect(directoryBody.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "approval-validation-001",
          status: "pending",
        }),
      ])
    );

    const respondResponse = await postApprovalRespond(
      new Request(
        "http://localhost/api/control/execution/approvals/approval-validation-001/respond",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            decision: "approve_once",
          }),
        }
      ),
      { params: Promise.resolve({ approvalId: "approval-validation-001" }) }
    );
    const respondBody = await respondResponse.json();

    expect(respondResponse.status).toBe(200);
    expect(respondBody.accepted).toBe(true);
    expect(respondBody.approvalRequest).toEqual(
      expect.objectContaining({
        id: "approval-validation-001",
        status: "approved",
        decision: "approve_once",
      })
    );
    expect(respondBody.runtimeSnapshot.session).toEqual(
      expect.objectContaining({
        id: "session-validation-001",
        pendingApprovals: 0,
      })
    );
  });
});
