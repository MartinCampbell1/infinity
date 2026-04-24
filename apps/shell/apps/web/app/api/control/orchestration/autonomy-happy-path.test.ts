import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  readControlPlaneState,
  resetControlPlaneStateForTests,
} from "../../../../lib/server/control-plane/state/store";

import { POST as postBriefs } from "./briefs/route";
import { POST as postInitiatives } from "./initiatives/route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR =
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL =
  process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL =
  process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
const ORIGINAL_EXECUTION_KERNEL_BASE_URL =
  process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
const ORIGINAL_DEPLOYMENT_ENV = process.env.FOUNDEROS_DEPLOYMENT_ENV;
const ORIGINAL_VALIDATION_COMMANDS =
  process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
const ORIGINAL_VALIDATION_COMMANDS_ALLOWED =
  process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
const ORIGINAL_ALLOW_SYNTHETIC_EXECUTION =
  process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION;

let tempStateDir = "";

type KernelBatchRecord = {
  id: string;
  initiativeId: string;
  taskGraphId: string;
  workUnitIds: string[];
  concurrencyLimit: number;
  status: "running" | "completed";
  startedAt: string;
  finishedAt: string | null;
};

type KernelAttemptRecord = {
  id: string;
  workUnitId: string;
  batchId: string;
  executorType: string;
  status: "leased" | "running" | "completed" | "started" | "succeeded";
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  artifactUris: string[];
  errorCode: string | null;
  errorSummary: string | null;
};

function readJsonBody(request: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let raw = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-autonomy-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
  process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON = "1";
  process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON = JSON.stringify(
    [
      {
        name: "static-smoke",
        bucket: "static",
        cwd: "/Users/martin/infinity",
        command: ["node", "-e", "process.exit(0)"],
      },
      {
        name: "test-smoke",
        bucket: "test",
        cwd: "/Users/martin/infinity",
        command: ["node", "-e", "process.exit(0)"],
      },
    ],
  );
  await resetControlPlaneStateForTests();
});

afterEach(async () => {
  await resetControlPlaneStateForTests();

  if (ORIGINAL_CONTROL_PLANE_STATE_DIR === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR =
      ORIGINAL_CONTROL_PLANE_STATE_DIR;
  }

  if (ORIGINAL_CONTROL_PLANE_DATABASE_URL === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL =
      ORIGINAL_CONTROL_PLANE_DATABASE_URL;
  }

  if (ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL === undefined) {
    delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  } else {
    process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL =
      ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL;
  }

  if (ORIGINAL_EXECUTION_KERNEL_BASE_URL === undefined) {
    delete process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
  } else {
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL =
      ORIGINAL_EXECUTION_KERNEL_BASE_URL;
  }
  if (ORIGINAL_DEPLOYMENT_ENV === undefined) {
    delete process.env.FOUNDEROS_DEPLOYMENT_ENV;
  } else {
    process.env.FOUNDEROS_DEPLOYMENT_ENV = ORIGINAL_DEPLOYMENT_ENV;
  }

  if (ORIGINAL_VALIDATION_COMMANDS === undefined) {
    delete process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
  } else {
    process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON =
      ORIGINAL_VALIDATION_COMMANDS;
  }
  if (ORIGINAL_VALIDATION_COMMANDS_ALLOWED === undefined) {
    delete process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
  } else {
    process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON =
      ORIGINAL_VALIDATION_COMMANDS_ALLOWED;
  }
  if (ORIGINAL_ALLOW_SYNTHETIC_EXECUTION === undefined) {
    delete process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION;
  } else {
    process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION =
      ORIGINAL_ALLOW_SYNTHETIC_EXECUTION;
  }

  if (tempStateDir) {
    rmSync(tempStateDir, { recursive: true, force: true });
    tempStateDir = "";
  }
});

