import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  resetControlPlaneStateForTests,
  updateControlPlaneState,
} from "../../../../../../lib/server/control-plane/state/store";
import {
  BROWSER_E2E_BLOCKED_RUN_IDS,
  BROWSER_E2E_BLOCKED_RUN_STATE,
} from "../../../../../../lib/server/orchestration/fixtures/browser-e2e-blocked-run";

import { POST as postInitiatives } from "../../initiatives/route";
import { POST as postBriefs } from "../../briefs/route";
import { POST as postTaskGraphs } from "../../task-graphs/route";
import { POST as postBatches } from "../../batches/route";
import { GET as getWorkUnits } from "../../work-units/route";
import { PATCH as patchWorkUnit } from "../../work-units/[workUnitId]/route";
import { POST as postAssembly } from "../../assembly/route";
import { POST as postVerification } from "../../verification/route";
import { POST as postDelivery } from "../../delivery/route";
import { GET as getContinuity } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR =
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL =
  process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL =
  process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
const ORIGINAL_EXECUTION_KERNEL_BASE_URL =
  process.env.FOUNDEROS_EXECUTION_KERNEL_BASE_URL;
const ORIGINAL_HERMES_MEMORY_SIDECAR_BASE_URL =
  process.env.HERMES_MEMORY_SIDECAR_BASE_URL;
const ORIGINAL_VALIDATION_COMMANDS =
  process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
const ORIGINAL_VALIDATION_COMMANDS_ALLOWED =
  process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-continuity-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  process.env.HERMES_MEMORY_SIDECAR_BASE_URL = "http://127.0.0.1:8766";
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
  if (ORIGINAL_HERMES_MEMORY_SIDECAR_BASE_URL === undefined) {
    delete process.env.HERMES_MEMORY_SIDECAR_BASE_URL;
  } else {
    process.env.HERMES_MEMORY_SIDECAR_BASE_URL =
      ORIGINAL_HERMES_MEMORY_SIDECAR_BASE_URL;
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
  if (tempStateDir) {
    rmSync(tempStateDir, { recursive: true, force: true });
    tempStateDir = "";
  }
});

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

