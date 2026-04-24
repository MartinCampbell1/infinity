import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../lib/server/control-plane/state/test-helpers";

import { GET as getRecoveriesDirectory } from "./route";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("/api/control/execution/recoveries", () => {
  test("filters incidents and recovery audit events by session and initiative query params", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const response = await getRecoveriesDirectory(
      new Request(
        "http://localhost/api/control/execution/recoveries?session_id=session-2026-04-11-001&initiative_id=project-atlas",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.incidents).toHaveLength(1);
    expect(body.incidents[0]).toEqual(
      expect.objectContaining({
        id: "recovery-001",
        sessionId: "session-2026-04-11-001",
        projectId: "project-atlas",
      }),
    );
    expect(body.summary).toEqual(
      expect.objectContaining({
        total: 1,
        retryable: 1,
      }),
    );
    expect(body.operatorActions.every((action: { targetId: string }) => action.targetId === "recovery-001")).toBe(true);
  });
});
