import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { readControlPlaneState, resetControlPlaneStateForTests } from "../../../../../lib/server/control-plane/state/store";

import { POST as postInitiatives } from "../initiatives/route";
import { POST as postBriefs } from "../briefs/route";
import { POST as postTaskGraphs } from "../task-graphs/route";
import { GET as getWorkUnits } from "../work-units/route";
import { PATCH as patchWorkUnit } from "../work-units/[workUnitId]/route";
import { POST as postAssembly } from "../assembly/route";
import { GET as getVerification, POST as postVerification } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
const ORIGINAL_VALIDATION_COMMANDS =
  process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON;

let tempStateDir = "";

function normalizeArtifactPath(value: string) {
  return value.startsWith("file://") ? value.replace(/^file:\/\//, "") : value;
}

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-verification-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
  process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON = JSON.stringify([
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
  ]);
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
  if (ORIGINAL_VALIDATION_COMMANDS === undefined) {
    delete process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON;
  } else {
    process.env.FOUNDEROS_ORCHESTRATION_VALIDATION_COMMANDS_JSON =
      ORIGINAL_VALIDATION_COMMANDS;
  }
  if (tempStateDir) {
    rmSync(tempStateDir, { recursive: true, force: true });
    tempStateDir = "";
  }
});

async function createPlannedInitiative() {
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
        nonGoals: ["Delivery handoff"],
        constraints: ["Stay inside /Users/martin/infinity"],
        assumptions: ["Shell and work-ui remain split"],
        acceptanceCriteria: ["Verifier produces pass/fail checks"],
        repoScope: [
          "/Users/martin/infinity/apps/shell",
          "/Users/martin/infinity/apps/work-ui",
        ],
        deliverables: ["Assembly", "Verification"],
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

async function completeAllWorkUnits(taskGraphId: string) {
  const workUnitsResponse = await getWorkUnits(
    new Request(
      `http://localhost/api/control/orchestration/work-units?task_graph_id=${taskGraphId}`
    )
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
            latestAttemptId: `attempt-verify-${index + 1}`,
          }),
        }
      ),
      { params: Promise.resolve({ workUnitId: workUnit.id }) }
    );
    expect(response.status).toBe(200);
  }
}

describe("/api/control/orchestration/verification", () => {
  test("assembled initiatives produce a passed verification checklist", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

    const assemblyResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      })
    );
    expect(assemblyResponse.status).toBe(201);

    const verificationResponse = await postVerification(
      new Request("http://localhost/api/control/orchestration/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      })
    );
    const verificationBody = await verificationResponse.json();

    expect(verificationResponse.status).toBe(201);
    expect(verificationBody.verification.overallStatus).toBe("passed");
    expect(verificationBody.verification.checks.every((check: { status: string }) => check.status === "passed")).toBe(true);
    expect(
      verificationBody.verification.checks.map((check: { name: string }) => check.name)
    ).toContain("assembly_manifest_present");

    const listResponse = await getVerification(
      new Request(
        `http://localhost/api/control/orchestration/verification?initiative_id=${initiativeId}`
      )
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.verifications).toEqual([
      expect.objectContaining({
        id: verificationBody.verification.id,
        overallStatus: "passed",
      }),
    ]);
  });

  test("failed verification does not create a delivery record", async () => {
    const { initiativeId } = await createPlannedInitiative();

    const verificationResponse = await postVerification(
      new Request("http://localhost/api/control/orchestration/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      })
    );
    const verificationBody = await verificationResponse.json();

    expect(verificationResponse.status).toBe(201);
    expect(verificationBody.verification.overallStatus).toBe("failed");
    expect(verificationBody.deliveryBlocked).toBe(true);

    const state = await readControlPlaneState();
    expect(state.orchestration.deliveries).toEqual([]);
  });

  test("verification fails when the latest assembly belongs to an older task graph generation", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

    const assemblyResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      })
    );
    expect(assemblyResponse.status).toBe(201);

    const secondBriefResponse = await postBriefs(
      new Request("http://localhost/api/control/orchestration/briefs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initiativeId,
          summary: "Second approved brief for the project factory.",
          goals: ["Regenerate the plan"],
          nonGoals: ["Delivery handoff"],
          constraints: ["Stay inside /Users/martin/infinity"],
          assumptions: ["Shell and work-ui remain split"],
          acceptanceCriteria: ["Verifier rejects stale assemblies"],
          repoScope: [
            "/Users/martin/infinity/apps/shell",
            "/Users/martin/infinity/apps/work-ui",
          ],
          deliverables: ["Assembly", "Verification"],
          clarificationLog: [],
          authoredBy: "droid-spec-writer",
          status: "approved",
        }),
      })
    );
    const secondBriefBody = await secondBriefResponse.json();
    const secondTaskGraphResponse = await postTaskGraphs(
      new Request("http://localhost/api/control/orchestration/task-graphs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ briefId: secondBriefBody.brief.id }),
      })
    );
    const secondTaskGraphBody = await secondTaskGraphResponse.json();
    const secondTaskGraphId = secondTaskGraphBody.taskGraph.id as string;

    await completeAllWorkUnits(secondTaskGraphId);

    const verificationResponse = await postVerification(
      new Request("http://localhost/api/control/orchestration/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      })
    );
    const verificationBody = await verificationResponse.json();

    expect(verificationResponse.status).toBe(201);
    expect(verificationBody.verification.overallStatus).toBe("failed");
    expect(
      verificationBody.verification.checks.find(
        (check: { name: string }) => check.name === "assembly_matches_task_graph"
      )?.status
    ).toBe("failed");
  });

  test("verification fails when the local assembly evidence files drift away from the recorded package", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

    const assemblyResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      })
    );
    const assemblyBody = await assemblyResponse.json();
    expect(assemblyResponse.status).toBe(201);
    rmSync(normalizeArtifactPath(assemblyBody.assembly.artifactUris[0] as string), {
      force: true,
    });

    const verificationResponse = await postVerification(
      new Request("http://localhost/api/control/orchestration/verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      })
    );
    const verificationBody = await verificationResponse.json();

    expect(verificationResponse.status).toBe(201);
    expect(verificationBody.verification.overallStatus).toBe("failed");
    expect(
      verificationBody.verification.checks.find(
        (check: { name: string }) => check.name === "artifact_evidence_present"
      )?.status
    ).toBe("failed");
  });
});