async function createFullTrace() {
  const initiativeResponse = await postInitiatives(
    new Request("http://localhost/api/control/orchestration/initiatives", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Atlas Factory",
        userRequest: "Build the Infinity-native project factory.",
        requestedBy: "martin",
        workspaceSessionId: "session-2026-04-11-002",
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
        summary: "Approved brief for the project factory.",
        goals: ["Generate a deterministic execution plan"],
        nonGoals: ["Continuity polish only after delivery"],
        constraints: ["Stay inside /Users/martin/infinity"],
        assumptions: ["Shell and work-ui remain split"],
        acceptanceCriteria: ["Initiative trace is inspectable end-to-end"],
        repoScope: [
          "/Users/martin/infinity/apps/shell",
          "/Users/martin/infinity/apps/work-ui",
        ],
        deliverables: ["Delivery", "Continuity summary"],
        clarificationLog: [],
        authoredBy: "droid-spec-writer",
        status: "approved",
      }),
    }),
  );
  const briefBody = await briefResponse.json();
  const taskGraphResponse = await postTaskGraphs(
    new Request("http://localhost/api/control/orchestration/task-graphs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ briefId: briefBody.brief.id }),
    }),
  );
  const taskGraphBody = await taskGraphResponse.json();
  const taskGraphId = taskGraphBody.taskGraph.id as string;

  const kernelServer = createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      if (request.method === "POST" && request.url === "/api/v1/batches") {
        const body = await readJsonBody(request);
        response.writeHead(201, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            batch: {
              id: body.batchId,
              initiativeId,
              taskGraphId,
              workUnitIds: (body.workUnits as Array<{ id: string }>).map(
                (unit) => unit.id,
              ),
              concurrencyLimit: 1,
              status: "running",
              startedAt: "2026-04-18T10:00:00.000Z",
              finishedAt: null,
            },
            attempts: [
              {
                id: "attempt-continuity-001",
                workUnitId: (body.workUnits as Array<{ id: string }>)[0]?.id,
                batchId: body.batchId,
                executorType: "droid",
                status: "started",
                startedAt: "2026-04-18T10:00:00.000Z",
                finishedAt: null,
                summary: null,
                artifactUris: [],
                errorCode: null,
                errorSummary: null,
              },
            ],
          }),
        );
        return;
      }

      if (
        request.method === "GET" &&
        request.url?.startsWith("/api/v1/batches/")
      ) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(
          JSON.stringify({
            batch: {
              id: "batch-continuity-001",
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
                id: "attempt-continuity-001",
                workUnitId: "work-unit-foundation",
                batchId: "batch-continuity-001",
                executorType: "droid",
                status: "started",
                startedAt: "2026-04-18T10:00:00.000Z",
                finishedAt: null,
                summary: null,
                artifactUris: [],
                errorCode: null,
                errorSummary: null,
              },
            ],
          }),
        );
        return;
      }

      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ detail: "not found" }));
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
    const batchResponse = await postBatches(
      new Request("http://localhost/api/control/orchestration/batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskGraphId,
          concurrencyLimit: 1,
        }),
      }),
    );
    expect(batchResponse.status).toBe(201);

    const workUnitsResponse = await getWorkUnits(
      new Request(
        `http://localhost/api/control/orchestration/work-units?task_graph_id=${taskGraphId}`,
      ),
    );
    const workUnitsBody = await workUnitsResponse.json();
    for (const [index, workUnit] of workUnitsBody.workUnits.entries()) {
      const response = await patchWorkUnit(
        new Request(
          `http://localhost/api/control/orchestration/work-units/${workUnit.id}`,
          {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: "completed",
              latestAttemptId: `attempt-continuity-complete-${index + 1}`,
            }),
          },
        ),
        { params: Promise.resolve({ workUnitId: workUnit.id }) },
      );
      expect(response.status).toBe(200);
    }

    const assemblyResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    expect(assemblyResponse.status).toBe(201);

    const verificationResponse = await postVerification(
      new Request("http://localhost/api/control/orchestration/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    expect(verificationResponse.status).toBe(201);

    const deliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    expect(deliveryResponse.status).toBe(201);

    await updateControlPlaneState((draft) => {
      draft.approvals.requests = [
        {
          id: "approval-continuity-001",
          sessionId: "session-2026-04-11-002",
          externalSessionId: "codex-continuity",
          projectId: initiativeId,
          projectName: "Atlas Factory",
          groupId: "group-core-02",
          accountId: "account-chatgpt-02",
          workspaceId: "workspace-continuity",
          requestKind: "command",
          title: "Approve continuity verification",
          summary: "Continuity trace keeps related approval records scoped by session.",
          reason: "The continuity API must not rely on implicit synthetic seed data.",
          status: "pending",
          decision: null,
          requestedAt: "2026-04-18T10:05:00.000Z",
          updatedAt: "2026-04-18T10:05:00.000Z",
          resolvedAt: null,
          resolvedBy: null,
          expiresAt: null,
          revision: 1,
        },
        ...draft.approvals.requests,
      ];
      draft.recoveries.incidents = [
        {
          id: "recovery-continuity-001",
          sessionId: "session-2026-04-11-002",
          externalSessionId: "codex-continuity",
          projectId: initiativeId,
          projectName: "Atlas Factory",
          groupId: "group-core-02",
          accountId: "account-chatgpt-02",
          workspaceId: "workspace-continuity",
          status: "recovered",
          severity: "medium",
          recoveryActionKind: "resolve",
          summary: "Continuity trace keeps related recovery records scoped by session.",
          rootCause: "Synthetic seeds are not available in production-mode validation.",
          recommendedAction: "Use explicit test records for continuity scoping.",
          retryCount: 1,
          openedAt: "2026-04-18T10:06:00.000Z",
          lastObservedAt: "2026-04-18T10:07:00.000Z",
          updatedAt: "2026-04-18T10:07:00.000Z",
          resolvedAt: "2026-04-18T10:07:00.000Z",
          revision: 1,
        },
        ...draft.recoveries.incidents,
      ];
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      kernelServer.close((error) => (error ? reject(error) : resolve())),
    );
  }

  return { initiativeId };
}

describe("/api/control/orchestration/continuity/[initiativeId]", () => {
  test("reports the browser E2E failed verification fixture as blocked with no delivery href", async () => {
    await updateControlPlaneState((draft) => {
      draft.approvals = BROWSER_E2E_BLOCKED_RUN_STATE.approvals;
      draft.recoveries = BROWSER_E2E_BLOCKED_RUN_STATE.recoveries;
      draft.accounts = BROWSER_E2E_BLOCKED_RUN_STATE.accounts;
      draft.sessions = BROWSER_E2E_BLOCKED_RUN_STATE.sessions;
      draft.orchestration = BROWSER_E2E_BLOCKED_RUN_STATE.orchestration;
    });

    const response = await getContinuity(
      new Request(
        `http://localhost/api/control/orchestration/continuity/${BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId}`,
      ),
      {
        params: Promise.resolve({
          initiativeId: BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId,
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.initiative.id).toBe(BROWSER_E2E_BLOCKED_RUN_IDS.initiativeId);
    expect(body.initiative.status).toBe("failed");
    expect(body.taskGraphs[0].nodeIds).toHaveLength(9);
    expect(body.workUnits).toBeUndefined();
    expect(body.verification).toEqual(
      expect.objectContaining({
        id: BROWSER_E2E_BLOCKED_RUN_IDS.verificationId,
        overallStatus: "failed",
      }),
    );
    expect(
      body.verification.checks.find(
        (check: { name: string }) => check.name === "targeted_tests_passed",
      ),
    ).toEqual(
      expect.objectContaining({
        status: "failed",
        command:
          "npm run test:orchestration-readiness --workspace @founderos/web",
        cwd: "/Users/martin/infinity/apps/shell",
        exitCode: 1,
      }),
    );
    expect(body.delivery).toBeNull();
    expect(body.links.deliveryHref).toBeNull();
  });

  test("returns an inspectable continuity trace from intake to delivery with related approvals and recoveries", async () => {
    const { initiativeId } = await createFullTrace();

    const response = await getContinuity(
      new Request(
        `http://localhost/api/control/orchestration/continuity/${initiativeId}`,
      ),
      { params: Promise.resolve({ initiativeId }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.initiative.id).toBe(initiativeId);
    expect(body.briefs.length).toBeGreaterThanOrEqual(1);
    expect(body.taskGraphs.length).toBeGreaterThanOrEqual(1);
    expect(body.batches.length).toBeGreaterThanOrEqual(1);
    expect(body.assembly?.status).toBe("assembled");
    expect(body.verification?.overallStatus).toBe("passed");
    expect(body.delivery?.status).toBe("ready");
    expect(body.delivery?.launchProofKind).toBe("runnable_result");
    expect(body.relatedApprovals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: "session-2026-04-11-002",
        }),
      ]),
    );
    expect(body.relatedRecoveries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: "session-2026-04-11-002",
        }),
      ]),
    );
    expect(body.memoryAdapter).toEqual(
      expect.objectContaining({
        baseUrl: "http://127.0.0.1:8766",
        healthPath: "/health",
        schemaPath: "/actions/schema",
      }),
    );
    expect(body.links.continuityHref).toContain(
      `/execution/continuity/${initiativeId}`,
    );
    expect(body.links.approvalsHref).toContain("/execution/approvals");
    expect(body.links.recoveriesHref).toContain("/execution/recoveries");
  });
});
