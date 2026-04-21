import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/route-scope", () => ({
  readShellRouteScopeFromQueryRecord: vi.fn(() => undefined),
}));

vi.mock("@/components/execution/execution-home-surface", () => ({
  ExecutionHomeSurface: ({
    currentInitiative,
    currentBatch,
    currentDelivery,
    kernelAvailability,
  }: {
    currentInitiative: { title: string } | null;
    currentBatch: { id: string } | null;
    currentDelivery: { id: string } | null;
    kernelAvailability: { available: boolean; baseUrl: string; detail: string };
  }) => (
    <section data-execution-home="true">
      <h1>{currentInitiative?.title ?? "No initiative"}</h1>
      <div>{currentBatch?.id ?? "No batch"}</div>
      <div>{currentDelivery?.id ?? "No delivery"}</div>
      <div>{kernelAvailability.available ? "kernel-ready" : "kernel-offline"}</div>
      <div>{kernelAvailability.baseUrl}</div>
      <div>{kernelAvailability.detail}</div>
    </section>
  ),
}));

vi.mock("@/lib/server/control-plane/approvals", () => ({
  buildApprovalRequestsDirectory: vi.fn(async () => ({
    summary: { pending: 2 },
    requests: [],
    operatorActions: [],
  })),
}));

vi.mock("@/lib/server/control-plane/recoveries", () => ({
  buildRecoveryIncidentsDirectory: vi.fn(async () => ({
    summary: { retryable: 1 },
    incidents: [],
    operatorActions: [],
  })),
}));

vi.mock("@/lib/server/control-plane/audits", () => ({
  buildOperatorActionAuditDirectory: vi.fn(async () => ({
    summary: { total: 3 },
    events: [],
    notes: [],
  })),
}));

vi.mock("@/lib/server/control-plane/accounts", () => ({
  listControlPlaneAccounts: vi.fn(async () => []),
}));

vi.mock("@/lib/server/control-plane/sessions", () => ({
  getExecutionSessionSummaries: vi.fn(async () => []),
}));

vi.mock("@/lib/server/orchestration/initiatives", () => ({
  listOrchestrationInitiatives: vi.fn(async () => [
    {
      id: "initiative-1",
      title: "Atlas launch control plane",
      userRequest: "Build the Atlas launch frontdoor.",
      status: "running",
      requestedBy: "martin",
      workspaceSessionId: "session-1",
      priority: "high",
      createdAt: "2026-04-19T01:00:00.000Z",
      updatedAt: "2026-04-19T01:10:00.000Z",
    },
  ]),
}));

vi.mock("@/lib/server/orchestration/batches", () => ({
  listExecutionBatches: vi.fn(async () => [
    {
      id: "batch-1",
      initiativeId: "initiative-1",
      taskGraphId: "graph-1",
      workUnitIds: ["work-unit-1"],
      concurrencyLimit: 1,
      status: "running",
      startedAt: "2026-04-19T01:06:00.000Z",
      finishedAt: null,
    },
  ]),
  getExecutionKernelAvailability: vi.fn(async () => ({
    available: false,
    baseUrl: "http://127.0.0.1:8787",
    detail:
      "Kernel is offline at http://127.0.0.1:8787. Start ./services/execution-kernel/scripts/run-local.sh before launching autonomous runs.",
    generatedAt: null,
  })),
}));

vi.mock("@/lib/server/orchestration/delivery", () => ({
  listDeliveries: vi.fn(async () => [
    {
      id: "delivery-1",
      initiativeId: "initiative-1",
      verificationRunId: "verification-1",
      resultSummary: "Ready delivery",
      localOutputPath: "http://127.0.0.1:4010",
      manifestPath: "/tmp/delivery-1/manifest.json",
      previewUrl: "http://127.0.0.1:4010",
      command: "npm run preview",
      status: "ready",
      deliveredAt: "2026-04-19T01:30:00.000Z",
    },
  ]),
}));

import Page from "./page";

describe("execution hub route", () => {
  test("passes kernel availability and current orchestration context into the execution home surface", async () => {
    const markup = renderToStaticMarkup(await Page({}));

    expect(markup).toContain("Atlas launch control plane");
    expect(markup).toContain("batch-1");
    expect(markup).toContain("delivery-1");
    expect(markup).toContain("kernel-offline");
    expect(markup).toContain("http://127.0.0.1:8787");
    expect(markup).toContain("run-local.sh");
  });
});
