import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  readControlPlaneState,
  resetControlPlaneStateForTests,
  updateControlPlaneState,
} from "../../../../../lib/server/control-plane/state/store";
import { hashControlPlaneMutationRequest } from "../../../../../lib/server/control-plane/state/mutations";
import { materializeAttemptArtifacts } from "../../../../../lib/server/orchestration/attempt-artifacts";
import { artifactLocalPath } from "../../../../../lib/server/orchestration/artifacts";

import { POST as postInitiatives } from "../initiatives/route";
import { POST as postBriefs } from "../briefs/route";
import { POST as postTaskGraphs } from "../task-graphs/route";
import { GET as getWorkUnits } from "../work-units/route";
import { PATCH as patchWorkUnit } from "../work-units/[workUnitId]/route";
import { POST as postAssembly } from "../assembly/route";
import { POST as postVerification } from "../verification/route";
import { GET as getPreview } from "../previews/[previewId]/route";
import { GET as downloadArtifact } from "../artifacts/download/route";
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
const ORIGINAL_STRICT_ROLLOUT =
  process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
const ORIGINAL_SHELL_PUBLIC_ORIGIN =
  process.env.FOUNDEROS_SHELL_PUBLIC_ORIGIN;
const ORIGINAL_ARTIFACT_STORE_MODE = process.env.FOUNDEROS_ARTIFACT_STORE_MODE;
const ORIGINAL_ARTIFACT_STORAGE_URI_PREFIX =
  process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX;
const ORIGINAL_ARTIFACT_SIGNED_URL_BASE =
  process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE;
const ORIGINAL_ARTIFACT_SIGNING_SECRET =
  process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET;
const ORIGINAL_ARTIFACT_OBJECT_MIRROR_ROOT =
  process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT;
