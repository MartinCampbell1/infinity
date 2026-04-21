import { describe, expect, test } from "vitest";

import { mintWorkspaceLaunchToken } from "../../../../../../../lib/server/control-plane/workspace/launch-token";

import { POST } from "./route";

describe("/api/control/execution/workspace/[sessionId]/launch-token", () => {
  test("accepts a valid shell-issued launch token", async () => {
    const issuedNow = new Date();
    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
        groupId: "group-ops-01",
        accountId: "account-chatgpt-01",
        workspaceId: "workspace-atlas-main",
      },
      openedFrom: "execution_board",
      now: issuedNow,
    });

    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/launch-token", {
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
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(true);
    expect(body.state).toBe("valid");
    expect(body.canonicalTruth).toBe("sessionId");
    expect(body.sessionId).toBe("session-2026-04-11-001");
    expect(body.issuedAt).toBe(issuedNow.toISOString());
  });

  test("rejects tokens that do not match the launch scope", async () => {
    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
      now: new Date("2026-04-12T11:30:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: minted.token,
          projectId: "project-borealis",
          sessionId: "session-2026-04-11-001",
          openedFrom: "execution_board",
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(false);
    expect(body.state).toBe("invalid");
  });

  test("rejects expired launch tokens", async () => {
    const minted = mintWorkspaceLaunchToken({
      refs: {
        projectId: "project-atlas",
        sessionId: "session-2026-04-11-001",
      },
      openedFrom: "execution_board",
      now: new Date(Date.now() - 10 * 60 * 1000),
      ttlMs: 1_000,
    });

    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/launch-token", {
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
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.accepted).toBe(false);
    expect(body.state).toBe("expired");
  });

  test("rejects malformed verification bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/control/execution/workspace/session-2026-04-11-001/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: null,
        }),
      }),
      { params: Promise.resolve({ sessionId: "session-2026-04-11-001" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid workspace launch token verification body");
  });
});
