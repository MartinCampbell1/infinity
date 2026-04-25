import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resetControlPlaneStateForTests } from "../../../../../lib/server/control-plane/state/store";

import { POST as postInitiatives } from "../initiatives/route";
import { POST as postBriefs } from "../briefs/route";
import { POST as postTaskGraphs } from "../task-graphs/route";
import { GET as getWorkUnits } from "../work-units/route";
import { PATCH as patchWorkUnit } from "../work-units/[workUnitId]/route";
import { GET as getAssembly, POST as postAssembly } from "./route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-assembly-"));
  process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR = tempStateDir;
  delete process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
  delete process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;
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
        acceptanceCriteria: ["Completed work units produce assembly"],
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
            latestAttemptId: `attempt-complete-${index + 1}`,
          }),
        }
      ),
      { params: Promise.resolve({ workUnitId: workUnit.id }) }
    );
    expect(response.status).toBe(200);
  }
}

describe("/api/control/orchestration/assembly", () => {
  test("completed work units produce an assembled artifact record", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

    const createResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initiativeId,
        }),
      })
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(201);
    expect(createBody.assembly).toEqual(
      expect.objectContaining({
        initiativeId,
        status: "assembled",
      })
    );
    expect(createBody.assembly.artifactUris).toHaveLength(createBody.workUnits.length);
    expect(
      createBody.assembly.artifactUris.every((artifactUri: string) =>
        artifactUri.includes("/work-units/")
      )
    ).toBe(true);
    expect(existsSync(createBody.assembly.outputLocation)).toBe(true);

    const listResponse = await getAssembly(
      new Request(
        `http://localhost/api/control/orchestration/assembly?initiative_id=${initiativeId}`
      )
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.assemblies).toEqual([
      expect.objectContaining({
        id: createBody.assembly.id,
        status: "assembled",
      }),
    ]);
  });

  test("assembly creation fails when a completed work unit has no attempt artifact", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

    const workUnitsResponse = await getWorkUnits(
      new Request(
        `http://localhost/api/control/orchestration/work-units?task_graph_id=${taskGraphId}`
      )
    );
    const workUnitsBody = await workUnitsResponse.json();
    const targetWorkUnitId = workUnitsBody.workUnits[0].id as string;

    const patchResponse = await patchWorkUnit(
      new Request(
        `http://localhost/api/control/orchestration/work-units/${targetWorkUnitId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            latestAttemptId: null,
          }),
        }
      ),
      { params: Promise.resolve({ workUnitId: targetWorkUnitId }) }
    );
    expect(patchResponse.status).toBe(200);

    const createResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          initiativeId,
        }),
      })
    );
    const createBody = await createResponse.json();

    expect(createResponse.status).toBe(400);
    expect(createBody.error?.message).toMatch(/could not be created/i);
  });

  test("assembly creation regenerates when a new task-graph generation completes", async () => {
    const { initiativeId, taskGraphId } = await createPlannedInitiative();
    await completeAllWorkUnits(taskGraphId);

    const firstAssemblyResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      })
    );
    const firstAssemblyBody = await firstAssemblyResponse.json();
    expect(firstAssemblyResponse.status).toBe(201);

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
          acceptanceCriteria: ["Assembly regenerates for the new graph"],
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

    const secondAssemblyResponse = await postAssembly(
      new Request("http://localhost/api/control/orchestration/assembly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initiativeId }),
      })
    );
    const secondAssemblyBody = await secondAssemblyResponse.json();

    expect(secondAssemblyResponse.status).toBe(201);
    expect(secondAssemblyBody.assembly.id).not.toBe(firstAssemblyBody.assembly.id);
    expect(secondAssemblyBody.assembly.inputWorkUnitIds).not.toEqual(
      firstAssemblyBody.assembly.inputWorkUnitIds
    );
  });
});
