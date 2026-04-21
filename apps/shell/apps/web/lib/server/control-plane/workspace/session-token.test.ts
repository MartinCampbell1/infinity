import { describe, expect, test } from "vitest";

import {
  mintWorkspaceSessionToken,
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
});
