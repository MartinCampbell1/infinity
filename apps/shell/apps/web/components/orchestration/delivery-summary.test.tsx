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
  PlaneDisabledAction: ({
    label,
    reason,
    children,
  }: {
    label: string;
    reason: string;
    children: React.ReactNode;
  }) => (
    <span data-disabled-action={label} data-disabled-action-reason={reason}>
      <button disabled>{children}</button>
    </span>
  ),
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

type DeliverySummaryProps = React.ComponentProps<typeof DeliverySummary>;

function renderPreviewScenario({
  delivery,
  previewTarget = null,
}: {
  delivery: Partial<DeliverySummaryProps["delivery"]>;
  previewTarget?: DeliverySummaryProps["previewTarget"];
}) {
  return withStrictRolloutEnv(undefined, () =>
    renderToStaticMarkup(
      <DeliverySummary
        delivery={{
          id: "delivery-preview-state",
          initiativeId: "initiative-preview-state",
          verificationRunId: "verification-preview-state",
          taskGraphId: "task-graph-preview-state",
          resultSummary: "Preview state fixture.",
          launchProofKind: "runnable_result",
          status: "pending",
          deliveredAt: "2026-04-23T22:01:00.000Z",
          ...delivery,
        }}
        initiativeTitle="Preview state delivery"
        initiativePrompt="Build a preview state fixture."
        verification={{
          id: "verification-preview-state",
          initiativeId: "initiative-preview-state",
          assemblyId: "assembly-preview-state",
          overallStatus: "passed",
          checks: [{ name: "targeted_tests_passed", status: "passed" }],
          startedAt: "2026-04-23T22:00:00.000Z",
          finishedAt: "2026-04-23T22:00:00.000Z",
        }}
        assembly={{
          id: "assembly-preview-state",
          initiativeId: "initiative-preview-state",
          taskGraphId: "task-graph-preview-state",
          inputWorkUnitIds: ["work-unit-preview-state"],
          artifactUris: [],
          outputLocation: "r2://infinity-artifacts/staging/preview-state",
          summary: "Preview state assembly.",
          status: "assembled",
          createdAt: "2026-04-23T22:00:00.000Z",
          updatedAt: "2026-04-23T22:00:00.000Z",
        }}
        taskGraphId="task-graph-preview-state"
        runId="run-preview-state"
        handoffId={null}
        sourceWorkUnits={[]}
        previewTarget={previewTarget}
      />,
    ),
  );
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
    expect(markup).toContain("Local proof");
    expect(markup).toContain('data-readiness-badge-tier="local_solo"');
    expect(markup).toContain('data-readiness-checklist="delivery-proof"');
    expect(markup).toContain("Readiness tier");
    expect(markup).toContain("local_solo");
    expect(markup).not.toContain("Handoff-ready result");
    expect(markup).not.toContain("Handoff ready");
    expect(markup).toContain("Local preview proof");
    expect(markup).toContain("Generated invoice app is ready.");
    expect(markup).toContain(">Pending<");
    expect(markup).not.toContain(">Delivered<");
    expect(markup).not.toContain("Primary handoff");
    expect(markup).not.toContain("Handoff packet");
    expect(markup).not.toContain("/execution/handoffs/handoff-proof-001");
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
    expect(markup).toContain("Staging proof");
    expect(markup).toContain('data-readiness-badge-tier="staging"');
    expect(markup).toContain('data-readiness-check="hosted_preview"');
    expect(markup).toContain('data-readiness-check-satisfied="false"');
    expect(markup).toContain("runnable proof pending");
    expect(markup).toContain(">Pending<");
    expect(markup).toContain("Open task graph");
    expect(markup).toContain("Review local preview");
    expect(markup).toContain("Hosted preview proof missing");
    expect(markup).toContain('data-disabled-proof-action="Open hosted preview"');
    expect(markup).toContain("Pull request proof missing");
    expect(markup).toContain('data-disabled-proof-action="Open pull request"');
    expect(markup).toContain('data-disabled-action="Resume w/ prompt"');
    expect(markup).toContain("Resume with prompt is not wired on the delivery summary");
    expect(markup).toContain('data-disabled-action="Archive"');
    expect(markup).toContain("Archive requires a durable delivery action route");
    expect(markup).toContain("[local workspace path]");
    expect(markup).not.toContain("/Users/martin/infinity");
    expect(markup).not.toContain("Handoff packet");
    expect(markup).not.toContain("Open handoff packet");
    expect(markup).not.toContain("/execution/handoffs/handoff-pending-proof-001");
    expect(markup).not.toContain(">Delivered<");
    expect(markup).not.toContain(">Ready<");
  });

  test("renders object-store artifact proof rows without local file links", () => {
    const markup = withStrictRolloutEnv("1", () => renderToStaticMarkup(
      <DeliverySummary
        delivery={{
          id: "delivery-object-proof-001",
          initiativeId: "initiative-object-proof-001",
          verificationRunId: "verification-object-proof-001",
          taskGraphId: "task-graph-object-proof-001",
          resultSummary: "Runnable proof exists, external preview and CI proof are still pending.",
          localOutputPath: null,
          manifestPath: "r2://infinity-artifacts/prod/deliveries/delivery-object-proof-001/signed-artifact-manifest.json",
          previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-object-proof-001",
          launchManifestPath: "r2://infinity-artifacts/prod/deliveries/delivery-object-proof-001/launch/launch-manifest.json",
          launchProofKind: "runnable_result",
          launchTargetLabel: "Object-backed runnable result",
          launchProofUrl: "http://127.0.0.1:4102",
          launchProofAt: "2026-04-23T22:00:00.000Z",
          externalProofManifestPath: "r2://infinity-artifacts/prod/deliveries/delivery-object-proof-001/signed-artifact-manifest.json",
          artifactStorageUri: "r2://infinity-artifacts/prod/deliveries/delivery-object-proof-001",
          signedManifestUri: "https://artifacts.infinity.example/download?key=deliveries%2Fdelivery-object-proof-001%2Fsigned-artifact-manifest.json&amp;signature=abc",
          command: null,
          readinessTier: "staging",
          status: "pending",
          deliveredAt: "2026-04-23T22:01:00.000Z",
        }}
        initiativeTitle="Object-backed strict rollout"
        initiativePrompt="Build a hosted delivery."
        verification={{
          id: "verification-object-proof-001",
          initiativeId: "initiative-object-proof-001",
          assemblyId: "assembly-object-proof-001",
          overallStatus: "passed",
          checks: [{ name: "targeted_tests_passed", status: "passed" }],
          startedAt: "2026-04-23T22:00:00.000Z",
          finishedAt: "2026-04-23T22:00:00.000Z",
        }}
        assembly={{
          id: "assembly-object-proof-001",
          initiativeId: "initiative-object-proof-001",
          taskGraphId: "task-graph-object-proof-001",
          inputWorkUnitIds: ["work-unit-final"],
          artifactUris: ["r2://infinity-artifacts/prod/assemblies/initiative-object-proof-001/work-unit-final.json"],
          outputLocation: "r2://infinity-artifacts/prod/assemblies/initiative-object-proof-001",
          manifestPath: "r2://infinity-artifacts/prod/assemblies/initiative-object-proof-001/signed-artifact-manifest.json",
          summary: "Assembled source work units.",
          status: "assembled",
          createdAt: "2026-04-23T22:00:00.000Z",
          updatedAt: "2026-04-23T22:00:00.000Z",
        }}
        taskGraphId="task-graph-object-proof-001"
        runId="run-object-proof-001"
        handoffId="handoff-object-proof-001"
        sourceWorkUnits={[]}
      />,
    ));

    expect(markup).toContain("Artifact storage");
    expect(markup).toContain("Signed manifest");
    expect(markup).toContain("r2://infinity-artifacts/prod/deliveries/delivery-object-proof-001");
    expect(markup).toContain("https://artifacts.infinity.example/download");
    expect(markup).toContain('data-proof-row-label="Signed manifest"');
    expect(markup).not.toContain("file://");
    expect(markup).not.toContain("/Users/martin/infinity");
    expect(markup).not.toContain("Launch command");
  });

  test("renders production external delivery actions for PR and hosted preview", () => {
    const markup = withStrictRolloutEnv("1", () => renderToStaticMarkup(
      <DeliverySummary
        delivery={{
          id: "delivery-production-proof-001",
          initiativeId: "initiative-production-proof-001",
          verificationRunId: "verification-production-proof-001",
          taskGraphId: "task-graph-production-proof-001",
          resultSummary: "Production proof is attached.",
          localOutputPath: null,
          manifestPath: "r2://infinity-artifacts/prod/deliveries/delivery-production-proof-001/delivery-manifest.json",
          previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-production-proof-001",
          launchManifestPath: "r2://infinity-artifacts/prod/deliveries/delivery-production-proof-001/launch/launch-manifest.json",
          launchProofKind: "runnable_result",
          launchTargetLabel: "Object-backed runnable result",
          launchProofUrl: "http://127.0.0.1:4102",
          launchProofAt: "2026-04-23T22:00:00.000Z",
          externalPullRequestUrl: "https://github.com/founderos/infinity/pull/124",
          externalPullRequestId: "github-pr-delivery-production-proof-001",
          externalPreviewUrl: "https://delivery-production-proof-001.preview.infinity.example",
          externalPreviewProvider: "vercel",
          externalPreviewDeploymentId: "vercel-preview-delivery-production-proof-001",
          externalDeliveryProof: {
            preview: {
              screenshotUrl: "https://delivery-production-proof-001.preview.infinity.example/screenshot.png",
            },
          },
          externalProofManifestPath: "r2://infinity-artifacts/prod/deliveries/delivery-production-proof-001/external-delivery-proof.json",
          ciProofUri: "https://github.com/founderos/infinity/commit/proof-commit-sha/checks",
          ciProofProvider: "github_commit_status",
          ciProofId: "github-status-delivery-production-proof-001",
          artifactStorageUri: "r2://infinity-artifacts/prod/deliveries/delivery-production-proof-001",
          signedManifestUri: "https://artifacts.infinity.example/download?key=deliveries%2Fdelivery-production-proof-001%2Fsigned-artifact-manifest.json&amp;signature=abc",
          command: null,
          readinessTier: "production",
          status: "ready",
          deliveredAt: "2026-04-23T22:01:00.000Z",
        }}
        initiativeTitle="Production strict rollout"
        initiativePrompt="Build a hosted delivery."
        verification={{
          id: "verification-production-proof-001",
          initiativeId: "initiative-production-proof-001",
          assemblyId: "assembly-production-proof-001",
          overallStatus: "passed",
          checks: [{ name: "targeted_tests_passed", status: "passed" }],
          startedAt: "2026-04-23T22:00:00.000Z",
          finishedAt: "2026-04-23T22:00:00.000Z",
        }}
        assembly={{
          id: "assembly-production-proof-001",
          initiativeId: "initiative-production-proof-001",
          taskGraphId: "task-graph-production-proof-001",
          inputWorkUnitIds: ["work-unit-final"],
          artifactUris: ["r2://infinity-artifacts/prod/assemblies/initiative-production-proof-001/work-unit-final.json"],
          outputLocation: "r2://infinity-artifacts/prod/assemblies/initiative-production-proof-001",
          manifestPath: "r2://infinity-artifacts/prod/assemblies/initiative-production-proof-001/signed-artifact-manifest.json",
          summary: "Assembled source work units.",
          status: "assembled",
          createdAt: "2026-04-23T22:00:00.000Z",
          updatedAt: "2026-04-23T22:00:00.000Z",
        }}
        taskGraphId="task-graph-production-proof-001"
        runId="run-production-proof-001"
        handoffId="handoff-production-proof-001"
        sourceWorkUnits={[]}
      />,
    ));

    expect(markup).toContain("Production proof complete");
    expect(markup).toContain("Hosted preview proof");
    expect(markup).toContain("Open pull request");
    expect(markup).toContain("https://github.com/founderos/infinity/pull/124");
    expect(markup).toContain("https://delivery-production-proof-001.preview.infinity.example");
    expect(markup).toContain('data-preview-card-state="ready"');
    expect(markup).toContain('data-preview-screenshot="image"');
    expect(markup).toContain("Delivery preview screenshot");
    expect(markup).toContain("https://delivery-production-proof-001.preview.infinity.example/screenshot.png");
    expect(markup).toContain("Open preview");
    expect(markup).toContain("CI proof");
    expect(markup).not.toContain("file://");
    expect(markup).not.toContain("/Users/martin/infinity");
    expect(markup).not.toContain("Launch command");
  });

  test("shows an expired preview recovery path instead of linking to a failed target", () => {
    const markup = renderPreviewScenario({
      delivery: {
        id: "delivery-preview-expired",
        initiativeId: "initiative-preview-expired",
        previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-expired",
        launchProofAt: "2026-04-23T22:00:00.000Z",
        status: "ready",
      },
      previewTarget: {
        id: "preview-expired",
        runId: "run-preview-state",
        deliveryId: "delivery-preview-expired",
        mode: "local",
        url: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-expired",
        healthStatus: "failed",
        sourcePath: "/tmp/infinity-delivery/expired/preview.html",
        createdAt: "2026-04-23T22:00:00.000Z",
        updatedAt: "2026-04-23T22:05:00.000Z",
      },
    });

    expect(markup).toContain('data-preview-card-state="expired"');
    expect(markup).toContain('data-preview-fallback-state="expired"');
    expect(markup).toContain("Preview expired");
    expect(markup).toContain("Rebuild preview");
    expect(markup).toContain("/execution/continuity/initiative-preview-expired");
    expect(markup).toContain("/execution/task-graphs/task-graph-preview-state");
    expect(markup).not.toContain('data-preview-screenshot="');
    expect(markup).not.toContain('<iframe src="http://127.0.0.1:3737/api/control/orchestration/previews/preview-expired"');
    expect(markup).not.toContain('<a href="http://127.0.0.1:3737/api/control/orchestration/previews/preview-expired"');
  });

  test("shows loading state while a preview target is still pending", () => {
    const markup = renderPreviewScenario({
      delivery: {
        id: "delivery-preview-loading",
        launchProofKind: null,
        status: "pending",
      },
      previewTarget: {
        id: "preview-loading",
        runId: "run-preview-state",
        deliveryId: "delivery-preview-loading",
        mode: "local",
        url: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-loading",
        healthStatus: "pending",
        sourcePath: "/tmp/infinity-delivery/loading/preview.html",
        createdAt: "2026-04-23T22:00:00.000Z",
        updatedAt: "2026-04-23T22:01:00.000Z",
      },
    });

    expect(markup).toContain('data-preview-card-state="loading"');
    expect(markup).toContain('data-preview-fallback-state="loading"');
    expect(markup).toContain("Preview is still building");
    expect(markup).not.toContain("Rebuild preview");
    expect(markup).not.toContain('data-preview-screenshot="');
  });

  test("shows error recovery when a preview target fails before a URL is usable", () => {
    const markup = renderPreviewScenario({
      delivery: {
        id: "delivery-preview-error",
        previewUrl: null,
        launchProofKind: null,
        status: "pending",
      },
      previewTarget: {
        id: "preview-error",
        runId: "run-preview-state",
        deliveryId: "delivery-preview-error",
        mode: "local",
        url: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-error",
        healthStatus: "failed",
        sourcePath: "/tmp/infinity-delivery/error/preview.html",
        createdAt: "2026-04-23T22:00:00.000Z",
        updatedAt: "2026-04-23T22:05:00.000Z",
      },
    });

    expect(markup).toContain('data-preview-card-state="error"');
    expect(markup).toContain('data-preview-fallback-state="error"');
    expect(markup).toContain("Preview failed");
    expect(markup).toContain("Rebuild preview");
    expect(markup).toContain("/execution/continuity/initiative-preview-state");
    expect(markup).not.toContain('data-preview-screenshot="');
  });

  test("shows rebuild state for scaffold previews without a usable target", () => {
    const markup = renderPreviewScenario({
      delivery: {
        id: "delivery-preview-rebuild",
        previewUrl: null,
        launchProofKind: "synthetic_wrapper",
        status: "pending",
      },
    });

    expect(markup).toContain('data-preview-card-state="rebuild"');
    expect(markup).toContain('data-preview-fallback-state="rebuild"');
    expect(markup).toContain("Preview needs rebuild");
    expect(markup).toContain("Rebuild preview");
    expect(markup).toContain("/execution/continuity/initiative-preview-state");
    expect(markup).toContain("/execution/task-graphs/task-graph-preview-state");
    expect(markup).not.toContain('data-preview-screenshot="');
  });
});
