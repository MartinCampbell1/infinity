import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import type { RecoveryIncidentsDirectory } from "@/lib/server/control-plane/contracts/recoveries";

vi.mock("@/lib/route-scope", () => ({
  readShellRouteScopeFromQueryRecord: vi.fn(() => ({
    projectId: "",
    intakeSessionId: "",
    sessionId: "session-scoped",
    groupId: "",
    accountId: "",
    workspaceId: "",
  })),
}));

vi.mock("@/components/execution/control-plane-directory-surfaces", () => ({
  ExecutionRecoveriesDirectorySurface: ({
    directory,
  }: {
    directory: RecoveryIncidentsDirectory;
  }) => (
    <section data-recoveries-directory="true">
      <div>total:{directory.summary.total}</div>
      <div>retryable:{directory.summary.retryable}</div>
      {directory.incidents.map((incident) => (
        <article key={incident.id}>{incident.id}</article>
      ))}
      {directory.operatorActions.map((action) => (
        <div key={action.id}>audit:{action.id}</div>
      ))}
    </section>
  ),
}));

vi.mock("@/lib/server/control-plane/recoveries", () => ({
  buildRecoveryIncidentsDirectory: vi.fn(async (filters?: { sessionId?: string; initiativeId?: string }) => {
    const incidents = [
      {
        id: "recovery-scoped",
        sessionId: "session-scoped",
        projectId: "initiative-scoped",
        projectName: "Scoped run",
        status: "retryable",
        severity: "high",
        recoveryActionKind: "retry",
        summary: "Scoped recovery",
        retryCount: 0,
        openedAt: "2026-04-11T00:00:00.000Z",
        lastObservedAt: "2026-04-11T00:00:00.000Z",
        updatedAt: "2026-04-11T00:00:00.000Z",
        revision: 1,
        raw: { initiativeId: "initiative-scoped" },
      },
      {
        id: "recovery-global",
        sessionId: "session-global",
        projectId: "initiative-global",
        projectName: "Global run",
        status: "retryable",
        severity: "high",
        recoveryActionKind: "retry",
        summary: "Global recovery",
        retryCount: 0,
        openedAt: "2026-04-11T00:00:00.000Z",
        lastObservedAt: "2026-04-11T00:00:00.000Z",
        updatedAt: "2026-04-11T00:00:00.000Z",
        revision: 1,
        raw: { initiativeId: "initiative-global" },
      },
    ].filter((incident) => {
      if (filters?.sessionId && incident.sessionId !== filters.sessionId) {
        return false;
      }
      if (filters?.initiativeId && incident.projectId !== filters.initiativeId) {
        return false;
      }
      return true;
    });
    const incidentIds = new Set(incidents.map((incident) => incident.id));
    const operatorActions = [
      {
        id: "audit-scoped",
        sequence: 1,
        sessionId: "session-scoped",
        projectId: "initiative-scoped",
        groupId: null,
        targetKind: "recovery_incident",
        targetId: "recovery-scoped",
        kind: "recovery.retry_requested",
        outcome: "applied",
        actorType: "operator",
        actorId: "infinity-operator",
        occurredAt: "2026-04-11T00:00:00.000Z",
        summary: "Scoped retry.",
        payload: {},
        raw: null,
      },
      {
        id: "audit-global",
        sequence: 2,
        sessionId: "session-global",
        projectId: "initiative-global",
        groupId: null,
        targetKind: "recovery_incident",
        targetId: "recovery-global",
        kind: "recovery.retry_requested",
        outcome: "applied",
        actorType: "operator",
        actorId: "infinity-operator",
        occurredAt: "2026-04-11T00:00:00.000Z",
        summary: "Global retry.",
        payload: {},
        raw: null,
      },
    ].filter((action) => incidentIds.has(action.targetId));

    return {
    generatedAt: "2026-04-11T00:00:00.000Z",
    source: "test",
    storageKind: "file",
    integrationState: "mock",
    canonicalTruth: "sessionId",
    notes: [],
    incidents,
    summary: {
      total: incidents.length,
      open: 0,
      retryable: incidents.length,
      failingOver: 0,
      recovered: 0,
      dead: 0,
    },
    operatorActions,
    };
  }),
}));

vi.mock("@/lib/server/control-plane/accounts", () => ({
  listControlPlaneAccounts: vi.fn(async () => []),
}));

import Page from "./page";

describe("execution recoveries route", () => {
  test("scopes the recoveries board by session and initiative query context", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        searchParams: Promise.resolve({
          session_id: "session-scoped",
          initiative_id: "initiative-scoped",
        }),
      }),
    );

    expect(markup).toContain("recovery-scoped");
    expect(markup).toContain("audit-scoped");
    expect(markup).toContain("total:1");
    expect(markup).toContain("retryable:1");
    expect(markup).not.toContain("recovery-global");
    expect(markup).not.toContain("audit-global");
  });
});
