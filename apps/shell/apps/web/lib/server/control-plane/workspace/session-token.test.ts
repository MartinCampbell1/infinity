import { describe, expect, test } from "vitest";

import {
  buildWorkspaceSessionSetCookieHeader,
  mintWorkspaceSessionToken,
  redactWorkspaceSessionForDelivery,
  resolveWorkspaceSessionDeliveryMode,
  verifyWorkspaceSessionToken,
} from "./session-token";

describe("workspace session token", () => {
  test("mints and verifies a launch-scoped embedded session token", () => {
    const session = mintWorkspaceSessionToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
        groupId: "group-ops-01",
        accountId: "account-chatgpt-01",
        workspaceId: "workspace-atlas-main",
      },
      now: new Date("2026-04-12T00:00:00.000Z"),
    });

    expect(session.deliveryMode).toBe("local_dev_session_storage");
    expect(session.cookieName).toBeNull();
    expect(session.refreshAfter).toBe("2026-04-12T00:15:00.000Z");
    const verification = verifyWorkspaceSessionToken({
      token: session.token,
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
        groupId: "group-ops-01",
        accountId: "account-chatgpt-01",
        workspaceId: "workspace-atlas-main",
      },
      now: new Date("2026-04-12T00:10:00.000Z"),
    });

    expect(verification.valid).toBe(true);
    expect(verification.claims?.kind).toBe(
      "founderos_workspace_embedded_session"
    );
    expect(verification.claims?.sessionTokenId).toBe(session.sessionTokenId);
  });

  test("rejects scope mismatches", () => {
    const session = mintWorkspaceSessionToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
    });

    const verification = verifyWorkspaceSessionToken({
      token: session.token,
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-002",
      },
    });

    expect(verification.valid).toBe(false);
    expect(verification.note).toMatch(/launch scope/i);
  });

  test("redacts the browser-readable bearer token for cookie-bound delivery", () => {
    const session = mintWorkspaceSessionToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      now: new Date("2026-04-12T00:00:00.000Z"),
      deliveryMode: "http_only_cookie",
    });

    const redacted = redactWorkspaceSessionForDelivery(session);
    expect(session.token).toEqual(expect.any(String));
    expect(redacted.token).toBeNull();
    expect(redacted.cookieName).toBe("founderos_workspace_session");
    expect(
      buildWorkspaceSessionSetCookieHeader({
        session,
        refs: {
          projectId: "project-atlas",
          sessionId: "session-2026-04-11-001",
        },
        now: new Date("2026-04-12T00:00:00.000Z"),
        env: {
          FOUNDEROS_DEPLOYMENT_ENV: "staging",
        },
      })
    ).toMatch(/HttpOnly; Path=\/api\/control\/execution\/workspace\/session-2026-04-11-001; SameSite=Lax; Max-Age=1800; Secure/);
  });

  test("uses cookie-bound delivery outside local deployment mode", () => {
    expect(
      resolveWorkspaceSessionDeliveryMode({
        FOUNDEROS_DEPLOYMENT_ENV: "production",
        FOUNDEROS_WORKSPACE_SESSION_DELIVERY_MODE: "local_dev_session_storage",
      })
    ).toBe("http_only_cookie");
    expect(
      resolveWorkspaceSessionDeliveryMode({
        FOUNDEROS_DEPLOYMENT_ENV: "staging",
        FOUNDEROS_WORKSPACE_SESSION_DELIVERY_MODE: "local_dev_session_storage",
      })
    ).toBe("http_only_cookie");
    expect(resolveWorkspaceSessionDeliveryMode({})).toBe(
      "local_dev_session_storage"
    );
  });
});
