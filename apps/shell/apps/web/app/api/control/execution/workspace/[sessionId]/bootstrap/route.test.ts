import { describe, expect, test } from "vitest";

import { mintWorkspaceLaunchToken } from "../../../../../../../lib/server/control-plane/workspace/launch-token";
import { POST } from "./route";

describe("/api/control/execution/workspace/[sessionId]/bootstrap", () => {
  test("returns a shell-authored bootstrap payload for a valid launch token", async () => {
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
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/bootstrap", {
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
    expect(payload.canonicalTruth).toBe("sessionId");
    expect(payload.user.email).toBe("operator@infinity.local");
    expect(payload.hostContext.sessionId).toBe("session-2026-04-11-001");
    expect(payload.hostContext.projectId).toBe("project-atlas");
    expect(Array.isArray(payload.ui.settings.models)).toBe(true);
    expect(payload.ui.settings.models.length).toBeGreaterThan(0);
    expect(payload.ui.settings.models[0]).toBe(payload.hostContext.model);
    expect(payload.ui.showSidebar).toBe(false);
    expect(payload.notes.length).toBeGreaterThan(0);
    expect(payload.auth.mode).toBe("session_exchange");
    expect(payload.auth).not.toHaveProperty("token");
    expect(payload.auth.sessionExchangePath).toBe(
      "/api/control/execution/workspace/session-2026-04-11-001/session"
    );
  });

  test("keeps session-exchange mode even when no temporary bearer env is configured", async () => {
    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
    });

    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/bootstrap", {
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
    expect(payload.auth.mode).toBe("session_exchange");
    expect(payload.auth.sessionExchangePath).toBe(
      "/api/control/execution/workspace/session-2026-04-11-001/session"
    );
  });

  test("rejects an invalid launch token", async () => {
    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/bootstrap", {
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
    expect(payload.canonicalTruth).toBe("sessionId");
    expect(payload.note).toMatch(/invalid|tampered/i);
  });

  test("rejects session scope mismatches before bootstrap", async () => {
    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
    });

    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/bootstrap", {
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