describe("autonomous one-prompt orchestration", () => {
  test("intake-authored brief progresses from creation to ready delivery without manual stage posts", async () => {
    process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION = "1";

    const batches = new Map<string, KernelBatchRecord>();
    const attempts = new Map<string, KernelAttemptRecord>();

    const kernelServer = createServer(
      async (request: IncomingMessage, response: ServerResponse) => {
        if (request.method === "POST" && request.url === "/api/v1/batches") {
          const body = await readJsonBody(request);
          const batchId = String(body.batchId);
          const startedAt = "2026-04-19T00:00:00.000Z";
          const workUnits = Array.isArray(body.workUnits)
            ? (body.workUnits as Array<Record<string, unknown>>)
            : [];
          const batch: KernelBatchRecord = {
            id: batchId,
            initiativeId: String(body.initiativeId),
            taskGraphId: String(body.taskGraphId),
            workUnitIds: workUnits.map((workUnit) => String(workUnit.id)),
            concurrencyLimit: Number(body.concurrencyLimit ?? 1),
            status: "running",
            startedAt,
            finishedAt: null,
          };
          batches.set(batchId, batch);

          const launchedAttempts = workUnits.map((workUnit) => {
            const attempt: KernelAttemptRecord = {
              id: `attempt-${batchId}-${String(workUnit.id)}`,
              workUnitId: String(workUnit.id),
              batchId,
              executorType: String(workUnit.executorType ?? "codex"),
              status: "leased",
              startedAt,
              finishedAt: null,
              summary: null,
              artifactUris: [],
              errorCode: null,
              errorSummary: null,
            };
            attempts.set(attempt.id, attempt);
            return attempt;
          });

          response.writeHead(201, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              batch,
              attempts: launchedAttempts,
            }),
          );
          return;
        }

        if (
          request.method === "GET" &&
          request.url?.startsWith("/api/v1/batches/")
        ) {
          const batchId = request.url.split("/").at(-1) ?? "";
          const batch = batches.get(batchId);
          if (!batch) {
            response.writeHead(404, { "content-type": "application/json" });
            response.end(JSON.stringify({ detail: "batch not found" }));
            return;
          }

          response.writeHead(200, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              batch,
              attempts: [...attempts.values()].filter(
                (attempt) => attempt.batchId === batchId,
              ),
            }),
          );
          return;
        }

        if (
          request.method === "POST" &&
          request.url?.startsWith("/api/v1/attempts/")
        ) {
          const [, attemptId, action] =
            request.url.match(/^\/api\/v1\/attempts\/([^/]+)\/([^/]+)$/) ?? [];
          const attempt = attemptId ? attempts.get(attemptId) : null;
          if (!attempt || action !== "complete") {
            response.writeHead(404, { "content-type": "application/json" });
            response.end(JSON.stringify({ detail: "attempt not found" }));
            return;
          }

          const finishedAt = "2026-04-19T00:00:05.000Z";
          const nextAttempt: KernelAttemptRecord = {
            ...attempt,
            status: "completed",
            finishedAt,
            summary: "completed",
          };
          attempts.set(nextAttempt.id, nextAttempt);

          const batch = batches.get(attempt.batchId);
          if (!batch) {
            response.writeHead(404, { "content-type": "application/json" });
            response.end(JSON.stringify({ detail: "batch not found" }));
            return;
          }

          const batchAttempts = [...attempts.values()].filter(
            (candidate) => candidate.batchId === batch.id,
          );
          const nextBatch: KernelBatchRecord = batchAttempts.every(
            (candidate) => candidate.status === "completed",
          )
            ? {
                ...batch,
                status: "completed",
                finishedAt,
              }
            : batch;
          batches.set(batch.id, nextBatch);

          response.writeHead(200, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              batch: nextBatch,
              attempt: nextAttempt,
            }),
          );
          return;
        }

        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ detail: "route not found" }));
      },
    );

    await new Promise<void>((resolve) =>
      kernelServer.listen(0, "127.0.0.1", resolve),
    );
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

    try {
      const initiativeResponse = await postInitiatives(
        new Request("http://localhost/api/control/orchestration/initiatives", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Atlas Factory",
            userRequest: "Build the Infinity one-prompt autonomous factory.",
            requestedBy: "martin",
            workspaceSessionId: "session-autonomy-001",
          }),
        }),
      );
      const initiativeBody = await initiativeResponse.json();
      const initiativeId = initiativeBody.initiative.id as string;

      const briefResponse = await postBriefs(
        new Request("http://localhost/api/control/orchestration/briefs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            initiativeId,
            summary: "Build the Infinity one-prompt autonomous factory.",
            goals: [],
            nonGoals: [],
            constraints: [],
            assumptions: [],
            acceptanceCriteria: [],
            repoScope: [],
            deliverables: [],
            clarificationLog: [],
            authoredBy: "hermes-intake",
            status: "clarifying",
          }),
        }),
      );
      const briefBody = await briefResponse.json();

      expect(briefResponse.status).toBe(201);
      expect(briefBody.brief.status).toBe("approved");
      expect(briefBody.taskGraph).toEqual(
        expect.objectContaining({
          initiativeId,
        }),
      );

      const state = await readControlPlaneState();
      const initiative = state.orchestration.initiatives.find(
        (candidate) => candidate.id === initiativeId,
      );
      const delivery = state.orchestration.deliveries[0] ?? null;
      const verification = state.orchestration.verifications[0] ?? null;
      const assembly = state.orchestration.assemblies[0] ?? null;
      const run = state.orchestration.runs[0] ?? null;
      const preview = state.orchestration.previewTargets[0] ?? null;
      const handoff = state.orchestration.handoffPackets[0] ?? null;
      const proof = state.orchestration.validationProofs[0] ?? null;

      expect(initiative?.status).toBe("ready");
      expect(state.orchestration.taskGraphs).toHaveLength(1);
      expect(state.orchestration.batches.length).toBeGreaterThan(0);
      expect(state.orchestration.runEvents.length).toBeGreaterThan(0);
      expect(state.orchestration.workUnits.length).toBeGreaterThan(0);
      expect(
        state.orchestration.workUnits.every(
          (workUnit) => workUnit.status === "completed",
        ),
      ).toBe(true);
      expect(assembly?.status).toBe("assembled");
      expect(verification?.overallStatus).toBe("passed");
      expect(delivery?.status).toBe("ready");
      expect(delivery?.launchProofKind).toBe("runnable_result");
      expect(run?.currentStage).toBe("handed_off");
      expect(run?.previewStatus).toBe("ready");
      expect(run?.handoffStatus).toBe("ready");
      expect(delivery?.previewUrl).toMatch(
        /\/api\/control\/orchestration\/previews\//,
      );
      expect(delivery?.launchManifestPath).toMatch(/launch-manifest\.json$/);
      expect(delivery?.launchProofUrl).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/,
      );
      expect(delivery?.launchProofAt).toBeTruthy();
      expect(delivery?.localOutputPath).toBeTruthy();
      expect(preview?.healthStatus).toBe("ready");
      expect(handoff?.status).toBe("ready");
      expect(proof?.autonomousOnePrompt).toBe(true);
      expect(proof?.manualStageProgression).toBe(false);
      expect(proof?.previewReady).toBe(true);
      expect(proof?.launchReady).toBe(true);
      expect(proof?.handoffReady).toBe(true);
      expect(proof?.launchManifestPath).toMatch(/launch-manifest\.json$/);
      expect(proof?.launchProofUrl).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/,
      );

      expect(existsSync(preview?.sourcePath ?? "")).toBe(true);
      expect(
        existsSync(path.join(delivery?.localOutputPath ?? "", "HANDOFF.md")),
      ).toBe(true);
      expect(
        existsSync(
          path.join(delivery?.localOutputPath ?? "", "delivery-manifest.json"),
        ),
      ).toBe(true);
      expect(existsSync(delivery?.launchManifestPath ?? "")).toBe(true);
      expect(existsSync(handoff?.finalSummaryPath ?? "")).toBe(true);
      expect(existsSync(handoff?.manifestPath ?? "")).toBe(true);
      expect(existsSync(proof?.eventTimelinePath ?? "")).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  test("production autonomy does not complete leased attempts without executor proof", async () => {
    delete process.env.FOUNDEROS_ALLOW_SYNTHETIC_EXECUTION;
    let completeHit = false;

    const batches = new Map<string, KernelBatchRecord>();
    const attempts = new Map<string, KernelAttemptRecord>();
    const kernelServer = createServer(
      async (request: IncomingMessage, response: ServerResponse) => {
        if (request.method === "POST" && request.url === "/api/v1/batches") {
          const body = await readJsonBody(request);
          const batchId = String(body.batchId);
          const startedAt = "2026-04-19T00:00:00.000Z";
          const workUnits = Array.isArray(body.workUnits)
            ? (body.workUnits as Array<Record<string, unknown>>)
            : [];
          const batch: KernelBatchRecord = {
            id: batchId,
            initiativeId: String(body.initiativeId),
            taskGraphId: String(body.taskGraphId),
            workUnitIds: workUnits.map((workUnit) => String(workUnit.id)),
            concurrencyLimit: Number(body.concurrencyLimit ?? 1),
            status: "running",
            startedAt,
            finishedAt: null,
          };
          batches.set(batchId, batch);
          const launchedAttempts = workUnits.map((workUnit) => {
            const attempt: KernelAttemptRecord = {
              id: `attempt-${batchId}-${String(workUnit.id)}`,
              workUnitId: String(workUnit.id),
              batchId,
              executorType: String(workUnit.executorType ?? "codex"),
              status: "leased",
              startedAt,
              finishedAt: null,
              summary: null,
              artifactUris: [],
              errorCode: null,
              errorSummary: null,
            };
            attempts.set(attempt.id, attempt);
            return attempt;
          });
          response.writeHead(201, { "content-type": "application/json" });
          response.end(JSON.stringify({ batch, attempts: launchedAttempts }));
          return;
        }

        if (request.method === "GET" && request.url?.startsWith("/api/v1/batches/")) {
          const batchId = request.url.split("/").at(-1) ?? "";
          const batch = batches.get(batchId);
          if (!batch) {
            response.writeHead(404, { "content-type": "application/json" });
            response.end(JSON.stringify({ detail: "batch not found" }));
            return;
          }
          response.writeHead(200, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              batch,
              attempts: [...attempts.values()].filter(
                (attempt) => attempt.batchId === batchId,
              ),
            }),
          );
          return;
        }

        if (request.method === "POST" && request.url?.includes("/complete")) {
          completeHit = true;
        }
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ detail: "route not found" }));
      },
    );

    await new Promise<void>((resolve) =>
      kernelServer.listen(0, "127.0.0.1", resolve),
    );
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

    try {
      const initiativeResponse = await postInitiatives(
        new Request("http://localhost/api/control/orchestration/initiatives", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Proof Gate",
            userRequest: "Verify production proof gate.",
            requestedBy: "martin",
          }),
        }),
      );
      const initiativeBody = await initiativeResponse.json();
      const initiativeId = initiativeBody.initiative.id as string;

      process.env.FOUNDEROS_DEPLOYMENT_ENV = "production";

      const briefResponse = await postBriefs(
        new Request("http://localhost/api/control/orchestration/briefs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            initiativeId,
            summary: "Verify production proof gate.",
            goals: [],
            nonGoals: [],
            constraints: [],
            assumptions: [],
            acceptanceCriteria: [],
            repoScope: [],
            deliverables: [],
            clarificationLog: [],
            authoredBy: "hermes-intake",
            status: "clarifying",
          }),
        }),
      );

      expect(briefResponse.status).toBe(201);
      expect(completeHit).toBe(false);

      const state = await readControlPlaneState();
      expect(state.orchestration.deliveries).toHaveLength(0);
      expect(
        state.orchestration.workUnits.some(
          (workUnit) => workUnit.status !== "completed",
        ),
      ).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
