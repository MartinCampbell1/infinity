import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  readControlPlaneState,
  resetControlPlaneStateForTests,
} from "../../../../../lib/server/control-plane/state/store";
import { materializeAttemptArtifacts } from "../../../../../lib/server/orchestration/attempt-artifacts";

import { POST as postInitiatives } from "../initiatives/route";
import { POST as postBriefs } from "../briefs/route";
import { POST as postTaskGraphs } from "../task-graphs/route";
import { GET as getWorkUnits } from "../work-units/route";
import { PATCH as patchWorkUnit } from "../work-units/[workUnitId]/route";
import { POST as postAssembly } from "../assembly/route";
import { POST as postVerification } from "../verification/route";
import { GET as getPreview } from "../previews/[previewId]/route";
import { GET as getDelivery, POST as postDelivery } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR =
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL =
  process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL =
  process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
const ORIGINAL_VALIDATION_COMMANDS =
  process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
const ORIGINAL_VALIDATION_COMMANDS_ALLOWED =
  process.env.FOUNDEROS_ALLOW_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
const ORIGINAL_INTEGRATION_ROOT = process.env.FOUNDEROS_INTEGRATION_ROOT;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-delivery-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  process.env.FOUNDEROS_INTEGRATION_ROOT = tempStateDir;
  delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
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
  if (ORIGINAL_INTEGRATION_ROOT === undefined) {
    delete process.env.FOUNDEROS_INTEGRATION_ROOT;
  } else {
    process.env.FOUNDEROS_INTEGRATION_ROOT = ORIGINAL_INTEGRATION_ROOT;
  }
  if (tempStateDir) {
    rmSync(tempStateDir, { recursive: true, force: true });
    tempStateDir = "";
  }
});

async function createPlannedInitiative(input?: {
  title?: string;
  userRequest?: string;
}) {
  const initiativeResponse = await postInitiatives(
    new Request("http://localhost/api/control/orchestration/initiatives", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: input?.title ?? "Atlas Factory",
        userRequest:
          input?.userRequest ?? "Build the Infinity-native project factory.",
        requestedBy: "martin",
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
        summary:
          input?.userRequest ?? "Approved brief for the project factory.",
        goals: ["Generate a deterministic execution plan"],
        nonGoals: ["Delivery handoff"],
        constraints: ["Stay inside /Users/martin/infinity"],
        assumptions: ["Shell and work-ui remain split"],
        acceptanceCriteria: ["Successful verification can create delivery"],
        repoScope: [
          "/Users/martin/infinity/apps/shell",
          "/Users/martin/infinity/apps/work-ui",
        ],
        deliverables: ["Assembly", "Verification", "Delivery"],
        clarificationLog: [],
        authoredBy: "droid-spec-writer",
        status: "approved",
      }),
    }),
  );
  const briefBody = await briefResponse.json();
  const briefId = briefBody.brief.id as string;

  const taskGraphResponse = await postTaskGraphs(
    new Request("http://localhost/api/control/orchestration/task-graphs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ briefId }),
    }),
  );
  const taskGraphBody = await taskGraphResponse.json();

  return {
    initiativeId,
    taskGraphId: taskGraphBody.taskGraph.id as string,
  };
}

async function completeAllWorkUnits(
  taskGraphId: string,
  resolveAttemptId: (
    workUnit: { id: string },
    index: number,
  ) => string | null = (_workUnit, index) => `attempt-delivery-${index + 1}`,
) {
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
            latestAttemptId: resolveAttemptId(workUnit, index),
          }),
        },
      ),
      { params: Promise.resolve({ workUnitId: workUnit.id }) },
    );
    expect(response.status).toBe(200);
  }
}

