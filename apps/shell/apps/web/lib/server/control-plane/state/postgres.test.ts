import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  ACCOUNT_QUOTA_SNAPSHOT_SEEDS,
  ACCOUNT_QUOTA_UPDATE_SEEDS,
  APPROVAL_REQUEST_SEEDS,
  CONTROL_PLANE_DIRECTORY_AT,
  NORMALIZED_EVENT_SEEDS,
  RECOVERY_INCIDENT_SEEDS,
} from "./seeds";
import { materializeSessionProjections } from "../events/store";
import type { ControlPlaneState } from "./types";

const poolQueryMock = vi.fn();
const poolConnectMock = vi.fn();
const poolEndMock = vi.fn().mockResolvedValue(undefined);

vi.mock("pg", () => ({
  Pool: class MockPool {
    query = poolQueryMock;
    connect = poolConnectMock;
    end = poolEndMock;
  },
}));

function buildSeedState(): ControlPlaneState {
  return {
    version: 1,
    seededAt: CONTROL_PLANE_DIRECTORY_AT,
    approvals: {
      requests: JSON.parse(JSON.stringify(APPROVAL_REQUEST_SEEDS.slice(0, 2))),
      operatorActions: [
        {
          id: "operator-action-001",
          sequence: 1,
          sessionId: "session-2026-04-11-001",
          projectId: "project-atlas",
          groupId: "group-ops-01",
          targetKind: "approval_request",
          targetId: "approval-001",
          kind: "approval.responded",
          outcome: "applied",
          actorType: "operator",
          actorId: "infinity-operator",
          occurredAt: "2026-04-11T12:30:00.000Z",
          summary: "Approved approval-001.",
          payload: { approvalId: "approval-001" },
          raw: { source: "postgres" },
        },
      ],
      actionSequence: 1,
    },
    recoveries: {
      incidents: JSON.parse(JSON.stringify(RECOVERY_INCIDENT_SEEDS.slice(0, 2))),
      operatorActions: [
        {
          id: "operator-action-101",
          sequence: 101,
          sessionId: "session-2026-04-11-002",
          projectId: "project-borealis",
          groupId: "group-core-02",
          targetKind: "recovery_incident",
          targetId: "recovery-002",
          kind: "recovery.retry_requested",
          outcome: "applied",
          actorType: "operator",
          actorId: "infinity-operator",
          occurredAt: "2026-04-11T12:35:00.000Z",
          summary: "Retry requested for recovery-002.",
          payload: { recoveryId: "recovery-002" },
          raw: { source: "postgres" },
        },
      ],
      actionSequence: 101,
    },
    accounts: {
      snapshots: JSON.parse(JSON.stringify(ACCOUNT_QUOTA_SNAPSHOT_SEEDS)),
      updates: JSON.parse(JSON.stringify(ACCOUNT_QUOTA_UPDATE_SEEDS)),
    },
    sessions: {
      events: JSON.parse(JSON.stringify(NORMALIZED_EVENT_SEEDS)),
    },
    orchestration: {
      initiatives: [],
      briefs: [],
      taskGraphs: [],
      workUnits: [],
      batches: [],
      supervisorActions: [],
      assemblies: [],
      verifications: [],
      deliveries: [],
      runs: [],
      specDocs: [],
      agentSessions: [],
      refusals: [],
      runEvents: [],
      previewTargets: [],
      handoffPackets: [],
      validationProofs: [],
      secretPauses: [],
    },
  };
}

