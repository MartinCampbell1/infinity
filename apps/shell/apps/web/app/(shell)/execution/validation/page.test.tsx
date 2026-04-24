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
  buildExecutionContinuityScopeHref: (initiativeId: string) =>
    `/execution/continuity/${initiativeId}`,
  readShellRouteScopeFromQueryRecord: vi.fn(() => ({})),
}));

vi.mock("@/lib/server/control-plane/state/store", () => ({
  readControlPlaneState: vi.fn(async () => ({
    orchestration: {
      runs: [
        {
          id: "run-stale-proof",
          initiativeId: "initiative-stale-proof",
        },
      ],
      verifications: [
        {
          id: "verification-stale-proof",
          initiativeId: "initiative-stale-proof",
          overallStatus: "passed",
          checks: [{ name: "targeted_tests_passed", status: "passed" }],
          startedAt: "2026-04-24T00:00:00.000Z",
          finishedAt: "2026-04-24T00:01:00.000Z",
        },
      ],
      validationProofs: [
        {
          id: "proof-stale-ready",
          runId: "run-stale-proof",
          eventTimelinePath: "/tmp/proof/event-timeline.jsonl",
          previewReady: true,
          launchReady: true,
          handoffReady: true,
        },
      ],
    },
  })),
}));

vi.mock("@/lib/server/control-plane/workspace/rollout-config", () => ({
  isStrictRolloutEnv: () => true,
}));

vi.mock("@/lib/server/orchestration/delivery", () => ({
  listDeliveries: listDeliveriesMock,
}));

import Page from "./page";

describe("execution validation board", () => {
  test("suppresses stale proof readiness when projected delivery is not handoff-ready", async () => {
    listDeliveriesMock.mockResolvedValueOnce([
      {
        id: "delivery-current-pending-proof",
        initiativeId: "initiative-stale-proof",
        verificationRunId: "verification-stale-proof",
        launchProofKind: "runnable_result",
        launchProofUrl: "http://127.0.0.1:4100/index.html",
        launchProofAt: "2026-04-24T00:01:00.000Z",
        status: "pending",
        readinessTier: "staging",
      },
      {
        id: "delivery-older-ready-proof",
        initiativeId: "initiative-stale-proof",
        verificationRunId: "verification-older-proof",
        launchProofKind: "runnable_result",
        launchProofUrl: "http://127.0.0.1:4200/index.html",
        launchProofAt: "2026-04-23T00:01:00.000Z",
        externalPreviewUrl: "https://preview.infinity.example/older",
        externalProofManifestPath: "s3://infinity/proofs/older.json",
        ciProofUri: "github://checks/older",
        artifactStorageUri: "s3://infinity/artifacts/older",
        signedManifestUri: "s3://infinity/manifests/older.sig",
        status: "ready",
        readinessTier: "production",
      },
    ]);

    const markup = renderToStaticMarkup(
      await Page({ searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain("verification-stale-proof");
    expect(markup).toContain("preview ready · Local solo");
    expect(markup).not.toContain("launch ready");
    expect(markup).not.toContain("handoff packet ready");
  });
});
