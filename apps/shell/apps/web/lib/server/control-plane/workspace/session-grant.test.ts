import { describe, expect, test } from "vitest";

import {
  mintWorkspaceSessionGrant,
  redactWorkspaceSessionGrantForDelivery,
  verifyWorkspaceSessionGrant,
} from "./session-grant";

describe("workspace session grant", () => {
  test("mints and verifies a launch-scoped session grant", () => {
    const grant = mintWorkspaceSessionGrant({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
        groupId: "group-ops-01",
        accountId: "account-chatgpt-01",
        workspaceId: "workspace-atlas-main",
      },
      now: new Date("2026-04-12T00:00:00.000Z"),
    });

    expect(grant.grantId).toEqual(expect.any(String));
    expect(grant.refreshAfter).toBe("2026-04-12T00:15:00.000Z");
    const verification = verifyWorkspaceSessionGrant({
      token: grant.token,
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
    expect(verification.claims?.kind).toBe("founderos_workspace_session_grant");
    expect(verification.claims?.grantId).toBe(grant.grantId);
  });

  test("rejects scope mismatches", () => {
    const grant = mintWorkspaceSessionGrant({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
    });

    const verification = verifyWorkspaceSessionGrant({
      token: grant.token,
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-002",
      },
    });

    expect(verification.valid).toBe(false);
    expect(verification.note).toMatch(/launch scope/i);
  });

  test("redacts the grant token for cookie-bound delivery while retaining audit metadata", () => {
    const grant = mintWorkspaceSessionGrant({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      now: new Date("2026-04-12T00:00:00.000Z"),
      grantId: "grant-1",
    });

    const redacted = redactWorkspaceSessionGrantForDelivery(
      grant,
      "http_only_cookie"
    );
    expect(redacted.token).toBeNull();
    expect(redacted.grantId).toBe("grant-1");
    expect(redacted.refreshAfter).toBe("2026-04-12T00:15:00.000Z");
  });
});
