import { describe, expect, test } from "vitest";

import { mintWorkspaceLaunchToken } from "../../../../../../../lib/server/control-plane/workspace/launch-token";
import { POST } from "./route";

describe("/api/control/execution/workspace/[sessionId]/session-bearer", () => {
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
    expect(payload.sessionBearerTokenEnvKey).toBeNull();
    expect(payload.note).toMatch(/compatibility/i);
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
    expect(payload.error).toMatch(/sessionId/i);
  });
});
