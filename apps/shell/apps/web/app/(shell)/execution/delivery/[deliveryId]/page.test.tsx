import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const listDeliveriesMock = vi.hoisted(() =>
  vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
);

vi.mock("@/lib/route-scope", () => ({
  readShellRouteScopeFromQueryRecord: vi.fn(() => ({
    projectId: "",
    intakeSessionId: "",
    sessionId: "session-delivery-missing",
    groupId: "",
    accountId: "",
    workspaceId: "",
  })),
  buildExecutionContinuityScopeHref: (initiativeId: string) =>
    `/execution/continuity/${initiativeId}`,
  buildExecutionHandoffScopeHref: (handoffId: string) =>
    `/execution/handoffs/${handoffId}`,
  buildExecutionTaskGraphScopeHref: (taskGraphId: string) =>
    `/execution/task-graphs/${taskGraphId}`,
}));

vi.mock("@/components/orchestration/delivery-summary", () => ({
  DeliverySummary: ({
    delivery,
    previewTarget,
  }: {
    delivery: { status: string; readinessTier?: string | null };
    previewTarget?: { healthStatus?: string | null } | null;
  }) => (
    <section>
      Delivery summary mock status {delivery.status} tier{" "}
      {delivery.readinessTier ?? "unknown"} preview{" "}
      {previewTarget?.healthStatus ?? "unknown"}
    </section>
  ),
}));

vi.mock("@/lib/server/orchestration/delivery", () => ({
  listDeliveries: listDeliveriesMock,
}));

vi.mock("@/lib/server/control-plane/state/store", () => ({
  readControlPlaneState: vi.fn(async () => ({
    orchestration: {
      deliveries: [],
      verifications: [
        {
          id: "verification-blocked-001",
          initiativeId: "initiative-delivery-missing",
          assemblyId: "",
          overallStatus: "failed",
          checks: [
            {
              name: "targeted_tests_passed",
              status: "failed",
              details: "Generated app tests failed.",
            },
          ],
          createdAt: "2026-04-23T20:00:00.000Z",
          updatedAt: "2026-04-23T20:00:00.000Z",
        },
      ],
      initiatives: [
        {
          id: "initiative-delivery-missing",
          title: "Blocked delivery",
          userRequest: "Build a blocked app.",
          status: "blocked",
          requestedBy: "martin",
          workspaceSessionId: "session-delivery-missing",
          priority: "normal",
          createdAt: "2026-04-23T20:00:00.000Z",
          updatedAt: "2026-04-23T20:00:00.000Z",
        },
      ],
      runs: [],
      assemblies: [],
      handoffPackets: [],
      previewTargets: [
        {
          id: "preview-stale-ready",
          runId: "run-stale-ready",
          deliveryId: "delivery-stale-ready",
          mode: "local",
          url: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-stale-ready",
          healthStatus: "failed",
          sourcePath: "/tmp/infinity-delivery/stale/preview.html",
          createdAt: "2026-04-23T20:00:00.000Z",
          updatedAt: "2026-04-23T20:05:00.000Z",
        },
      ],
      workUnits: [],
    },
  })),
}));

import Page from "./page";

describe("execution delivery detail route", () => {
  test("explains the failed gate and links to continuity when delivery is absent", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ deliveryId: "delivery-missing" }),
        searchParams: Promise.resolve({
          initiative_id: "initiative-delivery-missing",
          session_id: "session-delivery-missing",
        }),
      }),
    );

    expect(markup).toContain("Delivery is not ready");
    expect(markup).toContain("targeted_tests_passed");
    expect(markup).toContain("Generated app tests failed.");
    expect(markup).toContain("/execution/continuity/initiative-delivery-missing");
  });

  test("renders projected delivery records instead of raw stale ready state", async () => {
    listDeliveriesMock.mockResolvedValueOnce([
      {
        id: "delivery-stale-ready",
        initiativeId: "initiative-delivery-missing",
        verificationRunId: "verification-blocked-001",
        resultSummary: "Projected stale ready delivery.",
        launchProofKind: "runnable_result",
        launchProofUrl: "http://127.0.0.1:4100/index.html",
        launchProofAt: "2026-04-23T20:00:00.000Z",
        status: "pending",
        readinessTier: "staging",
      },
    ]);

    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ deliveryId: "delivery-stale-ready" }),
        searchParams: Promise.resolve({
          initiative_id: "initiative-delivery-missing",
        }),
      }),
    );

    expect(markup).toContain("Delivery summary mock status pending tier staging preview failed");
    expect(markup).not.toContain("status ready");
  });
});
