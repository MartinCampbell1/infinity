import { afterEach, describe, expect, test } from "vitest";

import { createIsolatedControlPlaneStateDir } from "../state/test-helpers";
import { getMockExecutionSessionSummaries } from "./mock";

let restoreStateDir: (() => void) | null = null;

afterEach(() => {
  if (restoreStateDir) {
    restoreStateDir();
    restoreStateDir = null;
  }
});

describe("getMockExecutionSessionSummaries", () => {
  test("materializes projection-backed sessions with route-scope fields intact", async () => {
    const { restore } = createIsolatedControlPlaneStateDir();
    restoreStateDir = restore;

    const sessions = await getMockExecutionSessionSummaries();

    expect(sessions).toHaveLength(3);
    expect(sessions.map((session) => session.id)).toEqual([
      "session-2026-04-11-001",
      "session-2026-04-11-002",
      "session-2026-04-11-003",
    ]);

    const atlas = sessions[0];
    expect(atlas).toMatchObject({
      projectId: "project-atlas",
      projectName: "Atlas Launch",
      groupId: "group-ops-01",
      workspaceId: "workspace-atlas-main",
      accountId: "account-chatgpt-01",
      provider: "hermes",
      status: "acting",
      phase: "acting",
      pendingApprovals: 1,
      quotaPressure: "low",
      pinned: true,
    });
    expect(atlas?.tags).toEqual(["launch", "priority"]);

    const borealis = sessions[1];
    expect(borealis).toMatchObject({
      projectId: "project-borealis",
      groupId: "group-core-02",
      workspaceId: "workspace-borealis-review",
      accountId: "account-chatgpt-02",
      provider: "codex",
      status: "waiting_for_approval",
      recoveryState: "retryable",
      retryCount: 1,
      quotaPressure: "high",
    });

    const cascade = sessions[2];
    expect(cascade).toMatchObject({
      projectId: "project-cascade",
      groupId: "group-capture-03",
      workspaceId: "workspace-cascade-embed",
      accountId: "account-apikey-01",
      provider: "openwebui",
      status: "blocked",
      recoveryState: "retryable",
      quotaPressure: "medium",
    });
  });
});
