import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
import { CONTROL_PLANE_SCHEMA_CHECKSUM } from "./schema";
import type { ControlPlaneState } from "./types";

const poolQueryMock = vi.fn();
const poolConnectMock = vi.fn();
const poolEndMock = vi.fn().mockResolvedValue(undefined);
const STATE_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(STATE_DIR, "../../../..");
const SCHEMA_VERSION_ROW = {
  version: 3,
  name: "mutation_journal_idempotency",
  checksum: CONTROL_PLANE_SCHEMA_CHECKSUM,
};

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
    tenancy: {
      tenants: [],
      users: [],
      memberships: [],
      projects: [],
      workspaces: [],
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
    mutations: {
      events: [],
      idempotency: [],
    },
  };
}

function buildSchemaReadyQueryMock(
  fallback: (query: string) => Promise<{ rows: unknown[] }> | { rows: unknown[] } = () => ({
    rows: [],
  })
) {
  return vi.fn(async (query: string) => {
    if (query.includes("FROM shell_control_plane_schema_migrations")) {
      return { rows: [SCHEMA_VERSION_ROW] };
    }
    return fallback(query);
  });
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
    const clientQueryMock = buildSchemaReadyQueryMock();
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
    expect(sql).toContain("FROM shell_control_plane_schema_migrations");
    expect(sql).toContain("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))");
    expect(sql).not.toContain("CREATE TABLE IF NOT EXISTS");
    expect(sql).not.toContain("ALTER TABLE");
    expect(sql).toContain("INSERT INTO shell_control_plane_state");
    expect(sql).toContain("INSERT INTO execution_sessions");
    expect(sql).toContain("tenant_id, created_by, updated_by");
    expect(sql).toContain("SELECT set_config('app.current_tenant_id', $1, true)");
    expect(sql).toContain("INSERT INTO execution_session_events");
    expect(sql).toContain("INSERT INTO approval_requests");
    expect(sql).toContain("INSERT INTO recovery_incidents");
    expect(sql).toContain("INSERT INTO account_quota_snapshots");
    expect(sql).toContain("INSERT INTO account_quota_updates");
    expect(sql).toContain("INSERT INTO operator_action_audit_events");
    expect(sql).toContain("COMMIT");
  });

  test("keeps runtime DDL out of the postgres adapter and in versioned migrations", () => {
    const runtimeSource = readFileSync(path.join(STATE_DIR, "postgres.ts"), "utf8");
    const migrationSql = readFileSync(
      path.join(
        WEB_ROOT,
        "db/migrations/control-plane/001_control_plane_state.sql"
      ),
      "utf8"
    );
    const tenantMigrationSql = readFileSync(
      path.join(WEB_ROOT, "db/migrations/control-plane/002_tenant_rbac.sql"),
      "utf8",
    );
    const mutationMigrationSql = readFileSync(
      path.join(
        WEB_ROOT,
        "db/migrations/control-plane/003_mutation_journal_idempotency.sql",
      ),
      "utf8",
    );

    expect(runtimeSource).not.toContain("CREATE TABLE IF NOT EXISTS");
    expect(runtimeSource).not.toContain("ALTER TABLE");
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS shell_control_plane_state");
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS execution_sessions");
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS shell_control_plane_schema_migrations"
    );
    expect(migrationSql.includes(CONTROL_PLANE_SCHEMA_CHECKSUM)).toBe(false);
    expect(tenantMigrationSql).toContain("CREATE TABLE IF NOT EXISTS tenants");
    expect(tenantMigrationSql).toContain("CREATE TABLE IF NOT EXISTS tenant_memberships");
    expect(tenantMigrationSql).toContain("ADD COLUMN IF NOT EXISTS tenant_id");
    expect(tenantMigrationSql).toContain("ADD PRIMARY KEY (tenant_id, id)");
    expect(tenantMigrationSql).toContain("ADD PRIMARY KEY (tenant_id, sequence)");
    expect(tenantMigrationSql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(tenantMigrationSql).toContain("CREATE POLICY approval_requests_tenant_isolation");
    expect(mutationMigrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS control_plane_mutation_events",
    );
    expect(mutationMigrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS control_plane_idempotency_records",
    );
    expect(mutationMigrationSql).toContain("PRIMARY KEY (tenant_id, id)");
    expect(mutationMigrationSql).toContain(
      "PRIMARY KEY (tenant_id, idempotency_key)",
    );
    expect(mutationMigrationSql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  test("uses upsert projection instead of full read-model replacement in production-like deployments", async () => {
    const previousDeploymentEnv = process.env.FOUNDEROS_DEPLOYMENT_ENV;
    process.env.FOUNDEROS_DEPLOYMENT_ENV = "production";
    const clientQueryMock = buildSchemaReadyQueryMock();
    poolConnectMock.mockResolvedValue({
      query: clientQueryMock,
      release: vi.fn(),
    });

    try {
      const postgres = await import("./postgres");
      await postgres.writeControlPlaneStateToPostgres(
        "postgres://control-plane.test/infinity",
        buildSeedState(),
      );
    } finally {
      if (previousDeploymentEnv === undefined) {
        delete process.env.FOUNDEROS_DEPLOYMENT_ENV;
      } else {
        process.env.FOUNDEROS_DEPLOYMENT_ENV = previousDeploymentEnv;
      }
    }

    const sql = clientQueryMock.mock.calls
      .map(([query]) => String(query))
      .join("\n");

    expect(sql).toContain("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))");
    expect(sql).toContain("ON CONFLICT (tenant_id, id) DO UPDATE");
    expect(sql).not.toContain("DELETE FROM execution_session_events");
    expect(sql).not.toContain("DELETE FROM execution_sessions");
    expect(sql).not.toContain("DELETE FROM approval_requests");
    expect(sql).not.toContain("DELETE FROM recovery_incidents");
    expect(sql).not.toContain("DELETE FROM operator_action_audit_events");
  });

  test("mutates the latest postgres state row under advisory lock", async () => {
    const seedState = buildSeedState();
    const clientQueryMock = buildSchemaReadyQueryMock((query) => {
      if (query.includes("SELECT state_json FROM shell_control_plane_state")) {
        return { rows: [{ state_json: seedState }] };
      }
      return { rows: [] };
    });
    poolConnectMock.mockResolvedValue({
      query: clientQueryMock,
      release: vi.fn(),
    });

    const postgres = await import("./postgres");
    const nextState = await postgres.updateControlPlaneStateInPostgres(
      "postgres://control-plane.test/infinity",
      buildSeedState(),
      (draft) => {
        draft.sessions.events.push({
          id: "event-postgres-locked",
          sessionId: "session-2026-04-11-001",
          projectId: "project-atlas",
          groupId: "group-ops-01",
          source: "manual",
          provider: "codex",
          kind: "session.updated",
          status: "completed",
          phase: "acting",
          timestamp: "2026-04-24T00:00:00.000Z",
          summary: "Locked mutation event.",
          payload: {},
          raw: null,
        });
      },
      {
        lockTenantId: "tenant-test",
        lockResourceId: "run-test",
      },
    );

    const queries = clientQueryMock.mock.calls.map(([query]) => String(query));
    const lockIndex = queries.findIndex((query) =>
      query.includes("pg_advisory_xact_lock"),
    );
    const selectIndex = queries.findIndex((query) =>
      query.includes("FOR UPDATE"),
    );
    const writeIndex = queries.findIndex((query) =>
      query.includes("INSERT INTO shell_control_plane_state"),
    );

    expect(nextState.sessions.events.some((event) => event.id === "event-postgres-locked")).toBe(true);
    expect(lockIndex).toBeGreaterThanOrEqual(0);
    expect(selectIndex).toBeGreaterThan(lockIndex);
    expect(writeIndex).toBeGreaterThan(selectIndex);
  });

  test("applies targeted relational deltas without full table replacement", async () => {
    const clientQueryMock = buildSchemaReadyQueryMock();
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
    expect(sql).not.toContain("CREATE TABLE IF NOT EXISTS");
    expect(sql).not.toContain("ALTER TABLE");
    expect(sql).toContain("ON CONFLICT (tenant_id, id) DO UPDATE");
    expect(sql).not.toContain("DELETE FROM execution_session_events");
    expect(sql).not.toContain("DELETE FROM execution_sessions");
    expect(sql).not.toContain("DELETE FROM approval_requests");
    expect(sql).not.toContain("DELETE FROM recovery_incidents");
    expect(sql).not.toContain("DELETE FROM account_quota_updates");
    expect(sql).not.toContain("DELETE FROM operator_action_audit_events");
    expect(sql).toContain(
      "DELETE FROM account_quota_snapshots WHERE tenant_id = $1 AND account_id = $2",
    );
    expect(sql).toContain("SELECT set_config('app.current_tenant_id', $1, true)");
    expect(sql).toContain("COMMIT");
  });

  test("maps relational session rows back into execution summaries", async () => {
    poolQueryMock.mockImplementation(async (query: string) => {
      if (query.includes("FROM shell_control_plane_schema_migrations")) {
        return { rows: [SCHEMA_VERSION_ROW] };
      }

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

  test("fails runtime reads when migrations have not been applied", async () => {
    poolQueryMock.mockImplementation(async (query: string) => {
      if (query.includes("FROM shell_control_plane_schema_migrations")) {
        const error = new Error("relation does not exist") as Error & {
          code: string;
        };
        error.code = "42P01";
        throw error;
      }
      return { rows: [] };
    });

    const postgres = await import("./postgres");
    await expect(
      postgres.readControlPlaneStateFromPostgres(
        "postgres://control-plane.test/infinity"
      )
    ).rejects.toMatchObject({
      name: "ControlPlaneSchemaMismatchError",
      code: "control_plane_schema_mismatch",
      expectedVersion: 3,
      observedVersion: null,
    });

    const sql = poolQueryMock.mock.calls
      .map(([query]) => String(query))
      .join("\n");
    expect(sql).toContain("FROM shell_control_plane_schema_migrations");
    expect(sql).not.toContain("CREATE TABLE IF NOT EXISTS");
    expect(sql).not.toContain("ALTER TABLE");
  });
});
