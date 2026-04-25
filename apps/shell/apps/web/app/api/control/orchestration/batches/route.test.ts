import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  readControlPlaneState,
  resetControlPlaneStateForTests,
} from "../../../../../lib/server/control-plane/state/store";
import { POST as postInitiatives } from "../initiatives/route";
import { POST as postBriefs } from "../briefs/route";
import { POST as postTaskGraphs } from "../task-graphs/route";
import { GET as getBatchDetail } from "./[batchId]/route";
import { GET as getBatches, POST as postBatches } from "./route";
import { GET as getTaskGraphDetail } from "../task-graphs/[taskGraphId]/route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
const ORIGINAL_EXECUTION_KERNEL_BASE_URL = process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-batches-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
  await resetControlPlaneStateForTests();
});

afterEach(async () => {
  await resetControlPlaneStateForTests();
  if (ORIGINAL_CONTROL_PLANE_STATE_DIR === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = ORIGINAL_CONTROL_PLANE_STATE_DIR;
  }
  if (ORIGINAL_CONTROL_PLANE_DATABASE_URL === undefined) {
    delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  } else {
    process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL = ORIGINAL_CONTROL_PLANE_DATABASE_URL;
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
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = ORIGINAL_EXECUTION_KERNEL_BASE_URL;
  }
  if (tempStateDir) {
    rmSync(tempStateDir, { recursive: true, force: true });
    tempStateDir = "";
  }
});

async function createPlannedTaskGraph() {
  const initiativeResponse = await postInitiatives(
    new Request("http://localhost/api/control/orchestration/initiatives", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Atlas Factory",
        userRequest: "Build the Infinity-native project factory.",
        requestedBy: "martin",
      }),
    })
  );
  const initiativeBody = await initiativeResponse.json();
  const initiativeId = initiativeBody.initiative.id as string;

  const briefResponse = await postBriefs(
    new Request("http://localhost/api/control/orchestration/briefs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        initiativeId,
        summary: "Approved brief for the project factory.",
        goals: ["Generate a deterministic execution plan"],
        nonGoals: ["Assembly and delivery"],
        constraints: ["Stay inside /Users/martin/infinity"],
        assumptions: ["Shell and work-ui remain split"],
        acceptanceCriteria: [
          "Each work unit has scope, dependencies, and acceptance criteria",
        ],
        repoScope: [
          "/Users/martin/infinity/apps/shell",
          "/Users/martin/infinity/apps/work-ui",
        ],
        deliverables: ["Task graph", "Work units"],
        clarificationLog: [],
        authoredBy: "droid-spec-writer",
        status: "approved",
      }),
    })
  );
  const briefBody = await briefResponse.json();
  const briefId = briefBody.brief.id as string;

  const taskGraphResponse = await postTaskGraphs(
    new Request("http://localhost/api/control/orchestration/task-graphs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ briefId }),
    })
  );
  const taskGraphBody = await taskGraphResponse.json();

  return {
    initiativeId,
    taskGraphId: taskGraphBody.taskGraph.id as string,
  };
}

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

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

