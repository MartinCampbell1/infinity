import { beforeEach, describe, expect, test, vi } from "vitest";

const readExecutionSessionEventsFromPostgres = vi.fn();
const readExecutionSessionSummariesFromPostgres = vi.fn();

vi.mock("../state/store", () => ({
  getWiredControlPlaneDatabaseUrl: async () => "postgres://control-plane.test/infinity",
  readControlPlaneState: async () => {
    throw new Error("readControlPlaneState should not be called in postgres read-path test");
  },
}));

vi.mock("../state/postgres", () => ({
  readExecutionSessionEventsFromPostgres,
  readExecutionSessionSummariesFromPostgres,
}));

describe("session postgres read path", () => {
  beforeEach(() => {
    readExecutionSessionEventsFromPostgres.mockReset();
    readExecutionSessionSummariesFromPostgres.mockReset();
  });

  test("prefers Postgres-backed events and summaries when the shell storage is wired", async () => {
    readExecutionSessionEventsFromPostgres.mockResolvedValue([
      {
        id: "session-pg-001:manual:session.started:2026-04-11T10:00:00.000Z:0",
        sessionId: "session-pg-001",
        projectId: "project-pg",
        groupId: "group-pg",
        source: "manual",
        provider: "codex",
        kind: "session.started",
        status: "in_progress",
        phase: "planning",
        timestamp: "2026-04-11T10:00:00.000Z",
        summary: "Session started",
        payload: {},
        raw: null,
      },
    ]);
    readExecutionSessionSummariesFromPostgres.mockResolvedValue([
      {
        id: "session-pg-001",
        externalSessionId: "codex-pg-001",
        projectId: "project-pg",
        projectName: "Project PG",
        groupId: "group-pg",
        workspaceId: "workspace-pg",
        accountId: "account-chatgpt-01",
        provider: "codex",
        model: "gpt-5.4",
        title: "PG session",
        status: "acting",
        phase: "acting",
        tags: ["pg"],
        pinned: false,
        archived: false,
        createdAt: "2026-04-11T10:00:00.000Z",
        updatedAt: "2026-04-11T10:05:00.000Z",
        lastMessageAt: "2026-04-11T10:04:00.000Z",
        lastToolAt: "2026-04-11T10:04:30.000Z",
        lastErrorAt: null,
        pendingApprovals: 0,
        toolActivityCount: 1,
        retryCount: 0,
        recoveryState: "none",
        quotaPressure: "low",
        unreadOperatorSignals: 0,
      },
    ]);

    const sessions = await import("./mock");
    const events = await sessions.getMockNormalizedExecutionEvents();
    const summaries = await sessions.getMockExecutionSessionSummaries();

    expect(events).toHaveLength(1);
    expect(events[0]?.sessionId).toBe("session-pg-001");
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.projectName).toBe("Project PG");
  });
});
