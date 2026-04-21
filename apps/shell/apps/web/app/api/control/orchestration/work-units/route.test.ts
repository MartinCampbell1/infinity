import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resetControlPlaneStateForTests } from "../../../../../lib/server/control-plane/state/store";

import { POST as postInitiatives } from "../initiatives/route";
import { POST as postBriefs } from "../briefs/route";
import { POST as postTaskGraphs } from "../task-graphs/route";
import { GET as getTaskGraphDetail } from "../task-graphs/[taskGraphId]/route";
import { GET as getWorkUnits } from "./route";
import { GET as getWorkUnitDetail, PATCH as patchWorkUnit } from "./[workUnitId]/route";

const ORIGINAL_CONTROL_PLANE_STATE_DIR = process.env.FOUNDEROS_CONTROL_PLANE_STATE_DIR;
const ORIGINAL_CONTROL_PLANE_DATABASE_URL = process.env.FOUNDEROS_CONTROL_PLANE_DATABASE_URL;
const ORIGINAL_EXECUTION_HANDOFF_DATABASE_URL = process.env.FOUNDEROS_EXECUTION_HANDOFF_DATABASE_URL;

let tempStateDir = "";

beforeEach(async () => {
  tempStateDir = mkdtempSync(path.join(tmpdir(), "infinity-work-units-"));
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

async function createPlannedGraph() {
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

describe("/api/control/orchestration/work-units", () => {
  test("work-unit readiness and runnable nodes advance deterministically from dependencies", async () => {
    const { taskGraphId } = await createPlannedGraph();

    const listResponse = await getWorkUnits(
      new Request(
        `http://localhost/api/control/orchestration/work-units?task_graph_id=${taskGraphId}`
      )
    );
    const listBody = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(listBody.workUnits.length).toBeGreaterThanOrEqual(5);
    expect(listBody.runnableWorkUnitIds).toHaveLength(1);

    const rootUnitId = listBody.runnableWorkUnitIds[0] as string;

    const rootDetailResponse = await getWorkUnitDetail(
      new Request(`http://localhost/api/control/orchestration/work-units/${rootUnitId}`),
      { params: Promise.resolve({ workUnitId: rootUnitId }) }
    );
    const rootDetailBody = await rootDetailResponse.json();

    expect(rootDetailResponse.status).toBe(200);
    expect(rootDetailBody.workUnit.status).toBe("ready");

    const patchResponse = await patchWorkUnit(
      new Request(`http://localhost/api/control/orchestration/work-units/${rootUnitId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          latestAttemptId: "attempt-foundation-001",
        }),
      }),
      { params: Promise.resolve({ workUnitId: rootUnitId }) }
    );
    const patchBody = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(patchBody.workUnit.status).toBe("completed");

    const graphDetailResponse = await getTaskGraphDetail(
      new Request(`http://localhost/api/control/orchestration/task-graphs/${taskGraphId}`),
      { params: Promise.resolve({ taskGraphId }) }
    );
    const graphDetailBody = await graphDetailResponse.json();

    expect(graphDetailResponse.status).toBe(200);
    expect(graphDetailBody.runnableWorkUnitIds).toHaveLength(2);
    expect(
      graphDetailBody.workUnits
        .filter((unit: { id: string }) =>
          graphDetailBody.runnableWorkUnitIds.includes(unit.id)
        )
        .every((unit: { status: string }) => unit.status === "ready")
    ).toBe(true);
  });
});
