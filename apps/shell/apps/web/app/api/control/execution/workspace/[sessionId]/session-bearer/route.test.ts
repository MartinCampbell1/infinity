import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../../../../../../../lib/server/control-plane/state/test-helpers";
import { mintWorkspaceLaunchToken } from "../../../../../../../lib/server/control-plane/workspace/launch-token";
import { POST } from "./route";

describe("/api/control/execution/workspace/[sessionId]/session-bearer", () => {
  let restoreStateDir: (() => void) | null = null;
  const previousEnv = { ...process.env };

  beforeEach(() => {
    restoreStateDir = createIsolatedControlPlaneStateDir().restore;
  });

  afterEach(() => {
    restoreStateDir?.();
    restoreStateDir = null;
    process.env = { ...previousEnv };
  });

  test("keeps the legacy compatibility route alive but returns a shell-issued session token", async () => {
    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
    });

    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/session-bearer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: minted.token,
          projectId: "project-atlas",
          sessionId: "session-2026-04-11-001",
          openedFrom: "execution_board",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.accepted).toBe(true);
    expect(typeof payload.sessionBearerToken).toBe("string");
    expect(payload.sessionDeliveryMode).toBe("local_dev_session_storage");
    expect(payload.sessionBearerTokenEnvKey).toBeNull();
    expect(payload.note).toMatch(/compatibility/i);
  });

  test("does not expose a compatibility bearer token when cookie-bound delivery is active", async () => {
    process.env.FOUNDEROS_WORKSPACE_SESSION_DELIVERY_MODE = "http_only_cookie";

    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
    });

    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/session-bearer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: minted.token,
          projectId: "project-atlas",
          sessionId: "session-2026-04-11-001",
          openedFrom: "execution_board",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.accepted).toBe(true);
    expect(payload.sessionDeliveryMode).toBe("http_only_cookie");
    expect(payload.sessionBearerToken).toBeNull();
    expect(payload.sessionGrant.token).toBeNull();
  });

  test("rejects session scope mismatches before the compatibility exchange", async () => {
    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
    });

    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/session-bearer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: minted.token,
          projectId: "project-atlas",
          sessionId: "session-2026-04-11-002",
          openedFrom: "execution_board",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error).toEqual(
      expect.objectContaining({
        code: "session_id_mismatch",
        message: expect.stringMatching(/sessionId/i),
      })
    );
  });
});
