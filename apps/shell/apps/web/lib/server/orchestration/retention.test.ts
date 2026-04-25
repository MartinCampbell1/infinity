import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  readControlPlaneState,
  resetControlPlaneStateForTests,
  updateControlPlaneState,
} from "../control-plane/state/store";
import { createIsolatedControlPlaneStateDir } from "../control-plane/state/test-helpers";

import {
  applyOrchestrationRetentionPlan,
  buildOrchestrationRetentionPlan,
  runOrchestrationRetentionCleanup,
} from "./retention";
import { POST as postRetention } from "../../../app/api/control/orchestration/retention/route";

const ORIGINAL_INTEGRATION_ROOT = process.env.FOUNDEROS_INTEGRATION_ROOT;
const ORIGINAL_SYNTHETIC_SEEDS = process.env.FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS;

const NOW = "2026-04-25T12:00:00.000Z";
const OLD = "2026-04-01T12:00:00.000Z";
const RECENT = "2026-04-25T11:30:00.000Z";

let tempRoot = "";
let restoreStateDir: (() => void) | null = null;

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function deliveryPath(...parts: string[]) {
  return path.join(tempRoot, ".local-state", "orchestration", "deliveries", ...parts);
}

function seedRetentionState() {
  const rejectedRoot = deliveryPath("delivery-rejected");
  const readyRoot = deliveryPath("delivery-ready");
  mkdirSync(rejectedRoot, { recursive: true });
  mkdirSync(readyRoot, { recursive: true });
  writeFileSync(path.join(rejectedRoot, "preview.html"), "<h1>expired</h1>");
  writeFileSync(path.join(rejectedRoot, "manifest.json"), "{}");
  writeFileSync(path.join(readyRoot, "preview.html"), "<h1>ready</h1>");

  return updateControlPlaneState((draft) => {
    draft.orchestration.runs = [
      {
        id: "run-retention",
        initiativeId: "initiative-retention",
        title: "Retention run",
        originalPrompt: "Clean retention artifacts.",
        entryMode: "shell_chat",
        currentStage: "failed",
        health: "failed",
        automationMode: "autonomous",
        manualStageProgression: false,
        operatorOverrideActive: false,
        previewStatus: "failed",
        handoffStatus: "failed",
        createdAt: OLD,
        updatedAt: OLD,
      },
    ];
    draft.orchestration.deliveries = [
      {
        id: "delivery-rejected",
        initiativeId: "initiative-retention",
        verificationRunId: "verification-retention",
        resultSummary: "Rejected delivery.",
        localOutputPath: rejectedRoot,
        manifestPath: path.join(rejectedRoot, "manifest.json"),
        previewUrl: null,
        launchManifestPath: null,
        status: "rejected",
        deliveredAt: OLD,
      },
      {
        id: "delivery-ready",
        initiativeId: "initiative-retention",
        verificationRunId: "verification-ready",
        resultSummary: "Ready delivery.",
        localOutputPath: readyRoot,
        manifestPath: path.join(readyRoot, "manifest.json"),
        previewUrl: null,
        launchManifestPath: null,
        status: "ready",
        deliveredAt: OLD,
      },
    ];
    draft.orchestration.previewTargets = [
      {
        id: "preview-expired",
        runId: "run-retention",
        deliveryId: "delivery-rejected",
        mode: "local",
        url: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-expired",
        healthStatus: "failed",
        sourcePath: path.join(rejectedRoot, "preview.html"),
        createdAt: OLD,
        updatedAt: OLD,
      },
      {
        id: "preview-ready",
        runId: "run-retention",
        deliveryId: "delivery-ready",
        mode: "local",
        url: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-ready",
        healthStatus: "ready",
        sourcePath: path.join(readyRoot, "preview.html"),
        createdAt: OLD,
        updatedAt: OLD,
      },
      {
        id: "preview-recent",
        runId: "run-retention",
        deliveryId: "delivery-rejected",
        mode: "local",
        url: "http://127.0.0.1:3737/api/control/orchestration/previews/preview-recent",
        healthStatus: "failed",
        sourcePath: path.join(rejectedRoot, "recent-preview.html"),
        createdAt: RECENT,
        updatedAt: RECENT,
      },
    ];
    draft.orchestration.handoffPackets = [
      {
        id: "handoff-expired",
        runId: "run-retention",
        deliveryId: "delivery-rejected",
        status: "failed",
        rootPath: rejectedRoot,
        finalSummaryPath: path.join(rejectedRoot, "final-summary.md"),
        manifestPath: path.join(rejectedRoot, "manifest.json"),
        createdAt: OLD,
        updatedAt: OLD,
      },
    ];
    draft.orchestration.agentSessions = [
      {
        id: "agent-stale",
        runId: "run-retention",
        batchId: "batch-retention",
        workItemId: "work-unit-retention",
        attemptId: "attempt-retention",
        agentKind: "worker",
        status: "running",
        runtimeRef: "attempt-retention",
        startedAt: OLD,
        finishedAt: null,
      },
      {
        id: "agent-recent",
        runId: "run-retention",
        batchId: "batch-retention",
        workItemId: "work-unit-recent",
        attemptId: "attempt-recent",
        agentKind: "worker",
        status: "running",
        runtimeRef: "attempt-recent",
        startedAt: RECENT,
        finishedAt: null,
      },
    ];
  });
}

