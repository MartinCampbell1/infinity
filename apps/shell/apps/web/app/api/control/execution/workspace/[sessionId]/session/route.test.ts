import { describe, expect, test } from "vitest";

import { mintWorkspaceLaunchToken } from "../../../../../../../lib/server/control-plane/workspace/launch-token";
import { verifyWorkspaceSessionToken } from "../../../../../../../lib/server/control-plane/workspace/session-token";
import { POST } from "./route";

describe("/api/control/execution/workspace/[sessionId]/session", () => {
  test("returns a shell-issued embedded session token for a valid launch token", async () => {
    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
        groupId: "group-ops-01",
        accountId: "account-chatgpt-01",
        workspaceId: "workspace-atlas-main",
      },
      openedFrom: "execution_board",
    });

    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: minted.token,
          projectId: "project-atlas",
          sessionId: "session-2026-04-11-001",
          groupId: "group-ops-01",
          accountId: "account-chatgpt-01",
          workspaceId: "workspace-atlas-main",
          openedFrom: "execution_board",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.accepted).toBe(true);
    expect(payload.user.email).toBe("operator@infinity.local");
    expect(typeof payload.session?.token).toBe("string");
    expect(typeof payload.sessionGrant?.token).toBe("string");
    const verification = verifyWorkspaceSessionToken({
      token: payload.session.token,
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
        groupId: "group-ops-01",
        accountId: "account-chatgpt-01",
        workspaceId: "workspace-atlas-main",
      },
    });
    expect(verification.valid).toBe(true);
  });

  test("rejects an invalid launch token", async () => {
    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "tampered.token",
          projectId: "project-atlas",
          sessionId: "session-2026-04-11-001",
          openedFrom: "execution_board",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    expect(response.status).toBe(401);
    const payload = await response.json();
    expect(payload.accepted).toBe(false);
    expect(payload.note).toMatch(/invalid|tampered/i);
  });
});
