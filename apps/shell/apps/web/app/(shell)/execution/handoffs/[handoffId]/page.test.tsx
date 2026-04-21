import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/route-scope", () => ({
  readShellRouteScopeFromQueryRecord: vi.fn(() => ({
    projectId: "",
    intakeSessionId: "",
    sessionId: "",
    groupId: "",
    accountId: "",
    workspaceId: "",
  })),
  buildExecutionContinuityScopeHref: vi.fn((initiativeId: string) => `/execution/continuity/${initiativeId}`),
  buildExecutionDeliveryScopeHref: vi.fn((deliveryId: string) => `/execution/delivery/${deliveryId}`),
}));

vi.mock("@/lib/server/control-plane/state/store", () => ({
  readControlPlaneState: vi.fn(async () => ({
    orchestration: {
      handoffPackets: [
        {
          id: "handoff-1",
          runId: "run-1",
          deliveryId: "delivery-1",
          status: "ready",
          rootPath: "/tmp/handoff-1",
          finalSummaryPath: "/tmp/handoff-1/final-summary.md",
          manifestPath: "/tmp/handoff-1/manifest.json",
          createdAt: "2026-04-20T01:00:00.000Z",
          updatedAt: "2026-04-20T01:10:00.000Z",
        },
      ],
      runs: [
        {
          id: "run-1",
          initiativeId: "initiative-1",
          title: "Atlas delivery run",
        },
      ],
      deliveries: [
        {
          id: "delivery-1",
          initiativeId: "initiative-1",
        },
      ],
    },
  })),
}));

import Page from "./page";

describe("handoff detail route", () => {
  test("renders the dark shell handoff detail", async () => {
    const markup = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ handoffId: "handoff-1" }),
      })
    );

    expect(markup).toContain("Handoff Packet");
    expect(markup).toContain("handoff-1");
    expect(markup).toContain("Atlas delivery run");
    expect(markup).toContain("/tmp/handoff-1/final-summary.md");
    expect(markup).toContain("Open delivery");
    expect(markup).toContain("Open continuity");
  });
});
