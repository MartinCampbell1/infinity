import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../lib/server/control-plane/state/test-helpers";
import { POST as postApprovalRespond } from "../approvals/[approvalId]/respond/route";
import { POST as postRecoveryAction } from "../recoveries/[recoveryId]/route";

import { GET as getAuditsDirectory } from "./route";

let restoreStateDir: (() => void) | null = null;
const OPERATOR_ACTOR_HEADERS = {
  "x-founderos-actor-type": "operator",
  "x-founderos-actor-id": "operator-audit-test",
  "x-founderos-tenant-id": "tenant-test",
  "x-founderos-request-id": "request-audit-test",
  "x-founderos-auth-boundary": "token",
};

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
        headers: {
          "content-type": "application/json",
          ...OPERATOR_ACTOR_HEADERS,
        },
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

  test("returns operator audits after a recovery retry action is applied", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const recoveryResponse = await postRecoveryAction(
      new Request("http://localhost/api/control/execution/recoveries/recovery-001", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...OPERATOR_ACTOR_HEADERS,
        },
        body: JSON.stringify({
          actionKind: "retry",
        }),
      }),
      { params: Promise.resolve({ recoveryId: "recovery-001" }) }
    );
    const recoveryBody = await recoveryResponse.json();

    const response = await getAuditsDirectory();
    const body = await response.json();

    expect(recoveryResponse.status).toBe(200);
    expect(response.status).toBe(200);
    expect(body.summary).toEqual(
      expect.objectContaining({
        total: 1,
        approvals: 0,
        recoveries: 1,
        applied: 1,
      })
    );
    expect(body.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: recoveryBody.operatorAction.id,
          targetKind: "recovery_incident",
          targetId: "recovery-001",
          kind: "recovery.retry_requested",
          outcome: "applied",
        }),
      ])
    );
  });
});