async function corruptFinalIntegrationProof(
  initiativeId: string,
  taskGraphId: string,
  expectedMarker = "Infinity Missing Runnable Proof",
) {
  const workUnitsResponse = await getWorkUnits(
    new Request(
      `http://localhost/api/control/orchestration/work-units?task_graph_id=${taskGraphId}`,
    ),
  );
  const workUnitsBody = await workUnitsResponse.json();
  const finalIntegrationUnit = workUnitsBody.workUnits.find(
    (workUnit: { id: string; latestAttemptId: string | null }) =>
      workUnit.id.endsWith("final_integration"),
  );

  expect(finalIntegrationUnit).toBeTruthy();
  expect(finalIntegrationUnit.latestAttemptId).toBeTruthy();

  const attemptArtifacts = materializeAttemptArtifacts({
    initiativeId,
    taskGraphId,
    batchId: null,
    workUnit: finalIntegrationUnit,
    attemptId: finalIntegrationUnit.latestAttemptId,
  });
  const launchManifestUri = attemptArtifacts.artifactUris.find((artifactUri) =>
    artifactUri.endsWith("/launch-manifest.json"),
  );

  expect(launchManifestUri).toBeTruthy();
  if (!launchManifestUri) {
    throw new Error(
      "Final integration attempt did not materialize a launch manifest.",
    );
  }

  const launchManifestPath = launchManifestUri.replace(/^file:\/\//, "");
  const launchManifest = JSON.parse(
    readFileSync(launchManifestPath, "utf8"),
  ) as {
    expectedMarker: string;
  };
  const indexPath = path.join(path.dirname(launchManifestPath), "index.html");
  const indexHtml = readFileSync(indexPath, "utf8");
  expect(indexHtml).toContain(launchManifest.expectedMarker);
  writeFileSync(
    indexPath,
    indexHtml.replace(launchManifest.expectedMarker, expectedMarker),
  );

  return {
    indexPath,
    originalExpectedMarker: launchManifest.expectedMarker,
  };
}

async function rewriteFinalIntegrationAsLegacyRunnableResult(
  initiativeId: string,
  taskGraphId: string,
) {
  const workUnitsResponse = await getWorkUnits(
    new Request(
      `http://localhost/api/control/orchestration/work-units?task_graph_id=${taskGraphId}`,
    ),
  );
  const workUnitsBody = await workUnitsResponse.json();
  const finalIntegrationUnit = workUnitsBody.workUnits.find(
    (workUnit: { id: string; latestAttemptId: string | null }) =>
      workUnit.id.endsWith("final_integration"),
  );

  expect(finalIntegrationUnit).toBeTruthy();
  expect(finalIntegrationUnit.latestAttemptId).toBeTruthy();

  const attemptArtifacts = materializeAttemptArtifacts({
    initiativeId,
    taskGraphId,
    batchId: null,
    workUnit: finalIntegrationUnit,
    attemptId: finalIntegrationUnit.latestAttemptId,
  });
  const launchManifestUri = attemptArtifacts.artifactUris.find((artifactUri) =>
    artifactUri.endsWith("/launch-manifest.json"),
  );

  expect(launchManifestUri).toBeTruthy();
  if (!launchManifestUri) {
    throw new Error(
      "Final integration attempt did not materialize a launch manifest.",
    );
  }

  const launchManifestPath = launchManifestUri.replace(/^file:\/\//, "");
  const launchManifest = JSON.parse(
    readFileSync(launchManifestPath, "utf8"),
  ) as Record<string, unknown>;
  writeFileSync(
    launchManifestPath,
    JSON.stringify(
      {
        ...launchManifest,
        artifactRole: "attempt_real_product_result",
        targetKind: "runnable_result",
        targetLabel: "Legacy integrated preview",
      },
      null,
      2,
    ),
  );

  return {
    launchManifestPath,
  };
}

describe("/api/control/orchestration/delivery", () => {
  test("passed verification creates an assembly-backed runnable delivery and marks the initiative ready", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

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
    const deliveryBody = await deliveryResponse.json();

    expect(deliveryResponse.status).toBe(201);
    expect(deliveryBody.delivery).toEqual(
      expect.objectContaining({
        initiativeId,
        taskGraphId,
        status: "ready",
        launchProofKind: "runnable_result",
        launchTargetLabel: "Integrated assembly result",
      }),
    );
    expect(deliveryBody.delivery.localOutputPath).toMatch(
      /\.local-state\/orchestration\/deliveries/,
    );
    expect(deliveryBody.delivery.localOutputPath.startsWith(tempStateDir)).toBe(
      true,
    );
    expect(deliveryBody.delivery.launchManifestPath).toContain(
      "/runnable-result/",
    );
    expect(deliveryBody.delivery.launchManifestPath).not.toContain(
      "/attempt-artifacts/",
    );
    expect(deliveryBody.delivery.command).toMatch(
      /launch-localhost\.py' --port 0 --entry \/index\.html$/,
    );
    expect(deliveryBody.delivery.launchManifestPath).toMatch(
      /launch-manifest\.json$/,
    );
    expect(deliveryBody.delivery.launchProofUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/,
    );
    expect(deliveryBody.delivery.launchProofAt).toBeTruthy();
    expect(deliveryBody.delivery.resultSummary).toMatch(
      /runnable localhost delivery bundle backed by verified assembly evidence/i,
    );

    const listResponse = await getDelivery(
      new Request(
        `http://localhost/api/control/orchestration/delivery?initiative_id=${initiativeId}`,
      ),
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.deliveries).toEqual([
      expect.objectContaining({
        id: deliveryBody.delivery.id,
        status: "ready",
      }),
    ]);

    const state = await readControlPlaneState();
    expect(
      state.orchestration.initiatives.find(
        (initiative) => initiative.id === initiativeId,
      )?.status,
    ).toBe("ready");
  });

  test("failed verification blocks delivery creation", async () => {
    const { initiativeId } = await createPlannedInitiative();

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
    const deliveryBody = await deliveryResponse.json();

    expect(deliveryResponse.status).toBe(400);
    expect(deliveryBody.detail).toMatch(/requires a passed verification/i);
  });

  test("delivery stays ready when a scaffold attempt proof is corrupted because the runnable proof is assembly-backed", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);
    await corruptFinalIntegrationProof(initiativeId, taskGraphId);

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
    const deliveryBody = await deliveryResponse.json();

    expect(deliveryResponse.status).toBe(201);
    expect(deliveryBody.delivery).toEqual(
      expect.objectContaining({
        initiativeId,
        status: "ready",
        launchProofKind: "runnable_result",
        launchTargetLabel: "Integrated assembly result",
      }),
    );
    expect(deliveryBody.delivery.launchProofUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/,
    );
    expect(deliveryBody.delivery.launchProofAt).toBeTruthy();

    const state = await readControlPlaneState();
    const initiative = state.orchestration.initiatives.find(
      (candidate) => candidate.id === initiativeId,
    );
    const run = state.orchestration.runs.find(
      (candidate) => candidate.initiativeId === initiativeId,
    );
    const preview = state.orchestration.previewTargets.find(
      (candidate) => candidate.deliveryId === deliveryBody.delivery.id,
    );
    const handoff = state.orchestration.handoffPackets.find(
      (candidate) => candidate.deliveryId === deliveryBody.delivery.id,
    );
    const proof = state.orchestration.validationProofs.find(
      (candidate) => candidate.runId === run?.id,
    );

    expect(initiative?.status).toBe("ready");
    expect(run?.currentStage).toBe("handed_off");
    expect(run?.previewStatus).toBe("ready");
    expect(run?.handoffStatus).toBe("ready");
    expect(preview?.healthStatus).toBe("ready");
    expect(handoff?.status).toBe("ready");
    expect(proof?.previewReady).toBe(true);
    expect(proof?.launchReady).toBe(true);
    expect(proof?.handoffReady).toBe(true);
    expect(
      state.orchestration.runEvents.some(
        (event) =>
          event.initiativeId === initiativeId && event.kind === "handoff.ready",
      ),
    ).toBe(true);
    expect(
      state.orchestration.runEvents.some(
        (event) =>
          event.initiativeId === initiativeId && event.kind === "run.completed",
      ),
    ).toBe(true);
  });

  test("repeated delivery creation keeps the same assembly-backed runnable delivery", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);
    const { indexPath, originalExpectedMarker } =
      await corruptFinalIntegrationProof(initiativeId, taskGraphId);

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

    const firstDeliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const firstDeliveryBody = await firstDeliveryResponse.json();

    expect(firstDeliveryResponse.status).toBe(201);
    expect(firstDeliveryBody.delivery.status).toBe("ready");

    const indexHtml = readFileSync(indexPath, "utf8");
    writeFileSync(
      indexPath,
      indexHtml.replace(
        "Infinity Missing Runnable Proof",
        originalExpectedMarker,
      ),
    );

    const secondDeliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const secondDeliveryBody = await secondDeliveryResponse.json();

    expect(secondDeliveryResponse.status).toBe(201);
    expect(secondDeliveryBody.delivery.id).toBe(firstDeliveryBody.delivery.id);
    expect(secondDeliveryBody.delivery.status).toBe("ready");
    expect(secondDeliveryBody.delivery.launchProofKind).toBe("runnable_result");
    expect(secondDeliveryBody.delivery.launchProofUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/,
    );
    expect(secondDeliveryBody.delivery.launchProofAt).toBeTruthy();

    const state = await readControlPlaneState();
    const initiative = state.orchestration.initiatives.find(
      (candidate) => candidate.id === initiativeId,
    );
    const run = state.orchestration.runs.find(
      (candidate) => candidate.initiativeId === initiativeId,
    );
    const handoff = state.orchestration.handoffPackets.find(
      (candidate) => candidate.deliveryId === secondDeliveryBody.delivery.id,
    );
    const proof = state.orchestration.validationProofs.find(
      (candidate) => candidate.runId === run?.id,
    );

    expect(initiative?.status).toBe("ready");
    expect(run?.currentStage).toBe("handed_off");
    expect(run?.handoffStatus).toBe("ready");
    expect(handoff?.status).toBe("ready");
    expect(proof?.launchReady).toBe(true);
    expect(proof?.handoffReady).toBe(true);
    expect(
      state.orchestration.runEvents.some(
        (event) =>
          event.initiativeId === initiativeId && event.kind === "handoff.ready",
      ),
    ).toBe(true);
    expect(
      state.orchestration.runEvents.some(
        (event) =>
          event.initiativeId === initiativeId && event.kind === "run.completed",
      ),
    ).toBe(true);
  });

  test("delivery ignores a legacy attempt manifest and still emits an assembly-backed runnable delivery", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);
    await rewriteFinalIntegrationAsLegacyRunnableResult(
      initiativeId,
      taskGraphId,
    );

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
    const deliveryBody = await deliveryResponse.json();

    expect(deliveryResponse.status).toBe(201);
    expect(deliveryBody.delivery.status).toBe("ready");
    expect(deliveryBody.delivery.launchProofKind).toBe("runnable_result");
    expect(deliveryBody.delivery.launchTargetLabel).toBe(
      "Integrated assembly result",
    );
    expect(deliveryBody.delivery.launchProofUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/,
    );
    expect(deliveryBody.delivery.launchProofAt).toBeTruthy();

    const state = await readControlPlaneState();
    const initiative = state.orchestration.initiatives.find(
      (candidate) => candidate.id === initiativeId,
    );
    const run = state.orchestration.runs.find(
      (candidate) => candidate.initiativeId === initiativeId,
    );
    const handoff = state.orchestration.handoffPackets.find(
      (candidate) => candidate.deliveryId === deliveryBody.delivery.id,
    );
    const proof = state.orchestration.validationProofs.find(
      (candidate) => candidate.runId === run?.id,
    );

    expect(initiative?.status).toBe("ready");
    expect(run?.currentStage).toBe("handed_off");
    expect(handoff?.status).toBe("ready");
    expect(proof?.launchReady).toBe(true);
    expect(proof?.handoffReady).toBe(true);
  });

  test("tip calculator prompts create a prompt-derived runnable preview and manifest", async () => {
    const prompt =
      "Build a tiny tip calculator web app with amount, tip percent, and visible total.";
    const { initiativeId, taskGraphId } = await createPlannedInitiative({
      title: "Build a tiny tip calculator web app with amount, tip percent, and vi...",
      userRequest: prompt,
    });
    await completeAllWorkUnits(taskGraphId);

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
    const deliveryBody = await deliveryResponse.json();

    expect(deliveryResponse.status).toBe(201);
    expect(deliveryBody.delivery.status).toBe("ready");
    expect(deliveryBody.delivery.launchProofKind).toBe("runnable_result");

    const launchManifest = JSON.parse(
      readFileSync(deliveryBody.delivery.launchManifestPath, "utf8"),
    ) as {
      prompt?: string;
      generatedAt?: string;
      entrypoint?: string;
      launchCommand?: string;
      previewUrl?: string | null;
      proofKind?: string;
      sourceWorkUnits?: Array<{ id: string; title: string; attemptId: string }>;
      files?: string[];
    };

    expect(launchManifest).toEqual(
      expect.objectContaining({
        prompt,
        entrypoint: "/index.html",
        launchCommand: deliveryBody.delivery.command,
        previewUrl: deliveryBody.delivery.launchProofUrl,
        proofKind: "runnable_result",
      }),
    );
    expect(launchManifest.generatedAt).toMatch(/T/);
    expect(launchManifest.sourceWorkUnits?.length).toBeGreaterThan(0);
    expect(launchManifest.files).toEqual(
      expect.arrayContaining(["index.html", "app.js"]),
    );

    const appJsPath = path.join(
      path.dirname(deliveryBody.delivery.launchManifestPath),
      "app.js",
    );
    expect(readFileSync(appJsPath, "utf8")).toContain("tipPercent");

    const state = await readControlPlaneState();
    const preview = state.orchestration.previewTargets.find(
      (candidate) => candidate.deliveryId === deliveryBody.delivery.id,
    );
    expect(preview).toBeTruthy();

    const previewResponse = await getPreview(
      new Request(
        `http://localhost/api/control/orchestration/previews/${preview?.id}`,
      ),
      { params: Promise.resolve({ previewId: preview?.id ?? "" }) },
    );
    const previewHtml = await previewResponse.text();

    expect(previewResponse.status).toBe(200);
    expect(previewHtml).toContain("<h1>Tip calculator</h1>");
    expect(previewHtml).not.toContain(`<h1>${prompt}</h1>`);
    expect(previewHtml).not.toContain("<h1>Build a tiny tip calculator web app with amount, tip percent, and vi...</h1>");
    expect(previewHtml).toContain("Bill amount");
    expect(previewHtml).toContain("Tip percent");
    expect(previewHtml).toContain("Total with tip");
    expect(previewHtml).toContain(`<p class="prompt">${prompt}</p>`);
    expect(previewHtml).toContain("tip-result");
    expect(previewHtml).not.toContain("Truthful runnable delivery bundle");
  });

  test("delivery binds to the verification-linked assembly even if a newer assembly exists", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

    const firstAssemblyResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const firstAssemblyBody = await firstAssemblyResponse.json();
    expect(firstAssemblyResponse.status).toBe(201);

    const verificationResponse = await postVerification(
      new Request("http://localhost/api/control/orchestration/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    expect(verificationResponse.status).toBe(201);

    const secondBriefResponse = await postBriefs(
      new Request("http://localhost/api/control/orchestration/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initiativeId,
          summary: "Second approved brief for the project factory.",
          goals: ["Regenerate execution plan"],
          nonGoals: ["Delivery handoff"],
          constraints: ["Stay inside /Users/martin/infinity"],
          assumptions: ["Shell and work-ui remain split"],
          acceptanceCriteria: ["Delivery stays tied to verified assembly"],
          repoScope: [
            "/Users/martin/infinity/apps/shell",
            "/Users/martin/infinity/apps/work-ui",
          ],
          deliverables: ["Assembly", "Verification", "Delivery"],
          clarificationLog: [],
          authoredBy: "droid-spec-writer",
          status: "approved",
        }),
      }),
    );
    const secondBriefBody = await secondBriefResponse.json();
    const secondTaskGraphResponse = await postTaskGraphs(
      new Request("http://localhost/api/control/orchestration/task-graphs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ briefId: secondBriefBody.brief.id }),
      }),
    );
    const secondTaskGraphBody = await secondTaskGraphResponse.json();
    const secondTaskGraphId = secondTaskGraphBody.taskGraph.id as string;
    await completeAllWorkUnits(secondTaskGraphId);

    const secondAssemblyResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    await secondAssemblyResponse.json();
    expect(secondAssemblyResponse.status).toBe(201);

    const deliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const deliveryBody = await deliveryResponse.json();

    expect(deliveryResponse.status).toBe(201);
    expect(deliveryBody.delivery.resultSummary).toMatch(
      /runnable localhost delivery bundle backed by verified assembly evidence/i,
    );
    expect(deliveryBody.delivery.launchManifestPath).toContain(
      firstAssemblyBody.assembly.outputLocation,
    );
    expect(deliveryBody.delivery.localOutputPath).toMatch(
      /\.local-state\/orchestration\/deliveries/,
    );
    expect(deliveryBody.verification.assemblyId).toBe(
      firstAssemblyBody.assembly.id,
    );
    expect(deliveryBody.delivery.verificationRunId).toBe(
      deliveryBody.verification.id,
    );
    expect(deliveryBody.delivery.taskGraphId).toBe(
      firstAssemblyBody.assembly.taskGraphId,
    );
  });

  test("repeated delivery creation for the same verification is idempotent", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

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

    const firstDeliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const firstDeliveryBody = await firstDeliveryResponse.json();
    expect(firstDeliveryResponse.status).toBe(201);

    const secondDeliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const secondDeliveryBody = await secondDeliveryResponse.json();
    expect(secondDeliveryResponse.status).toBe(201);
    expect(secondDeliveryBody.delivery.id).toBe(firstDeliveryBody.delivery.id);

    const state = await readControlPlaneState();
    const deliveriesForInitiative = state.orchestration.deliveries.filter(
      (candidate) => candidate.initiativeId === initiativeId,
    );
    expect(deliveriesForInitiative).toHaveLength(1);
  });
});
