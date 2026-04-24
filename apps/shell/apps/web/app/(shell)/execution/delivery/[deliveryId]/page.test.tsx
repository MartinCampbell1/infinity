import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

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
  DeliverySummary: () => <section>Delivery summary mock</section>,
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
});
