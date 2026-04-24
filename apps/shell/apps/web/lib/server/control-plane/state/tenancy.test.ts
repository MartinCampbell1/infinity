import { describe, expect, test } from "vitest";

import type { ControlPlaneState } from "./types";
import {
  TENANT_METADATA_KEY,
  applyTenantIsolationToState,
  tenantIdForRecord,
} from "./tenancy";

function buildState(): ControlPlaneState {
  return {
    version: 1,
    seededAt: "2026-04-24T00:00:00.000Z",
    approvals: {
      requests: [
        {
          id: "approval-tenant-a",
          tenantId: "tenant-a",
          createdBy: "operator-a",
          updatedBy: "operator-a",
          sessionId: "session-tenant-a",
          externalSessionId: null,
          projectId: "project-a",
          projectName: "Project A",
          groupId: null,
          accountId: null,
          workspaceId: null,
          requestKind: "command",
          title: "Tenant A approval",
          summary: "Visible only to tenant A.",
          reason: null,
          status: "pending",
          decision: null,
          requestedAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
          resolvedAt: null,
          resolvedBy: null,
          expiresAt: null,
          revision: 1,
          raw: null,
        },
        {
          id: "approval-tenant-b",
          sessionId: "session-tenant-b",
          externalSessionId: null,
          projectId: "project-b",
          projectName: "Project B",
          groupId: null,
          accountId: null,
          workspaceId: null,
          requestKind: "command",
          title: "Tenant B approval",
          summary: "Hidden from tenant A.",
          reason: null,
          status: "pending",
          decision: null,
          requestedAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
          resolvedAt: null,
          resolvedBy: null,
          expiresAt: null,
          revision: 1,
          raw: {
            [TENANT_METADATA_KEY]: {
              tenantId: "tenant-b",
              createdBy: "operator-b",
              updatedBy: "operator-b",
              requestId: "request-b",
              authBoundary: "token",
            },
          },
        },
      ],
      operatorActions: [],
      actionSequence: 1,
    },
    recoveries: {
      incidents: [],
      operatorActions: [],
      actionSequence: 101,
    },
    accounts: {
      snapshots: [],
      updates: [],
    },
    sessions: {
      events: [
        {
          id: "event-tenant-a",
          tenantId: "tenant-a",
          sessionId: "session-tenant-a",
          projectId: "project-a",
          groupId: null,
          source: "manual",
          provider: "codex",
          kind: "session.updated",
          status: "in_progress",
          phase: "acting",
          timestamp: "2026-04-24T00:00:00.000Z",
          summary: "Tenant A event",
          payload: {},
          raw: null,
        },
        {
          id: "event-tenant-b",
          sessionId: "session-tenant-b",
          projectId: "project-b",
          groupId: null,
          source: "manual",
          provider: "codex",
          kind: "session.updated",
          status: "in_progress",
          phase: "acting",
          timestamp: "2026-04-24T00:00:00.000Z",
          summary: "Tenant B event",
          payload: {
            actorContext: {
              actorType: "operator",
              actorId: "operator-b",
              tenantId: "tenant-b",
              requestId: "request-b",
              authBoundary: "token",
            },
          },
          raw: null,
        },
      ],
    },
    tenancy: {
      tenants: [
        {
          id: "tenant-a",
          name: "Tenant A",
          status: "active",
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
        {
          id: "tenant-b",
          name: "Tenant B",
          status: "active",
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      ],
      users: [
        {
          id: "operator-a",
          email: "operator-a@example.test",
          displayName: "Operator A",
          status: "active",
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
        {
          id: "operator-b",
          email: "operator-b@example.test",
          displayName: "Operator B",
          status: "active",
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      ],
      memberships: [
        {
          id: "tenant-a:operator-a",
          tenantId: "tenant-a",
          userId: "operator-a",
          role: "owner",
          status: "active",
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
        {
          id: "tenant-b:operator-b",
          tenantId: "tenant-b",
          userId: "operator-b",
          role: "admin",
          status: "active",
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      ],
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

describe("tenant isolation", () => {
  test("resolves tenant identity from direct fields, raw metadata, and actor context", () => {
    const state = buildState();

    expect(tenantIdForRecord(state.approvals.requests[0]!)).toBe("tenant-a");
    expect(tenantIdForRecord(state.approvals.requests[1]!)).toBe("tenant-b");
    expect(tenantIdForRecord(state.sessions.events[1]!)).toBe("tenant-b");
  });

  test("filters records and membership catalog to the active tenant", () => {
    const scoped = applyTenantIsolationToState(buildState(), "tenant-a");

    expect(scoped.tenancy.tenants.map((tenant) => tenant.id)).toEqual(["tenant-a"]);
    expect(scoped.tenancy.users.map((user) => user.id)).toEqual(["operator-a"]);
    expect(scoped.approvals.requests.map((request) => request.id)).toEqual([
      "approval-tenant-a",
    ]);
    expect(scoped.sessions.events.map((event) => event.id)).toEqual([
      "event-tenant-a",
    ]);
  });
});
