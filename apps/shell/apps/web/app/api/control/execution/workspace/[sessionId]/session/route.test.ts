import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { readControlPlaneState } from "../../../../../../../lib/server/control-plane/state/store";
import { createIsolatedControlPlaneStateDir } from "../../../../../../../lib/server/control-plane/state/test-helpers";
import { mintWorkspaceLaunchToken } from "../../../../../../../lib/server/control-plane/workspace/launch-token";
import { verifyWorkspaceSessionToken } from "../../../../../../../lib/server/control-plane/workspace/session-token";
import { DELETE, PATCH, POST } from "./route";

describe("/api/control/execution/workspace/[sessionId]/session", () => {
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
    expect(payload.session.deliveryMode).toBe("local_dev_session_storage");
    expect(typeof payload.session.refreshAfter).toBe("string");
    expect(typeof payload.sessionGrant?.token).toBe("string");
    expect(typeof payload.sessionGrant?.grantId).toBe("string");
    expect(typeof payload.sessionGrant?.refreshAfter).toBe("string");
    expect(response.headers.get("set-cookie")).toBeNull();
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

    const state = await readControlPlaneState();
    expect(
      state.sessions.events.some(
        (event) =>
          event.sessionId === "session-2026-04-11-001" &&
          event.payload.workspaceSessionAuth &&
          (event.payload.workspaceSessionAuth as { grantId?: string }).grantId ===
            payload.sessionGrant.grantId
      )
    ).toBe(true);
  });

  test("uses an httpOnly cookie and omits JSON bearer tokens in production-like deployments", async () => {
    process.env.FOUNDEROS_WORKSPACE_SESSION_DELIVERY_MODE = "http_only_cookie";
    process.env.FOUNDEROS_WORKSPACE_LAUNCH_SECRET = "test-launch-secret";
    process.env.FOUNDEROS_WORKSPACE_SESSION_TOKEN_SECRET =
      "test-session-token-secret";
    process.env.FOUNDEROS_WORKSPACE_SESSION_GRANT_SECRET =
      "test-session-grant-secret";

    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
    });

    const response = await POST(
      new Request("https://shell.infinity.local/api/control/execution/workspace/session-2026-04-11-001/session", {
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
    expect(payload.session.deliveryMode).toBe("http_only_cookie");
    expect(payload.session.token).toBeNull();
    expect(payload.session.cookieName).toBe("founderos_workspace_session");
    expect(payload.sessionGrant.token).toBeNull();
    expect(typeof payload.sessionGrant.grantId).toBe("string");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toContain(
      "founderos_workspace_session="
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
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

  test("revokes a workspace session grant and clears the httpOnly cookie", async () => {
    process.env.FOUNDEROS_WORKSPACE_SESSION_DELIVERY_MODE = "http_only_cookie";
    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
    });

    const response = await DELETE(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/session", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: minted.token,
          projectId: "project-atlas",
          sessionId: "session-2026-04-11-001",
          openedFrom: "execution_board",
          grantId: "grant-1",
          reason: "workspace_logout",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "founderos_workspace_session="
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    const payload = await response.json();
    expect(payload.accepted).toBe(true);

    const state = await readControlPlaneState();
    expect(
      state.sessions.events.some(
        (event) =>
          event.sessionId === "session-2026-04-11-001" &&
          (event.payload.workspaceSessionAuth as { action?: string; grantId?: string })
            ?.action === "revoked" &&
          (event.payload.workspaceSessionAuth as { action?: string; grantId?: string })
            ?.grantId === "grant-1"
      )
    ).toBe(true);
  });

  test("refreshes and rotates a cookie-bound workspace session while revoking the old token id", async () => {
    process.env.FOUNDEROS_WORKSPACE_SESSION_DELIVERY_MODE = "http_only_cookie";

    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
    });

    const issued = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/session", {
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
    const issuedPayload = await issued.json();
    const issuedCookie = issued.headers.get("set-cookie") ?? "";
    const oldCookiePair = issuedCookie.split(";")[0] ?? "";
    const oldSessionTokenId = issuedPayload.session.sessionTokenId;

    const refreshed = await PATCH(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/session", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: oldCookiePair,
        },
        body: JSON.stringify({
          projectId: "project-atlas",
          sessionId: "session-2026-04-11-001",
          openedFrom: "execution_board",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );

    expect(refreshed.status).toBe(200);
    const refreshedPayload = await refreshed.json();
    expect(refreshedPayload.session.token).toBeNull();
    expect(refreshedPayload.session.sessionTokenId).not.toBe(oldSessionTokenId);
    expect(refreshed.headers.get("set-cookie")).toContain(
      "founderos_workspace_session="
    );

    const rejected = await PATCH(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/session", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: oldCookiePair,
        },
        body: JSON.stringify({
          projectId: "project-atlas",
          sessionId: "session-2026-04-11-001",
          openedFrom: "execution_board",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );
    expect(rejected.status).toBe(401);
    const rejectedPayload = await rejected.json();
    expect(rejectedPayload.note).toMatch(/revoked/i);
  });
});