describe("control-plane postgres read model", () => {
  beforeEach(() => {
    vi.resetModules();
    poolQueryMock.mockReset();
    poolConnectMock.mockReset();
    poolEndMock.mockClear();
  });

  afterEach(async () => {
    const postgres = await import("./postgres");
    postgres.resetControlPlanePostgresPoolForTests();
  });

  test("writes the unified state row and relational read-model tables in one transaction", async () => {
    const clientQueryMock = vi.fn().mockResolvedValue({ rows: [] });
    poolConnectMock.mockResolvedValue({
      query: clientQueryMock,
      release: vi.fn(),
    });

    const postgres = await import("./postgres");
    await postgres.writeControlPlaneStateToPostgres(
      "postgres://control-plane.test/infinity",
      buildSeedState()
    );

    const sql = clientQueryMock.mock.calls
      .map(([query]) => String(query))
      .join("\n");

    expect(sql).toContain("BEGIN");
    expect(sql).toContain("INSERT INTO shell_control_plane_state");
    expect(sql).toContain("INSERT INTO execution_sessions");
    expect(sql).toContain("INSERT INTO execution_session_events");
    expect(sql).toContain("INSERT INTO approval_requests");
    expect(sql).toContain("INSERT INTO recovery_incidents");
    expect(sql).toContain("INSERT INTO account_quota_snapshots");
    expect(sql).toContain("INSERT INTO account_quota_updates");
    expect(sql).toContain("INSERT INTO operator_action_audit_events");
    expect(sql).toContain("COMMIT");
  });

  test("applies targeted relational deltas without full table replacement", async () => {
    const clientQueryMock = vi.fn().mockResolvedValue({ rows: [] });
    poolConnectMock.mockResolvedValue({
      query: clientQueryMock,
      release: vi.fn(),
    });

    const state = buildSeedState();
    const sessionSummaries = Object.values(materializeSessionProjections(state.sessions.events)).slice(
      0,
      2
    );

    const postgres = await import("./postgres");
    await postgres.writeControlPlaneStateToPostgres(
      "postgres://control-plane.test/infinity",
      state,
      {
        sessions: sessionSummaries,
        events: state.sessions.events.filter((event) =>
          sessionSummaries.some((session) => session.id === event.sessionId)
        ),
        approvals: [state.approvals.requests[0]!],
        recoveries: [state.recoveries.incidents[0]!],
        quotaSnapshots: [state.accounts.snapshots[0]!],
        quotaUpdates: [state.accounts.updates[0]!],
        operatorActions: [
          state.approvals.operatorActions[0]!,
          state.recoveries.operatorActions[0]!,
        ],
      }
    );

    const sql = clientQueryMock.mock.calls
      .map(([query]) => String(query))
      .join("\n");

    expect(sql).toContain("INSERT INTO shell_control_plane_state");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE");
    expect(sql).not.toContain("DELETE FROM execution_session_events");
    expect(sql).not.toContain("DELETE FROM execution_sessions");
    expect(sql).not.toContain("DELETE FROM approval_requests");
    expect(sql).not.toContain("DELETE FROM recovery_incidents");
    expect(sql).not.toContain("DELETE FROM account_quota_updates");
    expect(sql).not.toContain("DELETE FROM operator_action_audit_events");
    expect(sql).toContain("DELETE FROM account_quota_snapshots WHERE account_id = $1");
    expect(sql).toContain("COMMIT");
  });

  test("maps relational session rows back into execution summaries", async () => {
    poolQueryMock.mockImplementation(async (query: string) => {
      if (query.includes("FROM execution_sessions")) {
        return {
          rows: [
            {
              id: "session-pg-001",
              external_session_id: "codex-pg-001",
              project_id: "project-pg",
              project_name: "Project PG",
              group_id: "group-pg",
              workspace_id: "workspace-pg",
              account_id: "account-chatgpt-01",
              provider: "codex",
              model: "gpt-5.4",
              title: "PG session",
              status: "acting",
              phase: "acting",
              tags: ["pg", "durable"],
              pinned: true,
              archived: false,
              created_at: "2026-04-11T10:00:00.000Z",
              updated_at: "2026-04-11T10:05:00.000Z",
              last_message_at: "2026-04-11T10:04:00.000Z",
              last_tool_at: "2026-04-11T10:04:30.000Z",
              last_error_at: null,
              pending_approvals: 2,
              tool_activity_count: 5,
              retry_count: 1,
              recovery_state: "retryable",
              quota_pressure: "high",
              unread_operator_signals: 3,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const postgres = await import("./postgres");
    const sessions = await postgres.readExecutionSessionSummariesFromPostgres(
      "postgres://control-plane.test/infinity"
    );

    expect(sessions).toEqual([
      expect.objectContaining({
        id: "session-pg-001",
        externalSessionId: "codex-pg-001",
        projectId: "project-pg",
        projectName: "Project PG",
        groupId: "group-pg",
        workspaceId: "workspace-pg",
        accountId: "account-chatgpt-01",
        provider: "codex",
        model: "gpt-5.4",
        status: "acting",
        phase: "acting",
        tags: ["pg", "durable"],
        pinned: true,
        pendingApprovals: 2,
        toolActivityCount: 5,
        retryCount: 1,
        recoveryState: "retryable",
        quotaPressure: "high",
        unreadOperatorSignals: 3,
      }),
    ]);
  });
});
