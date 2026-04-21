import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../../lib/server/control-plane/state/test-helpers";
import { POST as postRecoveryAction } from "../../recoveries/[recoveryId]/route";

import { GET as getAuditDetail } from "./route";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("/api/control/execution/audits/[auditId]", () => {
  test("returns target and session context for a recovery-backed audit", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const recoveryResponse = await postRecoveryAction(
      new Request("http://localhost/api/control/execution/recoveries/recovery-001", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          actionKind: "failover",
          targetAccountId: "account-chatgpt-03",
        }),
      }),
      { params: Promise.resolve({ recoveryId: "recovery-001" }) }
    );
    const recoveryBody = await recoveryResponse.json();

    const response = await getAuditDetail(
      new Request(
        `http://localhost/api/control/execution/audits/${recoveryBody.operatorAction.id}`
      ),
      { params: Promise.resolve({ auditId: recoveryBody.operatorAction.id }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.auditEvent).toEqual(
      expect.objectContaining({
        id: recoveryBody.operatorAction.id,
        targetKind: "recovery_incident",
        targetId: "recovery-001",
      })
    );
    expect(body.target).toEqual(
      expect.objectContaining({
        id: "recovery-001",
        targetKind: "recovery_incident",
        status: "failing_over",
        accountId: "account-chatgpt-03",
      })
    );
    expect(body.session).toEqual(
      expect.objectContaining({
        id: "session-2026-04-11-001",
        recoveryState: "failing_over",
      })
    );
  });
});