beforeEach(() => {
  tempRoot = mkdtempSync(path.join(tmpdir(), "infinity-retention-"));
  process.env.FOUNDEROS_INTEGRATION_ROOT = tempRoot;
  process.env.FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS = "0";
  restoreStateDir = createIsolatedControlPlaneStateDir().restore;
});

afterEach(() => {
  resetControlPlaneStateForTests();
  restoreStateDir?.();
  restoreStateDir = null;
  restoreEnv("FOUNDEROS_INTEGRATION_ROOT", ORIGINAL_INTEGRATION_ROOT);
  restoreEnv("FOUNDEROS_ENABLE_SYNTHETIC_STATE_SEEDS", ORIGINAL_SYNTHETIC_SEEDS);
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true });
    tempRoot = "";
  }
});

describe("orchestration retention cleanup", () => {
  test("plans expired previews, failed handoffs, rejected local artifacts, and stale lease mirrors", async () => {
    await seedRetentionState();
    const state = await readControlPlaneState();
    const plan = buildOrchestrationRetentionPlan(state, {
      now: NOW,
      dryRun: true,
    });

    expect(plan.expiredPreviewTargetIds).toEqual(["preview-expired"]);
    expect(plan.expiredHandoffPacketIds).toEqual(["handoff-expired"]);
    expect(plan.staleAgentSessionIds).toEqual(["agent-stale"]);
    expect(plan.localArtifactPaths).toContain(deliveryPath("delivery-rejected"));
    expect(plan.localArtifactPaths).not.toContain(deliveryPath("delivery-ready"));
    expect(plan.notes.join("\n")).toContain("object-store lifecycle");
  });

  test("applies state cleanup without deleting ready delivery artifacts", async () => {
    await seedRetentionState();
    const state = await readControlPlaneState();
    const plan = buildOrchestrationRetentionPlan(state, {
      now: NOW,
    });

    await updateControlPlaneState((draft) => {
      applyOrchestrationRetentionPlan(draft, plan);
    });

    const next = await readControlPlaneState();
    expect(next.orchestration.previewTargets.map((preview) => preview.id)).toEqual([
      "preview-ready",
      "preview-recent",
    ]);
    expect(next.orchestration.handoffPackets).toEqual([]);
    expect(next.orchestration.agentSessions.find((session) => session.id === "agent-stale"))
      .toEqual(
        expect.objectContaining({
          status: "failed",
          finishedAt: NOW,
        }),
      );
    expect(next.orchestration.agentSessions.find((session) => session.id === "agent-recent"))
      .toEqual(expect.objectContaining({ status: "running", finishedAt: null }));
    expect(next.orchestration.runEvents[0]).toEqual(
      expect.objectContaining({
        kind: "agent.session.retention_recovered",
        runId: "run-retention",
      }),
    );
    expect(existsSync(deliveryPath("delivery-ready", "preview.html"))).toBe(true);
  });

  test("retention job supports dry-run and explicit filesystem cleanup", async () => {
    await seedRetentionState();

    const dryRun = await runOrchestrationRetentionCleanup({
      now: NOW,
      dryRun: true,
      applyFilesystem: true,
    });
    expect(dryRun.removedLocalArtifactPaths).toEqual([]);
    expect(existsSync(deliveryPath("delivery-rejected", "preview.html"))).toBe(true);

    const result = await runOrchestrationRetentionCleanup({
      now: NOW,
      applyFilesystem: true,
    });

    expect(result.filesystemErrors).toEqual([]);
    expect(result.removedLocalArtifactPaths).toContain(deliveryPath("delivery-rejected"));
    expect(existsSync(deliveryPath("delivery-rejected"))).toBe(false);
    expect(existsSync(deliveryPath("delivery-ready", "preview.html"))).toBe(true);
  });

  test("control-plane retention route defaults to dry-run", async () => {
    await seedRetentionState();

    const response = await postRetention(
      new Request("http://localhost/api/control/orchestration/retention", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-founderos-actor-type": "service",
          "x-founderos-actor-id": "retention-worker",
          "x-founderos-tenant-id": "default",
          "x-founderos-request-id": "request-retention-test",
          "x-founderos-auth-boundary": "token",
        },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.actor.actorId).toBe("retention-worker");
    expect(body.plan.dryRun).toBe(true);
    expect(body.plan.expiredPreviewTargetIds).toEqual(["preview-expired"]);
    expect(existsSync(deliveryPath("delivery-rejected", "preview.html"))).toBe(true);
  });
});
