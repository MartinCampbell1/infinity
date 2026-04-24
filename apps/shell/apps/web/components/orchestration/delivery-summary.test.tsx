import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/route-scope", () => ({
  buildExecutionContinuityScopeHref: (initiativeId: string) =>
    `/execution/continuity/${initiativeId}`,
  buildExecutionHandoffScopeHref: (handoffId: string) =>
    `/execution/handoffs/${handoffId}`,
  buildExecutionTaskGraphScopeHref: (taskGraphId: string) =>
    `/execution/task-graphs/${taskGraphId}`,
}));

vi.mock("@/lib/server/orchestration/claude-design-presentation", () => ({
  getClaudeDisplayRunId: (value: string | null | undefined) => value ?? "run",
}));

vi.mock("@/components/execution/plane-run-primitives", () => ({
  PlaneButton: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <button className={className}>{children}</button>,
  PlaneStatusPill: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

import { DeliverySummary } from "./delivery-summary";

function withStrictRolloutEnv<T>(value: string | undefined, callback: () => T) {
  const previous = process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  if (value === undefined) {
    delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  } else {
    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = value;
  }

  try {
    return callback();
  } finally {
    if (previous === undefined) {
      delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
    } else {
      process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = previous;
    }
  }
}

describe("DeliverySummary", () => {
  test("renders explicit runnable-result proof fields and source work units", () => {
    const markup = withStrictRolloutEnv(undefined, () => renderToStaticMarkup(
      <DeliverySummary
        delivery={{
          id: "delivery-proof-001",
          initiativeId: "initiative-proof-001",
          verificationRunId: "verification-proof-001",
          taskGraphId: "task-graph-proof-001",
          resultSummary: "Generated invoice app is ready.",
          localOutputPath: "/tmp/infinity-delivery/invoice-app",
          manifestPath: "/tmp/infinity-delivery/invoice-app/delivery-manifest.json",
          previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-proof-001",
          launchManifestPath: "/tmp/infinity-delivery/invoice-app/launch-manifest.json",
          launchProofKind: "runnable_result",
          launchTargetLabel: "Invoice generator",
          launchProofUrl: "http://127.0.0.1:4100",
          launchProofAt: "2026-04-23T20:00:00.000Z",
          command: "python3 /Users/martin/infinity/.control-plane/orchestration/assemblies/assembly-proof-001/runnable-result/launch-localhost.py --port 0 --entry /index.html",
          status: "ready",
          deliveredAt: "2026-04-23T20:01:00.000Z",
        }}
        initiativeTitle="Invoice generator"
        initiativePrompt="Build a tiny invoice generator."
        verification={{
          id: "verification-proof-001",
          initiativeId: "initiative-proof-001",
          assemblyId: "assembly-proof-001",
          overallStatus: "passed",
          checks: [{ name: "targeted_tests_passed", status: "passed" }],
          startedAt: "2026-04-23T20:00:00.000Z",
          finishedAt: "2026-04-23T20:00:00.000Z",
        }}
        assembly={{
          id: "assembly-proof-001",
          initiativeId: "initiative-proof-001",
          taskGraphId: "task-graph-proof-001",
          inputWorkUnitIds: ["work-unit-ui"],
          artifactUris: ["file:///tmp/infinity-delivery/invoice-app/work-units/work-unit-ui.json"],
          outputLocation: "/tmp/infinity-delivery/invoice-app",
          summary: "Assembled source work units.",
          status: "assembled",
          createdAt: "2026-04-23T20:00:00.000Z",
          updatedAt: "2026-04-23T20:00:00.000Z",
        }}
        taskGraphId="task-graph-proof-001"
        runId="run-proof-001"
        handoffId="handoff-proof-001"
        sourceWorkUnits={[
          {
            id: "work-unit-ui",
            title: "Build invoice UI",
            latestAttemptId: "attempt-ui-001",
            executorType: "codex",
            scopePaths: ["apps/generated/invoice"],
            acceptanceCriteria: ["Totals update when tax percent changes."],
            status: "completed",
          },
        ]}
      />,
    ));

    expect(markup).toContain("Result summary");
    expect(markup).toContain("Local runnable proof");
    expect(markup).toContain("Readiness tier");
    expect(markup).toContain("local_solo");
    expect(markup).not.toContain("Handoff-ready result");
    expect(markup).not.toContain("Handoff ready");
    expect(markup).toContain("Generated invoice app is ready.");
    expect(markup).toContain('data-delivery-proof-grid="grouped"');
    expect(markup).toContain("2xl:grid-cols-2");
    expect(markup).toContain('data-proof-drawer="all-values"');
    expect(markup).toContain("All proof values");
    expect(markup).toContain("Preview URL");
    expect(markup).toContain('data-proof-row-label="Preview URL"');
    expect(markup).toContain('data-proof-value-label="Preview URL"');
    expect(markup).toContain('data-copy-proof-label="Preview URL"');
    expect(markup).toContain('aria-label="Copy Preview URL"');
    expect(markup).toContain("http://127.0.0.1:3737/api/control/orchestration/previews/preview-proof-001");
    expect(markup).toContain("Manifest path");
    expect(markup).toContain('data-proof-value-label="Manifest path"');
    expect(markup).toContain('data-copy-proof-label="Manifest path"');
    expect(markup).toContain("/tmp/infinity-delivery/invoice-app/delivery-manifest.json");
    expect(markup).toContain("/tmp/.../invoice-app/delivery-manifest.json");
    expect(markup).toContain("Local output path");
    expect(markup).toContain("/tmp/infinity-delivery/invoice-app");
    expect(markup).toContain("Launch command");
    expect(markup).toContain('data-proof-row-label="Launch command"');
    expect(markup).toContain('data-proof-value-label="Launch command"');
    expect(markup).toContain('data-copy-proof-label="Launch command"');
    expect(markup).toContain("python3 .../launch-localhost.py --port 0 --entry /index.html");
    expect(markup).toContain("/Users/martin/infinity/.control-plane/orchestration/assemblies/assembly-proof-001/runnable-result/launch-localhost.py");
    expect(markup).toContain("Proof kind");
    expect(markup).toContain("runnable_result");
    expect(markup).toContain("External proof manifest");
    expect(markup).toContain("not attached");
    expect(markup).toContain('data-secondary-evidence="source-work-units"');
    expect(markup).toContain("Secondary source evidence");
    expect(markup).toContain("Source work units");
    expect(markup).toContain("work-unit-ui");
    expect(markup).toContain("Build invoice UI");
    expect(markup).toContain("attempt-ui-001");
  });

  test("does not expose primary handoff actions for strict rollout stale ready runnable proof", () => {
    const markup = withStrictRolloutEnv("1", () => renderToStaticMarkup(
      <DeliverySummary
        delivery={{
          id: "delivery-pending-proof-001",
          initiativeId: "initiative-pending-proof-001",
          verificationRunId: "verification-pending-proof-001",
          taskGraphId: "task-graph-pending-proof-001",
          resultSummary: "Runnable proof exists, but external rollout proof is missing.",
          localOutputPath: "/tmp/infinity-delivery/pending-app",
          manifestPath: "/tmp/infinity-delivery/pending-app/delivery-manifest.json",
          previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-pending-001",
          launchManifestPath: "/tmp/infinity-delivery/pending-app/launch-manifest.json",
          launchProofKind: "runnable_result",
          launchTargetLabel: "Pending strict rollout preview",
          launchProofUrl: "http://127.0.0.1:4101",
          launchProofAt: "2026-04-23T21:00:00.000Z",
          command: "python3 /Users/martin/infinity/.control-plane/orchestration/assemblies/assembly-pending-001/runnable-result/launch-localhost.py --port 0 --entry /index.html",
          status: "ready",
          deliveredAt: "2026-04-23T21:01:00.000Z",
        }}
        initiativeTitle="Pending strict rollout app"
        initiativePrompt="Build a tiny app."
        verification={{
          id: "verification-pending-proof-001",
          initiativeId: "initiative-pending-proof-001",
          assemblyId: "assembly-pending-proof-001",
          overallStatus: "passed",
          checks: [{ name: "targeted_tests_passed", status: "passed" }],
          startedAt: "2026-04-23T21:00:00.000Z",
          finishedAt: "2026-04-23T21:00:00.000Z",
        }}
        assembly={{
          id: "assembly-pending-proof-001",
          initiativeId: "initiative-pending-proof-001",
          taskGraphId: "task-graph-pending-proof-001",
          inputWorkUnitIds: ["work-unit-final"],
          artifactUris: ["file:///tmp/infinity-delivery/pending-app/work-units/work-unit-final.json"],
          outputLocation: "/tmp/infinity-delivery/pending-app",
          summary: "Assembled source work units.",
          status: "assembled",
          createdAt: "2026-04-23T21:00:00.000Z",
          updatedAt: "2026-04-23T21:00:00.000Z",
        }}
        taskGraphId="task-graph-pending-proof-001"
        runId="run-pending-proof-001"
        handoffId="handoff-pending-proof-001"
        sourceWorkUnits={[]}
      />,
    ));

    expect(markup).toContain("Runnable proof review");
    expect(markup).toContain("Staging proof review");
    expect(markup).toContain("Staging runnable proof");
    expect(markup).toContain("runnable proof pending");
    expect(markup).toContain("Open task graph");
    expect(markup).toContain("Open preview");
    expect(markup).not.toContain("Handoff packet");
    expect(markup).not.toContain("Open handoff packet");
    expect(markup).not.toContain("/execution/handoffs/handoff-pending-proof-001");
    expect(markup).not.toContain(">Delivered<");
  });
});
