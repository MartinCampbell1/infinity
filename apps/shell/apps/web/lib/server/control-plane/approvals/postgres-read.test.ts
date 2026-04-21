import { beforeEach, describe, expect, test, vi } from "vitest";

const readApprovalRequestsFromPostgres = vi.fn();
const readOperatorActionAuditEventsFromPostgres = vi.fn();

vi.mock("../state/store", () => ({
  buildControlPlaneStateNotes: () => ["pg approval note"],
  getControlPlaneStorageKind: () => "postgres",
  getControlPlaneStorageSource: () => "postgres",
  getControlPlaneIntegrationState: () => "wired",
  getWiredControlPlaneDatabaseUrl: async () => "postgres://control-plane.test/infinity",
  readControlPlaneState: async () => ({}),
  updateControlPlaneState: async () => {
    throw new Error("updateControlPlaneState should not be called in postgres read-path test");
  },
}));

vi.mock("../state/postgres", () => ({
  readApprovalRequestsFromPostgres,
  readOperatorActionAuditEventsFromPostgres,
}));

describe("approval postgres read path", () => {
  beforeEach(() => {
    readApprovalRequestsFromPostgres.mockReset();
    readOperatorActionAuditEventsFromPostgres.mockReset();
  });

  test("builds approval directories from Postgres-backed read models when wired", async () => {
    readApprovalRequestsFromPostgres.mockResolvedValue([
      {
        id: "approval-pg-001",
        sessionId: "session-pg-001",
        externalSessionId: "codex-pg-001",
        projectId: "project-pg",
        projectName: "Project PG",
        groupId: "group-pg",
        accountId: "account-chatgpt-01",
        workspaceId: "workspace-pg",
        requestKind: "command",
        title: "Run command",
        summary: "Execute a command",
        reason: "Needs approval",
        status: "pending",
        decision: null,
        requestedAt: "2026-04-11T10:00:00.000Z",
        updatedAt: "2026-04-11T10:00:00.000Z",
        resolvedAt: null,
        resolvedBy: null,
        expiresAt: null,
        revision: 1,
        raw: null,
      },
    ]);
    readOperatorActionAuditEventsFromPostgres.mockResolvedValue([
      {
        id: "operator-action-900",
        sequence: 900,
        sessionId: "session-pg-001",
        projectId: "project-pg",
        groupId: "group-pg",
        targetKind: "approval_request",
        targetId: "approval-pg-001",
        kind: "approval.responded",
        outcome: "applied",
        actorType: "operator",
        actorId: "infinity-operator",
        occurredAt: "2026-04-11T10:05:00.000Z",
        summary: "Approved request",
        payload: {},
        raw: null,
      },
      {
        id: "operator-action-901",
        sequence: 901,
        sessionId: "session-pg-001",
        projectId: "project-pg",
        groupId: "group-pg",
        targetKind: "recovery_incident",
        targetId: "recovery-pg-001",
        kind: "recovery.retry_requested",
        outcome: "applied",
        actorType: "operator",
        actorId: "infinity-operator",
        occurredAt: "2026-04-11T10:06:00.000Z",
        summary: "Retry requested",
        payload: {},
        raw: null,
      },
    ]);

    const approvals = await import("./mock");
    const directory = await approvals.buildMockApprovalRequestsDirectory();

    expect(directory.storageKind).toBe("postgres");
    expect(directory.integrationState).toBe("wired");
    expect(directory.requests).toHaveLength(1);
    expect(directory.summary.pending).toBe(1);
    expect(directory.operatorActions).toHaveLength(1);
    expect(directory.operatorActions[0]?.targetKind).toBe("approval_request");
  });
});
