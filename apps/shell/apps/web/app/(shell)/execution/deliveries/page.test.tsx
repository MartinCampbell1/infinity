import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const listDeliveriesMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/execution/autonomous-record-board", () => ({
  AutonomousRecordBoard: ({
    items,
  }: {
    items: Array<{ id: string; meta: Array<string | null> }>;
  }) => (
    <section>
      {items.map((item) => (
        <article key={item.id}>
          {item.id} {item.meta.filter(Boolean).join(" ")}
        </article>
      ))}
    </section>
  ),
}));

vi.mock("@/lib/route-scope", () => ({
  buildExecutionDeliveryScopeHref: (deliveryId: string) =>
    `/execution/delivery/${deliveryId}`,
  readShellRouteScopeFromQueryRecord: vi.fn(() => ({})),
}));

vi.mock("@/lib/server/control-plane/state/store", () => ({
  readControlPlaneState: vi.fn(async () => ({
    orchestration: {
      initiatives: [
        {
          id: "initiative-stale-ready",
          title: "Strict rollout app",
          userRequest: "Build a strict rollout app.",
        },
      ],
    },
  })),
}));

vi.mock("@/lib/server/orchestration/delivery", () => ({
  listDeliveries: listDeliveriesMock,
}));

import Page from "./page";

describe("execution deliveries board", () => {
  test("renders projected delivery status instead of raw stale ready state", async () => {
    listDeliveriesMock.mockResolvedValueOnce([
      {
        id: "delivery-stale-ready",
        initiativeId: "initiative-stale-ready",
        resultSummary: "Projected stale ready delivery.",
        localOutputPath: "/tmp/infinity-delivery/stale",
        launchProofKind: "runnable_result",
        launchProofUrl: "http://127.0.0.1:4100/index.html",
        launchManifestPath: "/tmp/infinity-delivery/stale/launch-manifest.json",
        status: "pending",
        readinessTier: "staging",
      },
    ]);

    const markup = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain("delivery-stale-ready");
    expect(markup).toContain("status pending");
    expect(markup).not.toContain("status ready");
  });
});
