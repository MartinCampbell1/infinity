import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { readControlPlaneState } from "../control-plane/state/store";
import { createIsolatedControlPlaneStateDir } from "../control-plane/state/test-helpers";
import { buildAutonomousValidationProof } from "./autonomous-run";

const ORIGINAL_INTEGRATION_ROOT = process.env.FOUNDEROS_INTEGRATION_ROOT;

let isolatedState:
  | ReturnType<typeof createIsolatedControlPlaneStateDir>
  | null = null;

beforeEach(() => {
  isolatedState = createIsolatedControlPlaneStateDir();
  process.env.FOUNDEROS_INTEGRATION_ROOT = isolatedState.directory;
});

afterEach(() => {
  if (ORIGINAL_INTEGRATION_ROOT === undefined) {
    delete process.env.FOUNDEROS_INTEGRATION_ROOT;
  } else {
    process.env.FOUNDEROS_INTEGRATION_ROOT = ORIGINAL_INTEGRATION_ROOT;
  }

  isolatedState?.restore();
  isolatedState = null;
});

describe("buildAutonomousValidationProof", () => {
  test("derives one-prompt autonomy from the latest brief instead of hardcoding it", async () => {
    const state = await readControlPlaneState();
    const initiativeId = "initiative-proof-1";
    const runId = "run-proof-1";

    state.orchestration.initiatives = [
      {
        id: initiativeId,
        title: "Manual brief validation",
        userRequest: "Validate a manually staged run.",
        requestedBy: "martin",
        workspaceSessionId: null,
        priority: "normal",
        status: "verifying",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:00.000Z",
      },
    ];
    state.orchestration.briefs = [
      {
        id: "brief-proof-1",
        initiativeId,
        summary: "Manually authored brief.",
        goals: [],
        nonGoals: [],
        constraints: [],
        assumptions: [],
        acceptanceCriteria: [],
        repoScope: [],
        deliverables: [],
        clarificationLog: [],
        status: "approved",
        authoredBy: "droid-spec-writer",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:01.000Z",
      },
    ];
    state.orchestration.runs = [
      {
        id: runId,
        initiativeId,
        title: "Manual brief validation",
        originalPrompt: "Validate a manually staged run.",
        entryMode: "shell_chat",
        currentStage: "handed_off",
        health: "healthy",
        automationMode: "autonomous",
        manualStageProgression: false,
        operatorOverrideActive: false,
        previewStatus: "ready",
        handoffStatus: "ready",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:02.000Z",
        completedAt: "2026-04-22T00:00:02.000Z",
      },
    ];
    state.orchestration.previewTargets = [
      {
        id: "preview-proof-1",
        runId,
        deliveryId: "delivery-proof-1",
        mode: "local",
        url: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-proof-1",
        healthStatus: "ready",
        launchCommand: null,
        sourcePath: "/tmp/preview.html",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:02.000Z",
      },
    ];
    state.orchestration.handoffPackets = [
      {
        id: "handoff-proof-1",
        runId,
        deliveryId: "delivery-proof-1",
        status: "ready",
        rootPath: "/tmp/delivery",
        finalSummaryPath: "/tmp/delivery/final-summary.md",
        manifestPath: "/tmp/delivery/manifest.json",
        createdAt: "2026-04-22T00:00:00.000Z",
        updatedAt: "2026-04-22T00:00:02.000Z",
      },
    ];
    state.orchestration.deliveries = [
      {
        id: "delivery-proof-1",
        initiativeId,
        verificationRunId: "verification-proof-1",
        taskGraphId: "task-graph-proof-1",
        resultSummary: "Runnable localhost delivery bundle backed by verified assembly evidence.",
        localOutputPath: "/tmp/delivery",
        manifestPath: "/tmp/delivery/delivery-manifest.json",
        previewUrl: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-proof-1",
        launchManifestPath: "/tmp/delivery/launch-manifest.json",
        launchProofKind: "runnable_result",
        launchTargetLabel: "Integrated product preview",
        launchProofUrl: "http://127.0.0.1:4100/index.html",
        launchProofAt: "2026-04-22T00:00:02.000Z",
        handoffNotes: "ready",
        command: "python3 launch.py --port 0",
        status: "ready",
        deliveredAt: "2026-04-22T00:00:02.000Z",
      },
    ];

    const proof = buildAutonomousValidationProof(state, initiativeId);

    expect(proof).toBeTruthy();
    expect(proof?.autonomousOnePrompt).toBe(false);
    expect(proof?.manualStageProgression).toBe(true);
    expect(proof?.launchReady).toBe(true);
    expect(proof?.handoffReady).toBe(true);
  });
});
