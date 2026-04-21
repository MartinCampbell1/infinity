import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../../lib/server/control-plane/state/test-helpers";

import { POST as postRecoveryAction } from "./route";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("/api/control/execution/recoveries/[recoveryId]", () => {
  test("returns a runtimeSnapshot with the updated recovery session state", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const response = await postRecoveryAction(
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

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.runtimeSnapshot).toEqual(
      expect.objectContaining({
        latestEvent: expect.objectContaining({
          sessionId: "session-2026-04-11-001",
          kind: "recovery.started",
        }),
        session: expect.objectContaining({
          id: "session-2026-04-11-001",
          projectId: "project-atlas",
          recoveryState: "failing_over",
          retryCount: 1,
        }),
      })
    );
  });
});