const ORIGINAL_EXTERNAL_DELIVERY_MODE =
  process.env.FOUNDEROS_EXTERNAL_DELIVERY_MODE;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-delivery-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  process.env.FOUNDEROS_INTEGRATION_ROOT = tempStateDir;
  delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  delete process.env.FOUNDEROS_ARTIFACT_STORE_MODE;
  delete process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX;
  delete process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE;
  delete process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET;
  delete process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT;
  delete process.env.FOUNDEROS_EXTERNAL_DELIVERY_MODE;
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
  if (ORIGINAL_STRICT_ROLLOUT === undefined) {
    delete process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV;
  } else {
    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV =
      ORIGINAL_STRICT_ROLLOUT;
  }
  if (ORIGINAL_SHELL_PUBLIC_ORIGIN === undefined) {
    delete process.env.FOUNDEROS_SHELL_PUBLIC_ORIGIN;
  } else {
    process.env.FOUNDEROS_SHELL_PUBLIC_ORIGIN = ORIGINAL_SHELL_PUBLIC_ORIGIN;
  }
  if (ORIGINAL_ARTIFACT_STORE_MODE === undefined) {
    delete process.env.FOUNDEROS_ARTIFACT_STORE_MODE;
  } else {
    process.env.FOUNDEROS_ARTIFACT_STORE_MODE = ORIGINAL_ARTIFACT_STORE_MODE;
  }
  if (ORIGINAL_ARTIFACT_STORAGE_URI_PREFIX === undefined) {
    delete process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX;
  } else {
    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      ORIGINAL_ARTIFACT_STORAGE_URI_PREFIX;
  }
  if (ORIGINAL_ARTIFACT_SIGNED_URL_BASE === undefined) {
    delete process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE;
  } else {
    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      ORIGINAL_ARTIFACT_SIGNED_URL_BASE;
  }
  if (ORIGINAL_ARTIFACT_SIGNING_SECRET === undefined) {
    delete process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET;
  } else {
    process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET =
      ORIGINAL_ARTIFACT_SIGNING_SECRET;
  }
  if (ORIGINAL_ARTIFACT_OBJECT_MIRROR_ROOT === undefined) {
    delete process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT;
  } else {
    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT =
      ORIGINAL_ARTIFACT_OBJECT_MIRROR_ROOT;
  }
  if (ORIGINAL_EXTERNAL_DELIVERY_MODE === undefined) {
    delete process.env.FOUNDEROS_EXTERNAL_DELIVERY_MODE;
  } else {
    process.env.FOUNDEROS_EXTERNAL_DELIVERY_MODE =
      ORIGINAL_EXTERNAL_DELIVERY_MODE;
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

  test("strict rollout does not persist delivery.ready without external proof set", async () => {
    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = "1";
    process.env.FOUNDEROS_SHELL_PUBLIC_ORIGIN = "https://shell.infinity.example";
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
        status: "pending",
        readinessTier: "staging",
        launchProofKind: "runnable_result",
        externalPreviewUrl: null,
        externalProofManifestPath: null,
        ciProofUri: null,
        artifactStorageUri: null,
        signedManifestUri: null,
      }),
    );
    expect(deliveryBody.delivery.launchProofUrl).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/index\.html$/,
    );
    expect(deliveryBody.delivery.resultSummary).toMatch(
      /strict rollout requires external preview, CI proof, signed manifest, and artifact storage proof/i,
    );

    const state = await readControlPlaneState();
    expect(
      state.orchestration.initiatives.find(
        (initiative) => initiative.id === initiativeId,
      )?.status,
    ).toBe("verifying");
  });

  test("strict rollout persists delivery artifacts as object-store URIs when object storage is configured", async () => {
    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = "1";
    process.env.FOUNDEROS_SHELL_PUBLIC_ORIGIN = "https://shell.infinity.example";
    process.env.FOUNDEROS_ARTIFACT_STORE_MODE = "r2";
    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      "r2://infinity-artifacts/prod";
    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      "https://artifacts.infinity.example/download";
    process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET =
      "test-artifact-signing-secret";
    const objectMirrorRoot = path.join(tempStateDir, "object-mirror");
    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT = objectMirrorRoot;
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
    const deliveryJson = JSON.stringify(deliveryBody.delivery);

    expect(deliveryResponse.status).toBe(201);
    expect(deliveryBody.delivery).toEqual(
      expect.objectContaining({
        status: "pending",
        readinessTier: "staging",
        localOutputPath: null,
        command: null,
      }),
    );
    expect(deliveryBody.delivery.manifestPath).toMatch(
      /^r2:\/\/infinity-artifacts\/prod\/deliveries\/.+\/delivery-manifest\.json$/,
    );
    expect(deliveryBody.delivery.launchManifestPath).toMatch(
      /^r2:\/\/infinity-artifacts\/prod\/deliveries\//,
    );
    expect(deliveryBody.delivery.externalProofManifestPath).toMatch(
      /^r2:\/\/infinity-artifacts\/prod\/deliveries\/.+\/signed-artifact-manifest\.json$/,
    );
    expect(deliveryBody.delivery.artifactStorageUri).toMatch(
      /^r2:\/\/infinity-artifacts\/prod\/deliveries\//,
    );
    expect(deliveryBody.delivery.signedManifestUri).toMatch(
      /^https:\/\/artifacts\.infinity\.example\/download\?/,
    );
    expect(deliveryJson).not.toContain("file://");
    expect(deliveryJson).not.toContain(tempStateDir);
    expect(deliveryJson).not.toContain("/Users/martin/infinity");

    const state = await readControlPlaneState();
    const preview = state.orchestration.previewTargets.find(
      (candidate) => candidate.deliveryId === deliveryBody.delivery.id,
    );
    const handoff = state.orchestration.handoffPackets.find(
      (candidate) => candidate.deliveryId === deliveryBody.delivery.id,
    );
    const deliveryEvidenceJson = JSON.stringify({ preview, handoff });
    expect(preview?.sourcePath).toMatch(
      /^r2:\/\/infinity-artifacts\/prod\/deliveries\//,
    );
    expect(handoff?.rootPath).toMatch(
      /^r2:\/\/infinity-artifacts\/prod\/deliveries\//,
    );
    expect(handoff?.finalSummaryPath).toMatch(
      /^r2:\/\/infinity-artifacts\/prod\/deliveries\//,
    );
    expect(handoff?.manifestPath).toMatch(
      /^r2:\/\/infinity-artifacts\/prod\/deliveries\//,
    );
    expect(deliveryEvidenceJson).not.toContain("file://");
    expect(deliveryEvidenceJson).not.toContain(tempStateDir);
    expect(deliveryEvidenceJson).not.toContain("/Users/martin/infinity");

    const signedManifestResponse = await downloadArtifact(
      new Request(deliveryBody.delivery.signedManifestUri),
    );
    expect(signedManifestResponse.status).toBe(200);
    const signedManifestText = await signedManifestResponse.text();
    expect(signedManifestText).not.toContain("file://");
    expect(signedManifestText).not.toContain("localhost");
    expect(signedManifestText).not.toContain("127.0.0.1");
    expect(signedManifestText).not.toContain("0.0.0.0");
    expect(signedManifestText).not.toContain(tempStateDir);
    expect(signedManifestText).not.toContain(objectMirrorRoot);
    expect(signedManifestText).not.toContain("/Users/martin/");
    const signedManifest = JSON.parse(signedManifestText) as {
      artifacts: Array<{ signedUrl: string }>;
    };
    expect(signedManifest.artifacts.length).toBeGreaterThan(0);
    for (const artifact of signedManifest.artifacts) {
      const artifactResponse = await downloadArtifact(
        new Request(artifact.signedUrl),
      );
      expect(artifactResponse.status).toBe(200);
      const artifactBody = await artifactResponse.text();
      expect(artifactBody).not.toContain("file://");
      expect(artifactBody).not.toContain("localhost");
      expect(artifactBody).not.toContain("127.0.0.1");
      expect(artifactBody).not.toContain("0.0.0.0");
      expect(artifactBody).not.toContain(tempStateDir);
      expect(artifactBody).not.toContain(objectMirrorRoot);
      expect(artifactBody).not.toContain("/Users/martin/");
    }

    const previewResponse = await getPreview(
      new Request(`http://localhost/api/control/orchestration/previews/${preview?.id}`),
      { params: Promise.resolve({ previewId: preview?.id ?? "" }) },
    );
    expect(previewResponse.status).toBe(200);
  });

  test("strict rollout promotes mocked external PR, preview, and CI proof to production delivery", async () => {
    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = "1";
    process.env.FOUNDEROS_SHELL_PUBLIC_ORIGIN = "https://shell.infinity.example";
    process.env.FOUNDEROS_ARTIFACT_STORE_MODE = "r2";
    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      "r2://infinity-artifacts/prod";
    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      "https://artifacts.infinity.example/download";
    process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET =
      "test-artifact-signing-secret";
    const objectMirrorRoot = path.join(tempStateDir, "object-mirror");
    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT = objectMirrorRoot;
    process.env.FOUNDEROS_EXTERNAL_DELIVERY_MODE = "mock";

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
    const deliveryJson = JSON.stringify(deliveryBody.delivery);

    expect(deliveryResponse.status).toBe(201);
    expect(deliveryBody.delivery).toEqual(
      expect.objectContaining({
        status: "ready",
        readinessTier: "production",
        localOutputPath: null,
        command: null,
        externalPreviewProvider: "vercel",
        ciProofProvider: "github_commit_status",
      }),
    );
    expect(deliveryBody.delivery.externalPullRequestUrl).toMatch(
      /^https:\/\/github\.com\/founderos\/infinity\/pull\/\d+$/,
    );
    expect(deliveryBody.delivery.externalPreviewUrl).toMatch(
      /^https:\/\/delivery-.+\.preview\.infinity\.example$/,
    );
    expect(deliveryBody.delivery.ciProofUri).toMatch(
      /^https:\/\/github\.com\/founderos\/infinity\/commit\/mock-delivery-.+\/checks$/,
    );
    expect(deliveryBody.delivery.externalProofManifestPath).toMatch(
      /^r2:\/\/infinity-artifacts\/prod\/deliveries\/.+\/external-delivery-proof\.json$/,
    );
    expect(deliveryJson).not.toContain("file://");
    expect(deliveryJson).not.toContain(tempStateDir);
    expect(deliveryJson).not.toContain(objectMirrorRoot);
    expect(deliveryJson).not.toContain("/Users/martin/");

    const proofManifestPath = artifactLocalPath(
      deliveryBody.delivery.externalProofManifestPath,
    );
    expect(proofManifestPath).toBeTruthy();
    const proofManifestJson = JSON.parse(
      readFileSync(proofManifestPath ?? "", "utf8"),
    ) as Record<string, unknown>;
    const proofManifestText = JSON.stringify(proofManifestJson);
    expect(proofManifestText).toContain(deliveryBody.delivery.externalPullRequestId);
    expect(proofManifestText).toContain(deliveryBody.delivery.externalPreviewDeploymentId);
    expect(proofManifestText).toContain(deliveryBody.delivery.ciProofId);
    expect(proofManifestText).toContain(deliveryBody.delivery.artifactStorageUri);
    expect(proofManifestText).toContain(deliveryBody.delivery.signedManifestUri);
    expect(proofManifestText).not.toContain("file://");
    expect(proofManifestText).not.toContain("localhost");
    expect(proofManifestText).not.toContain("127.0.0.1");
    expect(proofManifestText).not.toContain("0.0.0.0");
    expect(proofManifestText).not.toContain(tempStateDir);
    expect(proofManifestText).not.toContain(objectMirrorRoot);
    expect(proofManifestText).not.toContain("/Users/martin/");

    const deliveryManifestPath = artifactLocalPath(deliveryBody.delivery.manifestPath);
    expect(deliveryManifestPath).toBeTruthy();
    const deliveryManifestText = readFileSync(deliveryManifestPath ?? "", "utf8");
    expect(deliveryManifestText).toContain(deliveryBody.delivery.externalPullRequestId);
    expect(deliveryManifestText).toContain(deliveryBody.delivery.externalPreviewDeploymentId);
    expect(deliveryManifestText).toContain(deliveryBody.delivery.ciProofId);
    expect(deliveryManifestText).toContain(deliveryBody.delivery.externalProofManifestPath);
    expect(deliveryManifestText).not.toContain("file://");
    expect(deliveryManifestText).not.toContain("localhost");
    expect(deliveryManifestText).not.toContain("127.0.0.1");
    expect(deliveryManifestText).not.toContain("0.0.0.0");
    expect(deliveryManifestText).not.toContain(tempStateDir);
    expect(deliveryManifestText).not.toContain(objectMirrorRoot);
    expect(deliveryManifestText).not.toContain("/Users/martin/");
  });

  test("bad object artifact config fails before persisting local artifact links", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

    process.env.FOUNDEROS_ARTIFACT_STORE_MODE = "r2";
    process.env.FOUNDEROS_ARTIFACT_STORAGE_URI_PREFIX =
      `file://${tempStateDir}/object-artifacts`;
    process.env.FOUNDEROS_ARTIFACT_SIGNED_URL_BASE =
      "https://shell.infinity.example/api/control/orchestration/artifacts/download";
    process.env.FOUNDEROS_ARTIFACT_SIGNING_SECRET =
      "test-artifact-signing-secret";
    process.env.FOUNDEROS_ARTIFACT_OBJECT_MIRROR_ROOT = path.join(
      tempStateDir,
      "object-mirror",
    );

    await expect(
      postAssembly(
        new Request("http://localhost/api/control/orchestration/assembly", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initiativeId }),
        }),
      ),
    ).rejects.toThrow(/must not be a local file path/i);

    const state = await readControlPlaneState();
    expect(state.orchestration.assemblies).toHaveLength(0);
    expect(state.orchestration.deliveries).toHaveLength(0);
  });

  test("strict rollout revalidates an existing ready local delivery before early return", async () => {
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

    const localDeliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const localDeliveryBody = await localDeliveryResponse.json();

    expect(localDeliveryResponse.status).toBe(201);
    expect(localDeliveryBody.delivery).toEqual(
      expect.objectContaining({
        status: "ready",
        readinessTier: "local_solo",
        externalProofManifestPath: null,
      }),
    );

    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = "1";
    process.env.FOUNDEROS_SHELL_PUBLIC_ORIGIN = "https://shell.infinity.example";

    const strictListResponse = await getDelivery(
      new Request(
        `http://localhost/api/control/orchestration/delivery?initiative_id=${initiativeId}`,
      ),
    );
    const strictListBody = await strictListResponse.json();

    expect(strictListResponse.status).toBe(200);
    expect(strictListBody.deliveries).toEqual([
      expect.objectContaining({
        id: localDeliveryBody.delivery.id,
        status: "pending",
        readinessTier: "staging",
      }),
    ]);

    const strictDeliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const strictDeliveryBody = await strictDeliveryResponse.json();

    expect(strictDeliveryResponse.status).toBe(201);
    expect(strictDeliveryBody.delivery).toEqual(
      expect.objectContaining({
        id: localDeliveryBody.delivery.id,
        status: "pending",
        readinessTier: "staging",
        launchProofKind: "runnable_result",
        externalPreviewUrl: null,
        externalProofManifestPath: null,
        ciProofUri: null,
        artifactStorageUri: null,
        signedManifestUri: null,
      }),
    );
    expect(strictDeliveryBody.delivery.resultSummary).toMatch(
      /strict rollout requires external preview, CI proof, signed manifest, and artifact storage proof/i,
    );

    const state = await readControlPlaneState();
    expect(
      state.orchestration.deliveries.find(
        (delivery) => delivery.id === localDeliveryBody.delivery.id,
      )?.status,
    ).toBe("pending");
    expect(
      state.orchestration.initiatives.find(
        (initiative) => initiative.id === initiativeId,
      )?.status,
    ).toBe("verifying");
  });

  test("strict rollout policy prevents idempotency replay of local ready delivery", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

    await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );
    await postVerification(
      new Request("http://localhost/api/control/orchestration/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      }),
    );

    const requestBody = JSON.stringify({ initiativeId });
    const localDeliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "delivery-policy-replay-001",
        },
        body: requestBody,
      }),
    );
    const localDeliveryBody = await localDeliveryResponse.json();

    expect(localDeliveryResponse.status).toBe(201);
    expect(localDeliveryBody.delivery.status).toBe("ready");

    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = "1";
    process.env.FOUNDEROS_SHELL_PUBLIC_ORIGIN = "https://shell.infinity.example";

    const replayResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "delivery-policy-replay-001",
        },
        body: requestBody,
      }),
    );
    const replayBody = await replayResponse.json();

    expect(replayResponse.status).toBe(409);
    expect(replayBody.code).toBe("idempotency_key_conflict");

    const listResponse = await getDelivery(
      new Request(
        `http://localhost/api/control/orchestration/delivery?initiative_id=${initiativeId}`,
      ),
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.deliveries[0]).toEqual(
      expect.objectContaining({
        id: localDeliveryBody.delivery.id,
        status: "pending",
        readinessTier: "staging",
      }),
    );
  });

  test("strict rollout projects stale same-policy idempotency replay responses", async () => {
    process.env.FOUNDEROS_REQUIRE_EXPLICIT_ROLLOUT_ENV = "1";
    const requestBody = { initiativeId: "initiative-stale-replay" };
    const requestHash = hashControlPlaneMutationRequest({
      route: "delivery.create",
      body: {
        ...requestBody,
        strictRolloutEnv: true,
      },
    });

    await updateControlPlaneState((draft) => {
      draft.mutations.idempotency = [
        {
          tenantId: "default",
          idempotencyKey: "delivery-stale-replay-001",
          requestHash,
          mutationEventId: "mutation-stale-replay-001",
          status: "completed",
          statusCode: 201,
          responseJson: {
            delivery: {
              id: "delivery-stale-replay-001",
              initiativeId: requestBody.initiativeId,
              verificationRunId: "verification-stale-replay-001",
              resultSummary: "Stale cached local ready response.",
              launchProofKind: "runnable_result",
              launchProofUrl: "http://127.0.0.1:4100/index.html",
              launchProofAt: "2026-04-24T00:00:00.000Z",
              status: "ready",
              readinessTier: "local_solo",
            },
            verification: null,
            assembly: null,
          },
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      ];
    });

    const replayResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "delivery-stale-replay-001",
        },
        body: JSON.stringify(requestBody),
      }),
    );
    const replayBody = await replayResponse.json();

    expect(replayResponse.status).toBe(201);
    expect(replayBody.delivery).toEqual(
      expect.objectContaining({
        id: "delivery-stale-replay-001",
        status: "pending",
        readinessTier: "staging",
      }),
    );
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

  test("todo tasker prompts create a checklist runnable preview and manifest", async () => {
    const prompt =
      "создай мне пожалуйста простой таскер: список дел который я сначала вношу, а потом отмечаю галочками что сделал.";
    const { initiativeId, taskGraphId } = await createPlannedInitiative({
      title: "создай мне пожалуйста простой таскер: список дел который я сначала вн...",
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
    ) as { appKind?: string };
    expect(launchManifest.appKind).toBe("todo_tasker");

    const appJsPath = path.join(
      path.dirname(deliveryBody.delivery.launchManifestPath),
      "app.js",
    );
    const appJs = readFileSync(appJsPath, "utf8");
    expect(appJs).toContain("todo_tasker");
    expect(appJs).toContain("addTask");
    expect(appJs).toContain("toggleTask");

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
    expect(previewHtml).toContain("<h1>Todo tasker</h1>");
    expect(previewHtml).toContain("New task");
    expect(previewHtml).toContain("Add task");
    expect(previewHtml).toContain("todo-list");
    expect(previewHtml).toContain("todo-open-count");
    expect(previewHtml).toContain("todo-completed-count");
    expect(previewHtml).not.toContain("<h1>Prompt calculator</h1>");
    expect(previewHtml).not.toContain("prompt-result");
  });

  test("wishlist prompts create a wish tracker with completion celebration", async () => {
    const prompt =
      "сделай мне пожалуйста простенький список моих желаний: я буду туда вносить свои желания, а когда они сбудутся, я буду отмечать их как выполнено, и буде какая то простенькая поздравительная анимация, типа конфети или фанфары.";
    const { initiativeId, taskGraphId } = await createPlannedInitiative({
      title: "сделай мне пожалуйста простенький список моих желаний: я буду туда вн...",
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
    expect(deliveryBody.delivery.resultSummary).toContain("список моих желаний");

    const launchManifest = JSON.parse(
      readFileSync(deliveryBody.delivery.launchManifestPath, "utf8"),
    ) as { appKind?: string };
    expect(launchManifest.appKind).toBe("wishlist_tracker");

    const appJsPath = path.join(
      path.dirname(deliveryBody.delivery.launchManifestPath),
      "app.js",
    );
    const appJs = readFileSync(appJsPath, "utf8");
    expect(appJs).toContain("wishlist_tracker");
    expect(appJs).toContain("addWish");
    expect(appJs).toContain("toggleWish");

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
    expect(previewHtml).toContain("<h1>Wishlist tracker</h1>");
    expect(previewHtml).toContain("New wish");
    expect(previewHtml).toContain("Add wish");
    expect(previewHtml).toContain("wish-list");
    expect(previewHtml).toContain("wish-celebration");
    expect(previewHtml).not.toContain("<h1>Todo tasker</h1>");
    expect(previewHtml).not.toContain('id="todo-list"');
  });

  test("repeated todo delivery rebuilds stale generic runnable artifacts", async () => {
    const prompt =
      "создай мне пожалуйста простой таскер: список дел который я сначала вношу, а потом отмечаю галочками что сделал.";
    const { initiativeId, taskGraphId } = await createPlannedInitiative({
      title: "создай мне пожалуйста простой таскер: список дел который я сначала вн...",
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

    const launchManifestPath = firstDeliveryBody.delivery.launchManifestPath as string;
    const launchManifest = JSON.parse(
      readFileSync(launchManifestPath, "utf8"),
    ) as Record<string, unknown>;
    writeFileSync(
      launchManifestPath,
      JSON.stringify(
        {
          ...launchManifest,
          appKind: "prompt_calculator",
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(path.dirname(launchManifestPath), "index.html"),
      "<!doctype html><html><body><h1>Prompt calculator</h1><output id=\"prompt-result\"></output></body></html>",
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

    const rebuiltManifest = JSON.parse(
      readFileSync(secondDeliveryBody.delivery.launchManifestPath, "utf8"),
    ) as { appKind?: string };
    const rebuiltHtml = readFileSync(
      path.join(path.dirname(secondDeliveryBody.delivery.launchManifestPath), "index.html"),
      "utf8",
    );

    expect(rebuiltManifest.appKind).toBe("todo_tasker");
    expect(rebuiltHtml).toContain("<h1>Todo tasker</h1>");
    expect(rebuiltHtml).toContain("todo-list");
    expect(rebuiltHtml).not.toContain("<h1>Prompt calculator</h1>");
    expect(rebuiltHtml).not.toContain("prompt-result");
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

  test("replays the same delivery response for a repeated Idempotency-Key", async () => {
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

    const headers = {
      "content-type": "application/json",
      "idempotency-key": "delivery-key-001",
    };
    const firstDeliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers,
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const firstDeliveryBody = await firstDeliveryResponse.json();
    const secondDeliveryResponse = await postDelivery(
      new Request("http://localhost/api/control/orchestration/delivery", {
        method: "POST",
        headers,
        body: JSON.stringify({ initiativeId }),
      }),
    );
    const secondDeliveryBody = await secondDeliveryResponse.json();

    expect(firstDeliveryResponse.status).toBe(201);
    expect(secondDeliveryResponse.status).toBe(201);
    expect(secondDeliveryBody).toEqual(firstDeliveryBody);

    const state = await readControlPlaneState();
    expect(
      state.mutations.idempotency.some(
        (record) => record.idempotencyKey === "delivery-key-001",
      ),
    ).toBe(true);
    expect(
      state.mutations.events.some(
        (event) =>
          event.mutationKind === "delivery.create" &&
          event.resourceId === firstDeliveryBody.delivery.id,
      ),
    ).toBe(true);
  });
});