describe("/api/control/orchestration/batches", () => {
  test("creates a shell batch and dispatches it to the execution kernel via the typed client", async () => {
    const { initiativeId, taskGraphId } = await createPlannedTaskGraph();

    const kernelServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
      if (request.method === "POST" && request.url === "/api/v1/batches") {
        const body = await readJsonBody(request);
        expect(body.taskGraphId).toBe(taskGraphId);
        expect(body.initiativeId).toBe(initiativeId);
        expect(body.concurrencyLimit).toBe(1);
        expect(Array.isArray(body.workUnits)).toBe(true);

        response.writeHead(201, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            batch: {
              id: body.batchId,
              initiativeId,
              taskGraphId,
              workUnitIds: (body.workUnits as Array<{ id: string }>).map((unit) => unit.id),
              concurrencyLimit: 1,
              status: "running",
              startedAt: "2026-04-18T10:00:00.000Z",
              finishedAt: null,
            },
            attempts: [
              {
                id: "attempt-foundation-001",
                workUnitId: (body.workUnits as Array<{ id: string }>)[0]?.id,
                batchId: body.batchId,
                executorType: (body.workUnits as Array<{ executorType: string }>)[0]?.executorType,
                status: "leased",
                startedAt: "2026-04-18T10:00:00.000Z",
                finishedAt: null,
                summary: null,
                artifactUris: [],
                errorCode: null,
                errorSummary: null,
                leaseHolder: "execution-kernel-scheduler",
                leaseExpiresAt: "2026-04-18T10:00:30.000Z",
                lastHeartbeatAt: "2026-04-18T10:00:00.000Z",
              },
            ],
          })
        );
        return;
      }

      if (request.method === "GET" && request.url?.startsWith("/api/v1/batches/")) {
        const batchId = request.url.split("/").at(-1);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            batch: {
              id: batchId,
              initiativeId,
              taskGraphId,
              workUnitIds: ["work-unit-foundation"],
              concurrencyLimit: 1,
              status: "running",
              startedAt: "2026-04-18T10:00:00.000Z",
              finishedAt: null,
            },
            attempts: [
              {
                id: "attempt-foundation-001",
                workUnitId: "work-unit-foundation",
                batchId,
                executorType: "droid",
                status: "leased",
                startedAt: "2026-04-18T10:00:00.000Z",
                finishedAt: null,
                summary: null,
                artifactUris: [],
                errorCode: null,
                errorSummary: null,
                leaseHolder: "execution-kernel-scheduler",
                leaseExpiresAt: "2026-04-18T10:00:30.000Z",
                lastHeartbeatAt: "2026-04-18T10:00:00.000Z",
              },
            ],
          })
        );
        return;
      }

      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ detail: "not found" }));
    });

    await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel test server did not bind to an ephemeral port.");
    }

    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

    try {
      const createResponse = await postBatches(
        new Request("http://localhost/api/control/orchestration/batches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            taskGraphId,
            concurrencyLimit: 1,
          }),
        })
      );
      const createBody = await createResponse.json();

      expect(createResponse.status).toBe(201);
      expect(createBody.batch).toEqual(
        expect.objectContaining({
          initiativeId,
          taskGraphId,
          status: "running",
        })
      );
      expect(createBody.workUnits).toEqual([
        expect.objectContaining({
          status: "running",
          latestAttemptId: "attempt-foundation-001",
        }),
      ]);
      expect(createBody.attempts).toEqual([
        expect.objectContaining({
          id: "attempt-foundation-001",
          status: "leased",
        }),
      ]);

      const batchId = createBody.batch.id as string;

      const listResponse = await getBatches(
        new Request(
          `http://localhost/api/control/orchestration/batches?initiative_id=${initiativeId}`
        )
      );
      const listBody = await listResponse.json();

      expect(listResponse.status).toBe(200);
      expect(listBody.batches).toHaveLength(1);
      expect(listBody.batches[0]?.id).toBe(batchId);

      const detailResponse = await getBatchDetail(
        new Request(`http://localhost/api/control/orchestration/batches/${batchId}`),
        { params: Promise.resolve({ batchId }) }
      );
      const detailBody = await detailResponse.json();

      expect(detailResponse.status).toBe(200);
      expect(detailBody.batch.id).toBe(batchId);
      expect(detailBody.attempts).toEqual([
        expect.objectContaining({
          id: "attempt-foundation-001",
          status: "leased",
        }),
      ]);
      expect(detailBody.workUnits).toEqual([
        expect.objectContaining({
          status: "running",
          latestAttemptId: "attempt-foundation-001",
        }),
      ]);

      const taskGraphResponse = await getTaskGraphDetail(
        new Request(`http://localhost/api/control/orchestration/task-graphs/${taskGraphId}`),
        { params: Promise.resolve({ taskGraphId }) }
      );
      const taskGraphBody = await taskGraphResponse.json();

      expect(taskGraphResponse.status).toBe(200);
      expect(taskGraphBody.taskGraph.status).toBe("active");
      expect(taskGraphBody.workUnits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "running",
            latestAttemptId: "attempt-foundation-001",
          }),
        ])
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  test("load/backpressure burst keeps queued attempts and leaves no orphan shell state", async () => {
    const plans = [];
    for (let index = 0; index < 8; index += 1) {
      const plan = await createPlannedTaskGraph();
      const taskGraphResponse = await getTaskGraphDetail(
        new Request(`http://localhost/api/control/orchestration/task-graphs/${plan.taskGraphId}`),
        { params: Promise.resolve({ taskGraphId: plan.taskGraphId }) }
      );
      const taskGraphBody = await taskGraphResponse.json();
      plans.push({
        ...plan,
        workUnitIds: (taskGraphBody.workUnits as Array<{ id: string }>).map((unit) => unit.id),
      });
    }

    const kernelAcceptedCapacity = 3;
    let acceptedLaunches = 0;
    let rejectedLaunches = 0;
    let observedLaunchRequests = 0;
    let inFlightKernelRequests = 0;
    let maxInFlightKernelRequests = 0;
    const acceptedBatchIds: string[] = [];

    const kernelServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
      if (request.method !== "POST" || request.url !== "/api/v1/batches") {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ detail: "not found" }));
        return;
      }

      observedLaunchRequests += 1;
      inFlightKernelRequests += 1;
      maxInFlightKernelRequests = Math.max(maxInFlightKernelRequests, inFlightKernelRequests);

      try {
        const body = await readJsonBody(request);
        await delay(20);

        const workUnits = Array.isArray(body.workUnits)
          ? (body.workUnits as Array<{ id: string; executorType: string }>)
          : [];
        const concurrencyLimit = Number(body.concurrencyLimit ?? 1);

        if (acceptedLaunches >= kernelAcceptedCapacity) {
          rejectedLaunches += 1;
          response.writeHead(429, { "content-type": "application/json" });
          response.end(
            JSON.stringify({
              detail: "execution kernel over capacity; queue backpressure engaged",
            })
          );
          return;
        }

        acceptedLaunches += 1;
        acceptedBatchIds.push(String(body.batchId));
        response.writeHead(201, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            batch: {
              id: body.batchId,
              initiativeId: body.initiativeId,
              taskGraphId: body.taskGraphId,
              workUnitIds: workUnits.map((unit) => unit.id),
              concurrencyLimit,
              status: "running",
              startedAt: "2026-04-24T12:00:00.000Z",
              finishedAt: null,
            },
            attempts: workUnits.map((unit, index) => ({
              id: `attempt-${String(body.batchId)}-${unit.id}`,
              workUnitId: unit.id,
              batchId: body.batchId,
              executorType: unit.executorType,
              status: index < concurrencyLimit ? "leased" : "queued",
              startedAt: "2026-04-24T12:00:00.000Z",
              finishedAt: null,
              summary: null,
              artifactUris: [],
              errorCode: null,
              errorSummary: null,
              leaseHolder:
                index < concurrencyLimit ? "execution-kernel-scheduler" : null,
              leaseExpiresAt:
                index < concurrencyLimit ? "2026-04-24T12:00:30.000Z" : null,
              lastHeartbeatAt:
                index < concurrencyLimit ? "2026-04-24T12:00:00.000Z" : null,
            })),
          })
        );
      } finally {
        inFlightKernelRequests -= 1;
      }
    });

    await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel load test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

    try {
      const responses = await Promise.all(
        plans.map(async ({ taskGraphId, workUnitIds }) => {
          const response = await postBatches(
            new Request("http://localhost/api/control/orchestration/batches", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                taskGraphId,
                workUnitIds,
                concurrencyLimit: 2,
              }),
            })
          );
          return {
            status: response.status,
            body: await response.json(),
          };
        })
      );

      const accepted = responses.filter((result) => result.status === 201);
      const rejected = responses.filter((result) => result.status === 429);

      expect(observedLaunchRequests).toBe(plans.length);
      expect(maxInFlightKernelRequests).toBeGreaterThan(1);
      expect(accepted).toHaveLength(kernelAcceptedCapacity);
      expect(rejected).toHaveLength(plans.length - kernelAcceptedCapacity);
      expect(rejectedLaunches).toBe(plans.length - kernelAcceptedCapacity);
      expect(
        rejected.every((result) =>
          String(result.body.detail).includes("queue backpressure engaged")
        )
      ).toBe(true);

      for (const result of accepted) {
        const attempts = result.body.attempts as Array<{ status: string }>;
        expect(result.body.batch.concurrencyLimit).toBe(2);
        expect(attempts.filter((attempt) => attempt.status === "leased")).toHaveLength(2);
        expect(attempts.filter((attempt) => attempt.status === "queued").length).toBeGreaterThan(0);
      }

      const state = await readControlPlaneState();
      const persistedBatchIds = state.orchestration.batches.map((batch) => batch.id).sort();
      expect(persistedBatchIds).toEqual([...acceptedBatchIds].sort());
      expect(state.orchestration.batches).toHaveLength(kernelAcceptedCapacity);
      expect(
        state.orchestration.supervisorActions.filter((action) =>
          acceptedBatchIds.includes(action.batchId ?? "")
        )
      ).toHaveLength(kernelAcceptedCapacity * 2);

      await resetControlPlaneStateForTests();
      const reloadedState = await readControlPlaneState();
      expect(reloadedState.orchestration.batches.map((batch) => batch.id).sort()).toEqual(
        [...acceptedBatchIds].sort()
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  test("rejects partial work-unit selection before calling the execution kernel", async () => {
    const { taskGraphId } = await createPlannedTaskGraph();
    let kernelHit = false;

    const kernelServer = createServer((_request: IncomingMessage, response: ServerResponse) => {
      kernelHit = true;
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ detail: "kernel should not be called" }));
    });

    await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

    try {
      const response = await postBatches(
        new Request("http://localhost/api/control/orchestration/batches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            taskGraphId,
            workUnitIds: [
              "work-unit-not-real",
            ],
          }),
        })
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.detail).toMatch(/does not contain requested work units/i);
      expect(kernelHit).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });

  test("surfaces execution-kernel batch detail failures instead of hiding attempts", async () => {
    const { initiativeId, taskGraphId } = await createPlannedTaskGraph();

    const kernelServer = createServer(async (request: IncomingMessage, response: ServerResponse) => {
      if (request.method === "POST" && request.url === "/api/v1/batches") {
        const body = await readJsonBody(request);
        response.writeHead(201, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            batch: {
              id: body.batchId,
              initiativeId,
              taskGraphId,
              workUnitIds: ["work-unit-foundation"],
              concurrencyLimit: 1,
              status: "running",
              startedAt: "2026-04-18T10:00:00.000Z",
              finishedAt: null,
            },
            attempts: [],
          })
        );
        return;
      }

      if (request.method === "GET" && request.url?.startsWith("/api/v1/batches/")) {
        response.writeHead(503, { "content-type": "application/json" });
        response.end(JSON.stringify({ detail: "kernel detail unavailable" }));
        return;
      }

      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ detail: "not found" }));
    });

    await new Promise<void>((resolve) => kernelServer.listen(0, "127.0.0.1", resolve));
    const address = kernelServer.address();
    if (!address || typeof address === "string") {
      throw new Error("Kernel test server did not bind to an ephemeral port.");
    }
    process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL = `http://127.0.0.1:${address.port}`;

    try {
      const createResponse = await postBatches(
        new Request("http://localhost/api/control/orchestration/batches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            taskGraphId,
            concurrencyLimit: 1,
          }),
        })
      );
      const createBody = await createResponse.json();
      const batchId = createBody.batch.id as string;

      const detailResponse = await getBatchDetail(
        new Request(`http://localhost/api/control/orchestration/batches/${batchId}`),
        { params: Promise.resolve({ batchId }) }
      );
      const detailBody = await detailResponse.json();

      expect(detailResponse.status).toBe(502);
      expect(detailBody.detail).toMatch(/kernel detail unavailable/i);
    } finally {
      await new Promise<void>((resolve, reject) =>
        kernelServer.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
